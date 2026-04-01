import { mnemonicToSeed, HdNode, shaRmd160, Address } from 'ecash-lib';
import * as wif from 'wif';

// Derived key result interface
interface DerivedKey {
  wif: string;
  address: string;
  addressIndex: number;
  derivationPath: string;
}

/**
 * Derive WIF private key and address from mnemonic
 * @param mnemonic - Wallet mnemonic
 * @param addressIndex - Address index (default 0)
 * @param derivationPath - Base derivation path (default "m/44'/1899'/0'/0")
 * @returns Object containing wif and address
 */
export function deriveBuyerKey(
  mnemonic: string,
  addressIndex: number = 0,
  derivationPath: string = "m/44'/1899'/0'/0"
): DerivedKey {
  // Convert mnemonic to seed
  const seed = mnemonicToSeed(mnemonic);

  // Generate root HD node from seed
  const hdRoot = HdNode.fromSeed(seed);

  // Build full derivation path including index
  const fullDerivationPath = `${derivationPath}/${addressIndex}`;

  // Derive child node using path
  const childNode = hdRoot.derivePath(fullDerivationPath);

  // Get pubkey and create eCash address
  const pubkey = childNode.pubkey();
  const pubkeyHash = shaRmd160(pubkey);
  const ecashAddress = Address.p2pkh(pubkeyHash).toString();

  // Extract private key buffer
  const privateKeyBuffer = childNode.seckey();
  if (!privateKeyBuffer) {
    throw new Error('Failed to derive private key: seckey() returned undefined');
  }

  // Convert private key to WIF (0x80 is Bitcoin mainnet prefix)
  const buyerWIF = wif.encode({
    version: 0x80,
    privateKey: Buffer.from(privateKeyBuffer),
    compressed: true
  });
  
  return {
    wif: buyerWIF,
    address: ecashAddress,
    addressIndex: addressIndex,
    derivationPath: fullDerivationPath
  };
}

/**
 * Validate mnemonic format
 * @param mnemonic - Wallet mnemonic
 * @returns Whether the mnemonic is valid
 */
export function validateMnemonic(mnemonic: string | null | undefined): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return false;
  }

  const words = mnemonic.trim().split(/\s+/);
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    return false;
  }

  try {
    mnemonicToSeed(mnemonic.trim());
    return true;
  } catch {
    return false;
  }
} 