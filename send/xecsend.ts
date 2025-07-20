import dotenv from 'dotenv';
dotenv.config();

import { getUtxos, selectUtxos } from '../utxo/utxo-utils';
import { initializeWallet } from '../wallet/wallet-utils';
import { buildTransactionInputs, createP2pkhScript } from '../transaction/transaction-utils';
import { buildAndBroadcastTransaction, logTransactionSummary } from '../transaction/transaction-builder';
import { getDefaultUtxoAddress } from '../config/constants';
import { TransactionResult } from '../types';

// 扩展的接收方接口，支持代币交易
interface ExtendedRecipient {
  address: string;
  amount: number;
  tokenId?: string;
  decimals?: number;
}

// XEC交易特定的结果接口，扩展基础TransactionResult
interface XecTransactionResult extends TransactionResult {
  utxoSelection: any;
  recipients: number;
  xecRecipients: number;
  tokenRecipients: number;
  totalSent: number;
  tokenTransfers: Array<{
    tokenId: string;
    amount: number;
    decimals?: number;
    address: string;
  }>;
}

export async function createRawXecTransaction(
  recipients: ExtendedRecipient[], 
  utxoStrategy: string = 'all', 
  addressIndex: number = 0,
  mnemonic?: string // 新增：可选的助记词参数
): Promise<XecTransactionResult> {
  try {
    // 验证参数
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('recipients must be a non-empty array');
    }
    
    // 验证每个接收方对象
    for (const recipient of recipients) {
      if (!recipient.address || typeof recipient.amount !== 'number') {
        throw new Error('Each recipient must have address and amount fields');
      }
      
      // 如果提供了tokenId，验证其格式
      if (recipient.tokenId && typeof recipient.tokenId !== 'string') {
        throw new Error('tokenId must be a string if provided');
      }
      
      // 如果提供了decimals，验证其为非负整数
      if (recipient.decimals !== undefined && (!Number.isInteger(recipient.decimals) || recipient.decimals < 0)) {
        throw new Error('decimals must be a non-negative integer if provided');
      }
    }

    // 初始化钱包 - 使用指定的地址索引和可选的助记词
    const { walletSk, walletPk, walletP2pkh, address: utxoAddress } = initializeWallet(addressIndex, mnemonic);
    
    const utxos = await getUtxos(utxoAddress);
    if (utxos.length === 0) {
      throw new Error(`No UTXOs found for address index ${addressIndex}`);
    }

    // 计算总发送金额 (只计算XEC，不包括代币)
    const totalSendAmount: number = recipients
      .filter(recipient => !recipient.tokenId) // 只计算非代币交易
      .reduce((sum, recipient) => sum + recipient.amount, 0);

    // 分析交易类型
    const xecRecipients: ExtendedRecipient[] = recipients.filter(r => !r.tokenId);
    const tokenRecipients: ExtendedRecipient[] = recipients.filter(r => r.tokenId);

    // 选择UTXOs
    const utxoSelection = selectUtxos(utxos, totalSendAmount, utxoStrategy as any);
    const { selectedUtxos } = utxoSelection;

    // 记录交易摘要
    logTransactionSummary('XEC', {
      地址索引: addressIndex,
      策略: utxoStrategy,
      接收方数量: recipients.length,
      XEC接收方: xecRecipients.length,
      代币接收方: tokenRecipients.length,
      总发送金额: totalSendAmount,
      UTXOs数量: selectedUtxos.length,
      总输入: utxoSelection.totalInputValue,
      预估手续费: utxoSelection.estimatedFee,
      预计找零: utxoSelection.changeAmount
    });

    // 构建交易输入
    const inputs = buildTransactionInputs(selectedUtxos, walletP2pkh, walletSk, walletPk);
    
    // 构建交易输出 - 为每个接收方创建输出
    const outputs: any[] = [];
    
    // 添加所有接收方输出
    recipients.forEach(recipient => {
      const output: any = {
        sats: BigInt(recipient.amount),
        script: createP2pkhScript(recipient.address)
      };
      
      // 如果是代币交易，添加代币信息
      if (recipient.tokenId) {
        output.tokenId = recipient.tokenId;
        if (recipient.decimals !== undefined) {
          output.decimals = recipient.decimals;
        }
      }
      
      outputs.push(output);
    });
    
    // 添加找零脚本 - 保持原始逻辑！
    outputs.push(walletP2pkh);

    // 构建并广播交易
    const result = await buildAndBroadcastTransaction(inputs, outputs);
    
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
        decimals: r.decimals,
        address: r.address
      }))
    };

  } catch (error) {
    console.error('XEC transaction creation failed:', error);
    throw error;
  }
} 