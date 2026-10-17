import { publicClient } from './web3';
import { CONTRACT_ADDRESSES, NAME_REGISTRY_ABI } from '../config/contracts';

const RESERVED_NAMES = new Set(['admin', 'mezo', 'support', 'system', 'faucet', 'treasury', 'mod']);

export function normalizeHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/@mezo$/i, '')
    .replace(/^@/, '')
    .trim();
}

export function validateHandle(handle: string): { valid: boolean; error?: string } {
  const normalized = normalizeHandle(handle);
  if (normalized.length < 3) {
    return { valid: false, error: 'Handle must be at least 3 characters.' };
  }
  if (normalized.length > 20) {
    return { valid: false, error: 'Handle cannot exceed 20 characters.' };
  }
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return { valid: false, error: 'Handle can only contain lowercase letters (a-z), numbers (0-9), and underscores (_).' };
  }
  if (RESERVED_NAMES.has(normalized)) {
    return { valid: false, error: `"${normalized}" is a reserved system handle.` };
  }
  return { valid: true };
}

export async function lookupName(name: string): Promise<`0x${string}` | null> {
  try {
    const cleanName = normalizeHandle(name);
    const address = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.NAME_REGISTRY,
      abi: NAME_REGISTRY_ABI,
      functionName: 'resolveName',
      args: [cleanName],
    }) as `0x${string}`;

    if (address && address !== '0x0000000000000000000000000000000000000000') {
      return address;
    }
    return null;
  } catch (err) {
    console.warn('Name lookup failed:', err);
    return null;
  }
}

export async function lookupAddress(address: `0x${string}`): Promise<string | null> {
  try {
    const name = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.NAME_REGISTRY,
      abi: NAME_REGISTRY_ABI,
      functionName: 'resolveAddress',
      args: [address],
    }) as string;

    if (name && name.length > 0) {
      return name;
    }
    return null;
  } catch (err) {
    console.warn('Address lookup failed:', err);
    return null;
  }
}

export async function checkNameAvailability(name: string): Promise<boolean> {
  try {
    const cleanName = normalizeHandle(name);
    const validation = validateHandle(cleanName);
    if (!validation.valid) return false;

    const isAvail = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.NAME_REGISTRY,
      abi: NAME_REGISTRY_ABI,
      functionName: 'isNameAvailable',
      args: [cleanName],
    }) as boolean;
    return isAvail;
  } catch (err) {
    console.warn('Name availability check failed:', err);
    return false;
  }
}

export async function registerNameOnChain(
  name: string, 
  walletClient: any, 
  userAddress?: `0x${string}`
): Promise<`0x${string}` | null> {
  const cleanName = normalizeHandle(name);
  const validation = validateHandle(cleanName);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  try {
    const account = userAddress || walletClient.account;
    const txHash = await walletClient.writeContract({
      ...(account ? { account } : {}),
      address: CONTRACT_ADDRESSES.NAME_REGISTRY,
      abi: NAME_REGISTRY_ABI,
      functionName: 'registerName',
      args: [cleanName],
    });
    return txHash;
  } catch (err) {
    console.error('Failed to register name on chain:', err);
    throw err;
  }
}
