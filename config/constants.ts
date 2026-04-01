import { deriveBuyerKey } from '../wallet/mnemonic-utils';

/**
 * Application configuration constants
 */
export const CONFIG = {
  // Wallet config - only mnemonic required
  MNEMONIC: process.env.MNEMONIC,
};

/**
 * Validate required environment variables
 */
export function validateConfig(): void {
  if (!CONFIG.MNEMONIC) {
    throw new Error('MNEMONIC environment variable must be set');
  }
}

/**
 * Get mnemonic from environment variables
 * Returns null if not set
 */
export function getMnemonic(): string | null {
  return CONFIG.MNEMONIC || null;
}

/**
 * Get wallet private key WIF (derived from mnemonic)
 * @param addressIndex - Address index (default 0)
 * @param mnemonic - Optional mnemonic override
 */
export function getPrivateKeyWIF(addressIndex: number = 0, mnemonic?: string): string {
  const finalMnemonic = mnemonic || getMnemonic();
  if (!finalMnemonic) {
    throw new Error('Mnemonic not set: please set the MNEMONIC environment variable or provide it as a parameter');
  }
  const derived = deriveBuyerKey(finalMnemonic, addressIndex);
  return derived.wif;
}

/**
 * Get default UTXO address (derived from mnemonic)
 * @param addressIndex - Address index (default 0)
 * @param mnemonic - Optional mnemonic override
 */
export function getDefaultUtxoAddress(addressIndex: number = 0, mnemonic?: string): string {
  const finalMnemonic = mnemonic || getMnemonic();
  if (!finalMnemonic) {
    throw new Error('Mnemonic not set: please set the MNEMONIC environment variable or provide it as a parameter');
  }
  const derived = deriveBuyerKey(finalMnemonic, addressIndex);
  return derived.address;
} 