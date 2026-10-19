import { parseUnits, formatUnits, keccak256, encodePacked } from 'viem';
import { publicClient } from './web3';
import { CONTRACT_ADDRESSES, ERC20_ABI, PAYMENT_CORE_ABI, PRICE_FEED_ABI } from '../config/contracts';

export interface AccountState {
  btcBalance: string;
  btcBalanceRaw: bigint;
  musdBalance: string;
  musdBalanceRaw: bigint;
  allowance: string;
  allowanceRaw: bigint;
  isLimitsConfigured: boolean;
  dailyCap: string;
  perTxCap: string;
  spentToday: string;
  effectiveRemainingDailySpend: string;
  pendingDailyCap: string;
  pendingPerTxCap: string;
  pendingDailyTimelock: number;
  pendingPerTxTimelock: number;
}

export async function fetchAccountState(address: `0x${string}`): Promise<AccountState> {
  try {
    // 1. Native BTC Balance
    const btcBal = await publicClient.getBalance({ address });

    // 2. MUSD Balance
    const musdBal = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.MUSD,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    // 3. MUSD Allowance to Payment Core
    const allowance = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.MUSD,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address, CONTRACT_ADDRESSES.PAYMENT_CORE],
    }) as bigint;

    // 4. Safety Limits
    let isLimitsConfigured = false;
    let dailyCap = 0n;
    let perTxCap = 0n;
    let spentToday = 0n;
    let effectiveRemaining = 0n;
    let pendingDailyCap = 0n;
    let pendingPerTxCap = 0n;
    let pendingDailyTimelock = 0;
    let pendingPerTxTimelock = 0;

    try {
      const limits = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.PAYMENT_CORE,
        abi: PAYMENT_CORE_ABI,
        functionName: 'safetyLimits',
        args: [address],
      }) as any;

      if (limits) {
        dailyCap = limits[0];
        perTxCap = limits[1];
        spentToday = limits[2];
        pendingDailyCap = limits[4];
        pendingPerTxCap = limits[5];
        pendingDailyTimelock = Number(limits[6]);
        pendingPerTxTimelock = Number(limits[7]);
        isLimitsConfigured = limits[8];
      }

      effectiveRemaining = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.PAYMENT_CORE,
        abi: PAYMENT_CORE_ABI,
        functionName: 'getEffectiveRemainingDailySpend',
        args: [address],
      }) as bigint;
    } catch (e) {
      // Contract might not be deployed yet on live testnet or fresh account
    }

    return {
      btcBalance: formatUnits(btcBal, 18),
      btcBalanceRaw: btcBal,
      musdBalance: formatUnits(musdBal, 18),
      musdBalanceRaw: musdBal,
      allowance: formatUnits(allowance, 18),
      allowanceRaw: allowance,
      isLimitsConfigured,
      dailyCap: formatUnits(dailyCap, 18),
      perTxCap: formatUnits(perTxCap, 18),
      spentToday: formatUnits(spentToday, 18),
      effectiveRemainingDailySpend: formatUnits(effectiveRemaining, 18),
      pendingDailyCap: formatUnits(pendingDailyCap, 18),
      pendingPerTxCap: formatUnits(pendingPerTxCap, 18),
      pendingDailyTimelock,
      pendingPerTxTimelock,
    };
  } catch (err) {
    console.warn('Failed to fetch account state:', err);
    return {
      btcBalance: '0.0',
      btcBalanceRaw: 0n,
      musdBalance: '0.0',
      musdBalanceRaw: 0n,
      allowance: '0.0',
      allowanceRaw: 0n,
      isLimitsConfigured: false,
      dailyCap: '0.0',
      perTxCap: '0.0',
      spentToday: '0.0',
      effectiveRemainingDailySpend: '0.0',
      pendingDailyCap: '0.0',
      pendingPerTxCap: '0.0',
      pendingDailyTimelock: 0,
      pendingPerTxTimelock: 0,
    };
  }
}

/**
 * Creates and cryptographically signs a dynamic merchant payment invoice QR.
 * ZERO merchant gas required!
 */
