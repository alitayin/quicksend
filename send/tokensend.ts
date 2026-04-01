import * as ecashLib from "ecash-lib";

// SLP protocol limit: max 19 token outputs per tx (index 1–19, index 0 is OP_RETURN)
const SLP_MAX_SEND_OUTPUTS: number = (ecashLib as any).SLP_MAX_SEND_OUTPUTS ?? 19;
// ALP policy limit: max 29 token outputs per tx
const ALP_POLICY_MAX_OUTPUTS = 29;
import { getUtxos, selectSlpUtxos } from "../utxo/utxo-utils";
import { initializeWallet } from "../wallet/wallet-utils";
import { buildTransactionInputs, createP2pkhScript } from "../transaction/transaction-utils";
import {
  buildAndBroadcastTransaction,
  validateRequiredParams,
  verifyFee
} from "../transaction/transaction-builder";
import { Recipient, TokenTransactionOptions, TransactionResult, FeeStrategy, TokenStrategy } from "../types";

const { 
  Script, 
  SLP_FUNGIBLE,
  slpSend,
  ALP_STANDARD,
  alpSend,
  OP_RETURN,
  pushBytesOp,
  OP_RESERVED,
} = ecashLib;

/**
 * Build token transaction outputs (SLP/ALP common)
 */
function buildTokenOutputs(
  opReturnScript: any,
  recipients: Recipient[],
  tokenChange: bigint,
  dustLimit: number,
  walletP2pkh: any
): any[] {
  const outputs: any[] = [];

  outputs.push({ sats: 0n, script: opReturnScript });

  recipients.forEach(recipient => {
    outputs.push({
      sats: BigInt(dustLimit),
      script: createP2pkhScript(recipient.address),
    });
  });

  if (tokenChange > 0n) {
    outputs.push({ sats: BigInt(dustLimit), script: walletP2pkh });
  }

  outputs.push(walletP2pkh);

  return outputs;
}

function buildSlpOutputs(
  tokenId: string,
  finalSendAmounts: bigint[],
  recipients: Recipient[],
  tokenChange: bigint,
  dustLimit: number,
  walletP2pkh: any
): any[] {
  return buildTokenOutputs(
    slpSend(tokenId, SLP_FUNGIBLE, finalSendAmounts),
    recipients, tokenChange, dustLimit, walletP2pkh
  );
}

function buildAlpOutputs(
  tokenId: string,
  finalSendAmounts: bigint[],
  recipients: Recipient[],
  tokenChange: bigint,
  dustLimit: number,
  walletP2pkh: any
): any[] {
  const opReturnScript = Script.fromOps([
    OP_RETURN,
    OP_RESERVED,
    pushBytesOp(alpSend(tokenId, ALP_STANDARD, finalSendAmounts)),
  ]);
  return buildTokenOutputs(
    opReturnScript,
    recipients, tokenChange, dustLimit, walletP2pkh
  );
}


/**
 * General function to create token transactions
 */
async function createTokenTransaction(
  recipients: Recipient[], 
  options: TokenTransactionOptions, 
  tokenType: 'SLP' | 'ALP' = 'SLP'
): Promise<TransactionResult> {
  try {
    // Validate required parameters
    validateRequiredParams(options, [
      { key: 'tokenId', message: 'tokenId is required' },
    ]);

    // Validate recipient count limit
    const maxOutputs = tokenType === 'SLP' ? SLP_MAX_SEND_OUTPUTS : ALP_POLICY_MAX_OUTPUTS;
    if (recipients.length > maxOutputs) {
      throw new Error(
        `Too many recipients: ${tokenType} transactions support at most ${maxOutputs} token outputs per tx, but ${recipients.length} were provided.`
      );
    }

    const {
      tokenId,
      addressIndex = 0,
      feeStrategy = 'all',
      tokenStrategy = 'all',
      mnemonic,       chronik: chronikClient     } = options;

    if (!/^[0-9a-f]{64}$/.test(tokenId)) {
      throw new Error(`Invalid tokenId: must be a 64-character lowercase hex string, got "${tokenId}"`);
    }

    // Initialize wallet
    const { walletSk, walletPk, walletP2pkh, address: utxoAddress } = initializeWallet(addressIndex, mnemonic);
    
    const utxos = await getUtxos(utxoAddress, chronikClient);     if (utxos.length === 0) {
      throw new Error(`No UTXOs found for address index ${addressIndex}`);
    }

    // Select token UTXOs
    const tokenSelection = selectSlpUtxos(utxos, tokenId, recipients, {
      feeStrategy,
      tokenStrategy
    });

    const {
      selectedTokenUtxos,
      selectedFeeUtxos,
      finalSendAmounts,
      tokenChange,
      dustLimit,
      summary
    } = tokenSelection;

    // Build transaction inputs and outputs
    const inputs = buildTransactionInputs([selectedTokenUtxos, selectedFeeUtxos], walletP2pkh, walletSk, walletPk);

    let outputs: any[];
    if (tokenType === 'ALP') {
      outputs = buildAlpOutputs(tokenId, finalSendAmounts, recipients, tokenChange, dustLimit, walletP2pkh);
    } else {
      outputs = buildSlpOutputs(tokenId, finalSendAmounts, recipients, tokenChange, dustLimit, walletP2pkh);
    }

    // Verify fee with EccDummy
    verifyFee([...selectedTokenUtxos, ...selectedFeeUtxos], outputs);

    // Build and broadcast transaction
    return await buildAndBroadcastTransaction(inputs, outputs, { dustLimit, chronik: chronikClient });

  } catch (error) {
    console.error(`${tokenType} transaction creation failed:`, error);
    throw error;
  }
}

/**
 * Create SLP token transaction
 */
export async function createRawSlpTransaction(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
  return createTokenTransaction(recipients, options, 'SLP');
}

/**
 * Create ALP token transaction
 */
export async function createRawAlpTransaction(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
  return createTokenTransaction(recipients, options, 'ALP');
} 