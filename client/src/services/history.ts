import { formatUnits, parseAbiItem } from 'viem';
import { publicClient } from './web3';
import { CONTRACT_ADDRESSES, PAYMENT_CORE_DEPLOY_BLOCK } from '../config/contracts';
import { lookupAddress } from './names';

export interface ActivityItem {
  id: string;
  type: 'sent' | 'received';
  amount: string;
  target: string;
  note: string;
  timestamp: string;
  txHash?: string;
  blockNumber?: bigint;
}

export interface ContactItem {
  handle: string;
  address: string;
}

const CHUNK_SIZE = 2000n;

const PAYMENT_ANNOUNCED_EVENT = parseAbiItem(
  'event PaymentAnnounced(address indexed payer, address indexed payee, bytes32 indexed ref, uint256 amount, string note, uint256 timestamp)'
);

/**
 * Fetches real on-chain payment activity and contacts for an account.
 * Reads PaymentAnnounced logs from the deployment block to latest in 2,000-block chunks.
 */
export async function fetchLiveActivity(
  userAddress: `0x${string}`
): Promise<{ activities: ActivityItem[]; contacts: ContactItem[] }> {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = PAYMENT_CORE_DEPLOY_BLOCK;
    const toBlock = currentBlock;

    const allLogs: any[] = [];

    // Query in 2,000-block slices to prevent RPC range throttling
    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
      const end = start + CHUNK_SIZE - 1n > toBlock ? toBlock : start + CHUNK_SIZE - 1n;
      try {
        const chunkLogs = await publicClient.getLogs({
          address: CONTRACT_ADDRESSES.PAYMENT_CORE,
          event: PAYMENT_ANNOUNCED_EVENT,
          fromBlock: start,
          toBlock: end,
        });
        allLogs.push(...chunkLogs);
      } catch (err) {
        console.warn(`Log chunk [${start}..${end}] query warning:`, err);
      }
    }

    const userLower = userAddress.toLowerCase();
    const userLogs = allLogs.filter((log) => {
      const payer = log.args.payer?.toLowerCase();
      const payee = log.args.payee?.toLowerCase();
      return payer === userLower || payee === userLower;
    });

    // Sort newest to oldest
    userLogs.sort((a, b) => Number(b.blockNumber - a.blockNumber));

    const activities: ActivityItem[] = [];
    const contactMap = new Map<string, string>();

    for (const log of userLogs) {
      const isSent = log.args.payer?.toLowerCase() === userLower;
      const otherParty = (isSent ? log.args.payee : log.args.payer) as `0x${string}`;
      const amountStr = formatUnits(log.args.amount || 0n, 18);
      const timestampSec = Number(log.args.timestamp || 0n);
      const dateStr = timestampSec > 0 ? new Date(timestampSec * 1000).toLocaleString() : 'Recent';

      // Truncated address label
      const targetShort = `${otherParty.slice(0, 6)}...${otherParty.slice(-4)}`;

      activities.push({
        id: `${log.transactionHash}-${log.logIndex}`,
        type: isSent ? 'sent' : 'received',
        amount: Number(amountStr).toFixed(2),
        target: targetShort,
        note: log.args.note || (isSent ? 'Sent payment' : 'Received payment'),
        timestamp: dateStr,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });

      if (!contactMap.has(otherParty.toLowerCase())) {
        contactMap.set(otherParty.toLowerCase(), otherParty);
      }
    }

    // Resolve contacts on-chain in parallel
    const contacts: ContactItem[] = await Promise.all(
      Array.from(contactMap.values()).map(async (addr) => {
        let handle = '';
        try {
          const registered = await lookupAddress(addr as `0x${string}`);
          if (registered) handle = registered;
        } catch {}
        return { handle, address: addr };
      })
    );

    return { activities, contacts };
  } catch (err) {
    console.error('Failed to fetch on-chain activity history:', err);
    return { activities: [], contacts: [] };
  }
}
