import { Address, Script, P2PKHSignatory, ALL_BIP143 } from 'ecash-lib';
import { Utxo } from '../types';

// Transaction input interface
interface TransactionInput {
  input: {
    prevOut: {
      txid: string;
      outIdx: number;
    };
    signData: {
      sats: bigint;
      outputScript: Script;
    };
  };
  signatory: ReturnType<typeof P2PKHSignatory>;
}

/**
 * Build transaction inputs - general function supporting single or multiple UTXO arrays
 * @param utxos - Single UTXO array or multiple UTXO arrays
 * @param walletP2pkh - Wallet script
 * @param walletSk - Private key
 * @param walletPk - Public key
 * @returns Transaction inputs array
 */
export function buildTransactionInputs(
  utxos: Utxo[] | Utxo[][],
  walletP2pkh: Script,
  walletSk: Uint8Array,
  walletPk: Uint8Array
): TransactionInput[] {
  // If multiple arrays are passed (e.g., tokenUtxos and feeUtxos for SLP), flatten them
  const allUtxos: Utxo[] = Array.isArray(utxos[0]) ? (utxos as Utxo[][]).flat() : utxos as Utxo[];
  
  return allUtxos.map(utxo => ({
    input: {
      prevOut: { txid: utxo.txid, outIdx: utxo.vout },
      signData: { sats: BigInt(utxo.value), outputScript: walletP2pkh },
    },
    signatory: P2PKHSignatory(walletSk, walletPk, ALL_BIP143),
  }));
}

/**
 * Create P2PKH script
 * @param address - eCash address
 * @returns P2PKH script
 */
export function createP2pkhScript(address: string): Script {
  try {
    const { hash } = Address.fromCashAddress(address);
    return Script.p2pkh(Buffer.from(hash, 'hex'));
  } catch (error) {
    throw new Error(`Invalid address: ${address}`);
  }
} 