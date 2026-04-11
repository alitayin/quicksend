import { getUtxos, selectUtxos } from '../utxo/utxo-utils';
import { initializeWallet } from '../wallet/wallet-utils';
import { buildTransactionInputs, createP2pkhScript } from '../transaction/transaction-utils';
import { buildAndBroadcastTransaction, verifyFee } from '../transaction/transaction-builder';
import { TransactionResult, XecTransactionOptions } from '../types';
import { buildXecAppActionOutput } from './xec-app-action';

// Extended recipient interface supporting tokens
interface ExtendedRecipient {
  address: string;
  amount: bigint;
  tokenId?: string;
}

// XEC specific transaction result
interface XecTransactionResult extends TransactionResult {
  utxoSelection: any;
  recipients: number;
  xecRecipients: number;
  tokenRecipients: number;
  totalSent: bigint;
  tokenTransfers: Array<{
    tokenId: string;
    amount: bigint;
    address: string;
  }>;
}

export async function createRawXecTransaction(
  recipients: ExtendedRecipient[], 
  options: XecTransactionOptions = {},
): Promise<XecTransactionResult> {
  try {
    const {
      utxoStrategy = 'all',
      addressIndex = 0,
      mnemonic,
      chronik: chronikClient,
      message,
      appPrefixHex,
    } = options;

    // Validate parameters
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('recipients must be a non-empty array');
    }

    // Validate each recipient
    for (const recipient of recipients) {
      if (!recipient.address || typeof recipient.amount !== 'bigint') {
        throw new Error('Each recipient must have address and amount (bigint) fields');
      }

      if (recipient.tokenId && typeof recipient.tokenId !== 'string') {
        throw new Error('tokenId must be a string if provided');
      }
    }

    // Initialize wallet
    const { walletSk, walletPk, walletP2pkh, address: utxoAddress } = initializeWallet(addressIndex, mnemonic);

    const utxos = await getUtxos(utxoAddress, chronikClient);
    if (utxos.length === 0) {
      throw new Error(`No UTXOs found for address index ${addressIndex}`);
    }

    // Calculate total XEC amount (excluding tokens)
    const totalSendAmount: bigint = recipients
      .filter(recipient => !recipient.tokenId)
      .reduce((sum, recipient) => sum + recipient.amount, 0n);

    // Analyze transaction type
    const xecRecipients: ExtendedRecipient[] = recipients.filter(r => !r.tokenId);
    const tokenRecipients: ExtendedRecipient[] = recipients.filter(r => r.tokenId);

        // Select UTXOs
    const utxoSelection = selectUtxos(utxos, Number(totalSendAmount), utxoStrategy);
    const { selectedUtxos } = utxoSelection;

    // Build transaction inputs
    const inputs = buildTransactionInputs(selectedUtxos, walletP2pkh, walletSk, walletPk);

    // Build transaction outputs
    const outputs: any[] = [];

    if (typeof message !== 'undefined' || typeof appPrefixHex !== 'undefined') {
      outputs.push(buildXecAppActionOutput({ message, appPrefixHex }));
    }

    recipients.forEach(recipient => {
      const output: any = {
        sats: BigInt(recipient.amount),
        script: createP2pkhScript(recipient.address)
      };

      if (recipient.tokenId) {
        output.tokenId = recipient.tokenId;
      }

      outputs.push(output);
    });

    // Add change output
    outputs.push(walletP2pkh);

    // Verify fee with EccDummy
    verifyFee(selectedUtxos, outputs);

    // Build and broadcast transaction
    const result = await buildAndBroadcastTransaction(inputs, outputs, { chronik: chronikClient });
    
    return {
      ...result,
      utxoSelection,
      recipients: recipients.length,
      xecRecipients: xecRecipients.length,
      tokenRecipients: tokenRecipients.length,
      totalSent: totalSendAmount,
      tokenTransfers: tokenRecipients.map(r => ({
        tokenId: r.tokenId!,
        amount: r.amount,
        address: r.address
      }))
    };

  } catch (error) {
    console.error('XEC transaction creation failed:', error);
    throw error;
  }
} 
