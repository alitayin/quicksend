import dotenv from "dotenv";
dotenv.config();

import ecashLib from "ecash-lib";
import { getUtxos, selectSlpUtxos } from "../utxo/utxo-utils";
import { initializeWallet } from "../wallet/wallet-utils";
import { buildTransactionInputs, createP2pkhScript } from "../transaction/transaction-utils";
import { 
  buildAndBroadcastTransaction, 
  validateRequiredParams, 
  logTransactionSummary 
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
 * 构建SLP交易输出
 */
function buildSlpOutputs(
  tokenId: string, 
  finalSendAmounts: bigint[], 
  recipients: Recipient[], 
  tokenChange: bigint, 
  dustLimit: number, 
  walletP2pkh: any
): any[] {
  const outputs: any[] = [];
  
  // OP_RETURN 输出
  outputs.push({ sats: 0n, script: slpSend(tokenId, SLP_FUNGIBLE, finalSendAmounts) });
  
  // 接收方输出
  recipients.forEach(recipient => {
    outputs.push({ 
      sats: BigInt(dustLimit), 
      script: createP2pkhScript(recipient.address) 
    });
  });
  
  // Token 找零输出
  if (tokenChange > 0n) {
    outputs.push({ sats: BigInt(dustLimit), script: walletP2pkh });
  }
  
  // 手续费找零脚本 - 保持原始逻辑！直接push脚本
  outputs.push(walletP2pkh);
  
  return outputs;
}

/**
 * 构建ALP交易输出
 */
function buildAlpOutputs(
  tokenId: string, 
  finalSendAmounts: bigint[], 
  recipients: Recipient[], 
  tokenChange: bigint, 
  dustLimit: number, 
  walletP2pkh: any
): any[] {
  const outputs: any[] = [];
  
  // 构造完整的 OP_RETURN 脚本
  const opReturnPayload = alpSend(tokenId, ALP_STANDARD, finalSendAmounts);
  const opReturnScript = Script.fromOps([
    OP_RETURN,
    OP_RESERVED,
    pushBytesOp(opReturnPayload)
  ]);
  
  // OP_RETURN 输出
  outputs.push({ sats: 0n, script: opReturnScript });
  
  // 接收方输出
  recipients.forEach(recipient => {
    outputs.push({ 
      sats: BigInt(dustLimit), 
      script: createP2pkhScript(recipient.address) 
    });
  });
  
  // Token 找零输出
  if (tokenChange > 0n) {
    outputs.push({ sats: BigInt(dustLimit), script: walletP2pkh });
  }
  
  // 手续费找零脚本 - 保持原始逻辑！直接push脚本
  outputs.push(walletP2pkh);
  
  return outputs;
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

    // 记录交易摘要
    logTransactionSummary(tokenType, {
      地址索引: addressIndex,
      代币UTXOs数量: selectedTokenUtxos.length,
      手续费UTXOs数量: selectedFeeUtxos.length,
      接收方数量: recipients.length,
      代币找零: tokenChange > 0n ? tokenChange.toString() : '无',
      总输出数量: summary.totalOutputs
    });

    // 构建交易输入和输出
    const inputs = buildTransactionInputs([selectedTokenUtxos, selectedFeeUtxos], walletP2pkh, walletSk, walletPk);
    
    let outputs: any[];
    if (tokenType === 'ALP') {
      outputs = buildAlpOutputs(tokenId, finalSendAmounts, recipients, tokenChange, dustLimit, walletP2pkh);
    } else {
      outputs = buildSlpOutputs(tokenId, finalSendAmounts, recipients, tokenChange, dustLimit, walletP2pkh);
    }

    // 构建并广播交易
    return await buildAndBroadcastTransaction(inputs, outputs, { dustLimit, chronik: chronikClient }); // 传递chronik客户端

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