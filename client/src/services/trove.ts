import { formatUnits } from 'viem';
import { publicClient } from './web3';
import { CONTRACT_ADDRESSES, TROVE_MANAGER_ABI, PRICE_FEED_ABI } from '../config/contracts';

export interface TroveMetrics {
  hasTrove: boolean;
  debtMUSD: string;
  debtMUSDRaw: bigint;
  collateralBTC: string;
  collateralBTCRaw: bigint;
  icrPercent: number;
  liquidationPriceUSD: string;
  btcPriceUSD: string;
  status: 'none' | 'healthy' | 'moderate' | 'risky' | 'liquidatable';
  statusText: string;
}

export async function fetchTroveMetrics(userAddress: `0x${string}`): Promise<TroveMetrics> {
  try {
    // 1. Fetch live BTC Oracle Price from PriceFeed
    let btcPriceRaw = 81300n * 10n ** 18n; // fallback ~81.3k
    try {
      btcPriceRaw = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.PRICE_FEED,
        abi: PRICE_FEED_ABI,
        functionName: 'lastGoodPrice',
      }) as bigint;
    } catch {
      // If lastGoodPrice fails, price remains fallback
    }

    const btcPriceUSD = Number(formatUnits(btcPriceRaw, 18)).toFixed(2);

    // 2. Fetch Trove Debt
    const debtRaw = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.TROVE_MANAGER,
      abi: TROVE_MANAGER_ABI,
      functionName: 'getTroveDebt',
      args: [userAddress],
    }) as bigint;

    // 3. Fetch Trove Collateral (Native BTC in trove)
    const collRaw = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.TROVE_MANAGER,
      abi: TROVE_MANAGER_ABI,
      functionName: 'getTroveColl',
      args: [userAddress],
    }) as bigint;

    if (debtRaw === 0n || collRaw === 0n) {
      return {
        hasTrove: false,
        debtMUSD: '0.0',
        debtMUSDRaw: 0n,
        collateralBTC: '0.0',
        collateralBTCRaw: 0n,
        icrPercent: 0,
        liquidationPriceUSD: '0.0',
        btcPriceUSD,
        status: 'none',
        statusText: 'No Active Trove',
      };
    }

    // 4. Fetch live ICR from TroveManager
    let icrRaw = 0n;
    try {
      icrRaw = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TROVE_MANAGER,
        abi: TROVE_MANAGER_ABI,
        functionName: 'getCurrentICR',
        args: [userAddress, btcPriceRaw],
      }) as bigint;
    } catch {
      // Calculate manually: (coll * price) / debt
      icrRaw = (collRaw * btcPriceRaw) / debtRaw;
    }

    const icrPercent = Number(formatUnits(icrRaw, 16)); // 1e18 ICR is 100% -> 1e16 gives percent

    // 5. Calculate Exact Liquidation Price: (Debt * 1.10) / Collateral
    // (debtRaw * 110) / (collRaw * 100)
    const liqPriceRaw = (debtRaw * 110n) / (collRaw > 0n ? collRaw : 1n);
    const liquidationPriceUSD = Number(formatUnits(liqPriceRaw, 18) || '0').toFixed(2);

    let status: 'healthy' | 'moderate' | 'risky' | 'liquidatable' = 'healthy';
    let statusText = 'Safe (ICR > 200%)';

    if (icrPercent < 110) {
      status = 'liquidatable';
      statusText = 'In Liquidation Danger (< 110%)';
    } else if (icrPercent < 150) {
      status = 'risky';
      statusText = 'Risky (Under 150% CCR)';
    } else if (icrPercent < 200) {
      status = 'moderate';
      statusText = 'Moderate (150% - 200%)';
    }

    return {
      hasTrove: true,
      debtMUSD: formatUnits(debtRaw, 18),
      debtMUSDRaw: debtRaw,
      collateralBTC: formatUnits(collRaw, 18),
      collateralBTCRaw: collRaw,
      icrPercent: Math.round(icrPercent),
      liquidationPriceUSD,
      btcPriceUSD,
      status,
      statusText,
    };
  } catch (err) {
    console.warn('Failed to fetch trove metrics:', err);
    return {
      hasTrove: false,
      debtMUSD: '0.0',
      debtMUSDRaw: 0n,
      collateralBTC: '0.0',
      collateralBTCRaw: 0n,
      icrPercent: 0,
      liquidationPriceUSD: '0.0',
      btcPriceUSD: '81,300.00',
      status: 'none',
      statusText: 'No Active Trove',
    };
  }
}
