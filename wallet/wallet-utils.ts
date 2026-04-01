import { getMnemonic } from '../config/constants';
import { deriveBuyerKey } from './mnemonic-utils';
import * as wif from 'wif';
import { Ecc, Script, fromHex, shaRmd160 } from 'ecash-lib';

// Module-level singleton to avoid re-initializing Ecc
const ecc = new Ecc();

// Wallet information interface
interface WalletInfo {
  ecc: Ecc;
  walletSk: Uint8Array;
  walletPk: Uint8Array;
  walletPkh: Uint8Array;
  walletP2pkh: Script;
  address: string;
  addressIndex: number;
}

/**
 * Initialize wallet - optimized version, calls deriveBuyerKey once
 * @param addressIndex - Address index (default 0)
 * @param mnemonic - Optional mnemonic; if not provided, uses environment variable
 * @returns Wallet keys, scripts, and address
 */
export function initializeWallet(addressIndex: number = 0, mnemonic?: string): WalletInfo {
  const finalMnemonic = mnemonic || getMnemonic();

  if (!finalMnemonic) {
    throw new Error('Mnemonic not set: please set the MNEMONIC environment variable or provide it as a parameter');
  }

  // Call deriveBuyerKey once to get full info
  const derived = deriveBuyerKey(finalMnemonic, addressIndex);
  
  const decoded = wif.decode(derived.wif);
  const privateKey = decoded.privateKey;
  const privateKeyHex = Buffer.from(privateKey).toString('hex');
  const walletSk = fromHex(privateKeyHex);
  const walletPk = ecc.derivePubkey(walletSk);
  const walletPkh = shaRmd160(walletPk);
  const walletP2pkh = Script.p2pkh(walletPkh);

  return {
    ecc,
    walletSk,
    walletPk,
    walletPkh,
    walletP2pkh,
    address: derived.address,
    addressIndex
  };
} 