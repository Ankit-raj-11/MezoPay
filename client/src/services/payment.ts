import { parseUnits, formatUnits, keccak256, encodePacked } from 'viem';
import { publicClient } from './web3';
import { CONTRACT_ADDRESSES, ERC20_ABI, PAYMENT_CORE_ABI } from '../config/contracts';

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
  appUrl: string = window.location.origin
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
