import { chronik } from "../client/chronik-client";
import {
  TxBuilder, toHex, EccDummy, P2PKHSignatory, ALL_BIP143,
  DEFAULT_DUST_SATS, DEFAULT_FEE_SATS_PER_KB, fromHex, Script
} from "ecash-lib";
import { ChronikClient } from "chronik-client";
import { TransactionResult } from "../types";

// EccDummy uses a fixed maximum signature length (73 bytes) to ensure fee estimates are never too low
const _eccDummy = new EccDummy();
const _DUMMY_SK = fromHex('1122334455667788990011223344556677889900112233445566778899001122');
const _DUMMY_PK = _eccDummy.derivePubkey(_DUMMY_SK);
const _DUMMY_P2PKH = Script.p2pkh(new Uint8Array(20).fill(0x11));

/**
 * Verify UTXOs can cover outputs and fee using EccDummy.
 * EccDummy signature length is fixed to max (73 bytes), providing a conservative upper bound.
 * Throws before broadcasting if verification fails to save network requests.
 */
export function verifyFee(
  utxos: Array<{ value: number }>,
  outputs: any[],
  feePerKb: bigint = DEFAULT_FEE_SATS_PER_KB,
  dustSats: bigint = DEFAULT_DUST_SATS,
): void {
  const dummyInputs = utxos.map((utxo, i) => ({
    input: {
      prevOut: { txid: '00'.repeat(32), outIdx: i },
      signData: { sats: BigInt(utxo.value), outputScript: _DUMMY_P2PKH },
    },
    signatory: P2PKHSignatory(_DUMMY_SK, _DUMMY_PK, ALL_BIP143),
  }));

  try {
    const txBuilder = new TxBuilder({ inputs: dummyInputs, outputs });
    txBuilder.sign({ ecc: _eccDummy, feePerKb, dustSats });
  } catch (e) {
    throw new Error(
      `Insufficient balance to cover outputs and fee: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

// Transaction options interface
interface TransactionOptions {
  feePerKb?: bigint;
  dustSats?: bigint;
  dustLimit?: number;
  chronik?: ChronikClient;
}

// Required parameter configuration interface
interface RequiredParamConfig {
  key: string;
  message: string;
  checkUndefined?: boolean;
}

/**
 * General function to build and broadcast a transaction
 * @param inputs - Array of transaction inputs
 * @param outputs - Array of transaction outputs
 * @param options - Transaction options
 * @returns Object containing explorer link and transaction ID
 */
export async function buildAndBroadcastTransaction(
  inputs: any[], 
  outputs: any[], 
  options: TransactionOptions = {}
): Promise<TransactionResult> {
  const {
    feePerKb = 1000n,
    dustSats = 546n,
    dustLimit = 546,
    chronik: chronikClient   } = options;

  const client = chronikClient || chronik; // Use provided or default Chronik client

  try {
    // Build transaction
    const txBuild = new TxBuilder({ inputs, outputs });

    // Sign transaction
    const tx = txBuild.sign({
      feePerKb,
      dustSats: typeof dustSats === 'bigint' ? dustSats : BigInt(dustLimit)
    });

    // Serialize transaction
    const rawTxHex = toHex(tx.ser());

    // Broadcast transaction
    const { txids } = await client.broadcastTxs([rawTxHex]);
    if (!txids || txids.length === 0) {
      throw new Error("Empty Chronik broadcast response");
    }
    const txid = txids[0];

    return {
      explorerLink: `https://explorer.e.cash/tx/${txid}`,
      broadcastResult: txid,
      txid,
    };
  } catch (error) {
    console.error("Transaction build/broadcast failed:", error);
    throw error;
  }
}

/**
 * General function to validate required parameters
 * @param params - Parameter object
 * @param required - Array of required parameter configurations
 */
export function validateRequiredParams(params: any, required: RequiredParamConfig[]): void {
  for (const { key, message, checkUndefined } of required) {
    if (checkUndefined ? params[key] === undefined : !params[key]) {
      throw new Error(message);
    }
  }
}

/**
 * General function to log transaction summary
 * @param type - Transaction type
 * @param summary - Summary information
 */
export function logTransactionSummary(type: string, summary: any): void {
  // No-op or debug log removed for production cleanliness
}