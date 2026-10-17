import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mezoTestnet } from '../config/chains';

// Public RPC Client for Mezo Testnet
export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(),
});

// Demo Keypairs (Pre-configured for local testing & judging demo)
export const DEMO_PROFILES = [
  {
    id: 'alice',
    name: 'Alice (Payer)',
    handle: 'alice',
    privateKey: '0x6913dce743a9ef0302e1bb36f4dcd0e618cf5c43e8386413663a6bc7ebf7adb4' as `0x${string}`,
    address: '0x31156618e8DF8C2Aaa64f1B3ac6456F6AB77035B' as `0x${string}`,
    role: 'consumer',
  },
  {
    id: 'chaipoint',
    name: 'Chai Point (Merchant)',
    handle: 'chaipoint',
    privateKey: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d' as `0x${string}`,
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as `0x${string}`,
    role: 'merchant',
  },
  {
    id: 'bob',
    name: 'Bob (Splitter)',
    handle: 'bob',
    privateKey: '0x6cbed15c793ce57650b9877cf26f5d7d957170ee941980f82d8745670657b9e8' as `0x${string}`,
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as `0x${string}`,
    role: 'consumer',
  },
];

export function getWalletClientForPrivateKey(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: mezoTestnet,
    transport: http(),
  });
}

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
