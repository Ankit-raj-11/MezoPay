import { generateMnemonic, mnemonicToAccount, english, type HDAccount } from 'viem/accounts';

export interface StoredVault {
  version: 1;
  address: `0x${string}`;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
}

export interface UnlockedWallet {
  mnemonic: string;
  address: `0x${string}`;
  account: HDAccount;
}

const STORAGE_KEY = 'mezopay_vault_v1';

// Helper: Convert Uint8Array to Hex string
function bufToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert Hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a user PIN using PBKDF2 (600,000 iterations).
 */
async function deriveAesKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Checks if an encrypted wallet vault already exists on this device.
 */
export function hasVault(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * Returns the public address of the stored vault without unlocking the private key.
 */
export function getStoredVaultAddress(): `0x${string}` | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const vault = JSON.parse(raw) as StoredVault;
    return vault.address || null;
  } catch {
    return null;
  }
}

/**
 * Creates a new encrypted wallet vault.
 * If customMnemonic is provided, restores that wallet; otherwise generates a new 12-word phrase.
 */
export async function createVault(pin: string, customMnemonic?: string): Promise<UnlockedWallet> {
  if (!pin || pin.length < 6) {
    throw new Error('App lock PIN must be at least 6 digits.');
  }
  const mnemonic = customMnemonic ? customMnemonic.trim().toLowerCase() : generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);
  const address = account.address;

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(pin, salt);

  const payload = JSON.stringify({ mnemonic, address });
  const encodedPayload = new TextEncoder().encode(payload);

  const ciphertextBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    encodedPayload as unknown as BufferSource
  );

  const vault: StoredVault = {
    version: 1,
    address,
    saltHex: bufToHex(salt),
    ivHex: bufToHex(iv),
    ciphertextHex: bufToHex(new Uint8Array(ciphertextBuf)),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  return { mnemonic, address, account };
}

/**
 * Unlocks the encrypted wallet vault using the user's App lock PIN.
 * Throws an error if the PIN is incorrect.
 */
export async function unlockVault(pin: string): Promise<UnlockedWallet> {
  if (!pin || pin.length < 6) {
    throw new Error('App lock PIN must be at least 6 digits.');
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    throw new Error('No wallet vault found on this device. Please create or restore one.');
  }

  const vault = JSON.parse(raw) as StoredVault;
  const salt = hexToBuf(vault.saltHex);
  const iv = hexToBuf(vault.ivHex);
  const ciphertext = hexToBuf(vault.ciphertextHex);

  const aesKey = await deriveAesKey(pin, salt);

  try {
    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      aesKey,
      ciphertext as unknown as BufferSource
    );

    const decryptedStr = new TextDecoder().decode(decryptedBuf);
    const parsed = JSON.parse(decryptedStr);
    const mnemonic = parsed.mnemonic as string;
    const account = mnemonicToAccount(mnemonic);

    return {
      mnemonic,
      address: account.address,
      account,
    };
  } catch {
    throw new Error('Incorrect PIN. Authentication failed.');
  }
}

/**
 * Restores or resets a vault with a 12-word recovery phrase and sets a new PIN.
 */
export async function restoreVaultWithMnemonic(mnemonic: string, newPin: string): Promise<UnlockedWallet> {
  const trimmed = mnemonic.trim().toLowerCase();
  // Validates mnemonic format and word count
  const words = trimmed.split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    throw new Error('Recovery phrase must contain exactly 12 words (or 24 words).');
  }

  return createVault(newPin, trimmed);
}

/**
 * Deletes the stored encrypted vault from this device.
 */
export function deleteVault(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
