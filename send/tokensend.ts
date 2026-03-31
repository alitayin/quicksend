import dotenv from "dotenv";
dotenv.config();

import * as ecashLib from "ecash-lib";
import { getUtxos, selectSlpUtxos } from "../utxo/utxo-utils";
import { initializeWallet } from "../wallet/wallet-utils";
import { buildTransactionInputs, createP2pkhScript } from "../transaction/transaction-utils";
import {
  buildAndBroadcastTransaction,
  validateRequiredParams,
  verifyFee
} from "../transaction/transaction-builder";
import { Recipient, TokenTransactionOptions, TransactionResult } from "../types";

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
 * 构建代币交易输出（SLP/ALP 共用）
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
 * 创建代币交易的通用函数
 */
async function createTokenTransaction(
  recipients: Recipient[], 
  options: TokenTransactionOptions, 
  tokenType: 'SLP' | 'ALP' = 'SLP'
): Promise<TransactionResult> {
  try {
    // 验证必需参数
    validateRequiredParams(options, [
      { key: 'tokenId', message: 'tokenId is required' },
      { key: 'tokenDecimals', message: 'tokenDecimals is required', checkUndefined: true }
    ]);

    const { 
      tokenId, 
      tokenDecimals, 
      addressIndex = 0,
      feeStrategy = 'all', 
      tokenStrategy = 'all',
      mnemonic, // 从选项中提取助记词
      chronik: chronikClient // 新增：从选项中提取chronik客户端
    } = options;

    // 初始化钱包 - 使用指定的地址索引和可选的助记词
    const { walletSk, walletPk, walletP2pkh, address: utxoAddress } = initializeWallet(addressIndex, mnemonic);
    
    const utxos = await getUtxos(utxoAddress, chronikClient); // 传递chronik客户端
    if (utxos.length === 0) {
      throw new Error(`No UTXOs found for address index ${addressIndex}`);
    }

    // 选择代币UTXOs
    const tokenSelection = selectSlpUtxos(utxos, tokenId, recipients, tokenDecimals, {
      feeStrategy: feeStrategy as any,
      tokenStrategy: tokenStrategy as any
    });

    const {
      selectedTokenUtxos,
      selectedFeeUtxos,
      finalSendAmounts,
      tokenChange,
      dustLimit,
      summary
    } = tokenSelection;

    // 构建交易输入和输出
    const inputs = buildTransactionInputs([selectedTokenUtxos, selectedFeeUtxos], walletP2pkh, walletSk, walletPk);
    
    let outputs: any[];
    if (tokenType === 'ALP') {
      outputs = buildAlpOutputs(tokenId, finalSendAmounts, recipients, tokenChange, dustLimit, walletP2pkh);
    } else {
      outputs = buildSlpOutputs(tokenId, finalSendAmounts, recipients, tokenChange, dustLimit, walletP2pkh);
    }

    // 用 EccDummy 验证输入能覆盖输出 + 真实手续费（保守上界）
    verifyFee([...selectedTokenUtxos, ...selectedFeeUtxos], outputs);

    // 构建并广播交易
    return await buildAndBroadcastTransaction(inputs, outputs, { dustLimit, chronik: chronikClient });

  } catch (error) {
    console.error(`${tokenType} transaction creation failed:`, error);
    throw error;
  }
}

/**
 * 创建SLP代币交易
 */
export async function createRawSlpTransaction(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
  return createTokenTransaction(recipients, options, 'SLP');
}

/**
 * 创建ALP代币交易
 */
export async function createRawAlpTransaction(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
  return createTokenTransaction(recipients, options, 'ALP');
} 