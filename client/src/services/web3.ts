import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { mezoTestnet } from '../config/chains';

// Public RPC Client for Mezo Testnet
export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(),
});

/**
 * Creates a Viem WalletClient for an injected browser provider (MetaMask, Rabby, etc.)
 */
export function getInjectedWalletClient(account?: `0x${string}`) {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return createWalletClient({
      ...(account ? { account } : {}),
      chain: mezoTestnet,
      transport: custom((window as any).ethereum),
    });
  }
  return null;
}

/**
 * Creates a Viem WalletClient for an in-app device account (HDAccount / PrivateKeyAccount)
 */
export function getInAppWalletClient(account: any) {
  return createWalletClient({
    account,
    chain: mezoTestnet,
    transport: http(),
  });
}