export async function createMerchantPaymentIntent(
  merchantWalletClient: any,
  amountMUSD: string,
  note: string,
  appUrl: string = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('capacitor://')
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL || 'https://mezopay.vercel.app')
) {
  const amountWei = parseUnits(amountMUSD, 18);
  const expiry = Math.floor(Date.now() / 1000) + (30 * 60); // 30 minutes
  
  // Random 32-byte salt
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const salt = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

  const merchantAddress = merchantWalletClient.account.address;

  // Compute reference hash matching contract
  const refHash = keccak256(
    encodePacked(
      ['uint256', 'address', 'address', 'uint256', 'uint64', 'bytes32'],
      [BigInt(31611), CONTRACT_ADDRESSES.PAYMENT_CORE, merchantAddress, amountWei, BigInt(expiry), salt]
    )
  );

  // Sign reference hash with merchant wallet using personal_sign
  const signature = await merchantWalletClient.signMessage({
    message: { raw: refHash },
  });

  // Construct universal scan URL
  const params = new URLSearchParams({
    chain: '31611',
    token: CONTRACT_ADDRESSES.MUSD,
    addr: merchantAddress,
    amount: amountMUSD,
    exp: expiry.toString(),
    salt: salt,
    sig: signature,
    note: note,
  });

  const paymentUrl = `${appUrl}/pay?${params.toString()}`;

  return {
    paymentUrl,
    refHash,
    salt,
    expiry,
    amountMUSD,
    signature,
    merchantAddress,
  };
}

/**
 * Reads live BTC/USD price from Mezo native PriceFeed oracle purely via a simulated readContract call (eth_call).
 * Zero gas, zero transaction broadcast.
 */
export async function getLiveOraclePriceUSD(): Promise<number> {
  try {
    const rawPrice = (await publicClient.readContract({
      address: CONTRACT_ADDRESSES.PRICE_FEED,
      abi: PRICE_FEED_ABI,
      functionName: 'fetchPrice',
    })) as bigint;
    return Number(formatUnits(rawPrice, 18));
  } catch (err) {
    console.warn('PriceFeed fetchPrice simulated call error:', err);
    try {
      const fallbackPrice = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.PRICE_FEED,
        abi: PRICE_FEED_ABI,
        functionName: 'lastGoodPrice',
      })) as bigint;
      return Number(formatUnits(fallbackPrice, 18));
    } catch {
      return 0;
    }
  }
}

export interface PaymentGasEstimateParams {
  account?: `0x${string}`;
  to?: `0x${string}`;
  amountMUSD?: string;
  note?: string;
  isDynamic?: boolean;
  merchant?: `0x${string}`;
  expiry?: number;
  salt?: `0x${string}`;
  signature?: `0x${string}`;
}

export interface GasEstimateFailure {
  type: 'NO_BTC_FOR_GAS' | 'ALLOWANCE_TOO_LOW' | 'LIMITS_NOT_SET' | 'LIMIT_EXCEEDED' | 'SIMULATION_REVERTED';
  message: string;
}

export interface GasEstimateResult {
  gasLimit: string;
  gasPriceGwei: string;
  estimatedFeeBTC: string;
  estimatedFeeUSD: string;
  oracleBtcPriceUSD: string | null;
  failure?: GasEstimateFailure;
}

/**
 * Estimates contract gas for the actual payment transaction call on Mezo Testnet.
 * Uses publicClient.estimateContractGas for payDirect or payReference.
 * Diagnoses specific failure causes (no BTC for gas, allowance too low, limits not set)
 * and returns specific error guidance for the UI pay sheet.
 */
