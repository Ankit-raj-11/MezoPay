import { publicClient } from './web3';
import { CONTRACT_ADDRESSES, NAME_REGISTRY_ABI } from '../config/contracts';

export async function lookupName(name: string): Promise<`0x${string}` | null> {
  try {
    const cleanName = name.replace('@mezo', '').toLowerCase().trim();
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
    const cleanName = name.replace('@mezo', '').toLowerCase().trim();
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