export async function estimateGasFee(
  params?: PaymentGasEstimateParams
): Promise<GasEstimateResult> {
  const gasPrice = await publicClient.getGasPrice();
  let estimatedGas = 0n;
  let failure: GasEstimateFailure | undefined;

  if (params && params.account) {
    const amountWei = params.amountMUSD ? parseUnits(params.amountMUSD, 18) : 1000000000000000000n; // 1 MUSD
    const note = params.note || 'Payment';

    // Pre-flight checks to determine exact failure cause
    try {
      // 1. Check native BTC balance for gas fees
      const btcBalance = await publicClient.getBalance({ address: params.account });
      // Typical gas fee is ~150,000 * gasPrice
      const minGasFeeEstimate = gasPrice * 150000n;
      if (btcBalance < minGasFeeEstimate) {
        failure = {
          type: 'NO_BTC_FOR_GAS',
          message: 'No BTC for gas: Your wallet has insufficient native Bitcoin balance to pay network transaction gas fees. Please deposit testnet BTC.',
        };
      }

      // 2. Check MUSD allowance
      const allowance = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.MUSD,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [params.account, CONTRACT_ADDRESSES.PAYMENT_CORE],
      }) as bigint;

      if (!failure && allowance < amountWei) {
        failure = {
          type: 'ALLOWANCE_TOO_LOW',
          message: `Allowance too low: MUSD allowance (${formatUnits(allowance, 18)} MUSD) is less than required payment (${params.amountMUSD || '1.00'} MUSD). Please refresh allowance.`,
        };
      }

      // 3. Check Safety Limits on MezoPaymentCore
      const limits = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.PAYMENT_CORE,
        abi: PAYMENT_CORE_ABI,
        functionName: 'limits',
        args: [params.account],
      }) as [bigint, bigint, bigint, bigint, bigint, bigint];

      const dailyCap = limits[0];
      const perTxCap = limits[1];
      const spentToday = limits[4];

      if (!failure) {
        if (dailyCap === 0n) {
          failure = {
            type: 'LIMITS_NOT_SET',
            message: 'Spending limits not set: MezoPaymentCore requires safety spending limits to be configured before making payments. Please set your daily limit in Settings.',
          };
        } else if (amountWei > perTxCap) {
          failure = {
            type: 'LIMIT_EXCEEDED',
            message: `Transaction limit exceeded: Payment exceeds your per-transaction cap of ${formatUnits(perTxCap, 18)} MUSD.`,
          };
        } else if (spentToday + amountWei > dailyCap) {
          const remaining = dailyCap > spentToday ? dailyCap - spentToday : 0n;
          failure = {
            type: 'LIMIT_EXCEEDED',
            message: `Daily limit exceeded: Payment exceeds your remaining daily limit of ${formatUnits(remaining, 18)} MUSD.`,
          };
        }
      }

      // Attempt EVM gas estimation
      if (params.isDynamic && params.merchant && params.expiry && params.salt && params.signature) {
        estimatedGas = await publicClient.estimateContractGas({
          account: params.account,
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'payReference',
          args: [
            params.merchant,
            amountWei,
            BigInt(params.expiry),
            params.salt,
            note,
            params.signature,
          ],
        });
      } else if (params.to) {
        estimatedGas = await publicClient.estimateContractGas({
          account: params.account,
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          abi: PAYMENT_CORE_ABI,
          functionName: 'payDirect',
          args: [params.to, amountWei, note],
        });
      }
    } catch (gasErr: any) {
      console.warn('estimateContractGas simulation reverted:', gasErr?.message || gasErr);
      if (!failure) {
        const revertReason = gasErr.shortMessage || gasErr.message || 'Transaction simulation reverted';
        failure = {
          type: 'SIMULATION_REVERTED',
          message: `Gas simulation failed: ${revertReason}`,
        };
      }
    }
  }

  // If specific call simulation was not available or reverted due to pre-payment state, use actual measured gas bounds
  if (estimatedGas === 0n) {
    estimatedGas = 128500n; // Measured from foundry payDirect test execution
  }

  // Add 15% safety buffer for state fluctuations
  const finalGasLimit = (estimatedGas * 115n) / 100n;
  const feeWei = gasPrice * finalGasLimit;
  const feeBTC = formatUnits(feeWei, 18);
  const gasPriceGwei = formatUnits(gasPrice, 9);

  // Read oracle price through simulated call
  const oraclePrice = await getLiveOraclePriceUSD();
  const feeUSD = oraclePrice > 0 ? (Number(feeBTC) * oraclePrice).toFixed(4) : null;

  return {
    gasLimit: finalGasLimit.toString(),
    gasPriceGwei: Number(gasPriceGwei).toFixed(2),
    estimatedFeeBTC: `${Number(feeBTC) < 0.000001 ? '< 0.000001' : Number(feeBTC).toFixed(6)} BTC (estimated)`,
    estimatedFeeUSD: feeUSD ? `~$${feeUSD} USD (estimated)` : 'Estimated price unavailable',
    oracleBtcPriceUSD: oraclePrice > 0 ? `$${oraclePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : null,
    failure,
  };
}
