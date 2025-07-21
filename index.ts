import { createRawSlpTransaction, createRawAlpTransaction } from './send/tokensend';
import { createRawXecTransaction } from './send/xecsend';
import { 
  Recipient, 
  TransactionResult, 
  TokenTransactionOptions, 
  XecOptions, 
  XecTransactionOptions,
  GeneralSendOptions,
  TransactionType 
} from './types';

/**
 * 统一交易管理器
 * 支持 SLP、ALP 和 XEC 交易类型
 */
class TransactionManager {
  /**
   * 发送 SLP 代币
   * @param recipients - 接收方数组
   * @param options - 交易选项（可包含助记词和chronik实例）
   */
  async sendSlp(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
    return await createRawSlpTransaction(recipients, options);
  }

  /**
   * 发送 ALP 代币
   * @param recipients - 接收方数组
   * @param options - 交易选项（可包含助记词和chronik实例）
   */
  async sendAlp(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
    return await createRawAlpTransaction(recipients, options);
  }

  /**
   * 发送 XEC (eCash)
   * @param recipients - 接收方数组
   * @param options - UTXO选择策略字符串或包含utxoStrategy、addressIndex、mnemonic和chronik的选项对象
   */
  async sendXec(recipients: Recipient[], options: XecOptions = 'all'): Promise<TransactionResult> {
    // 如果options是对象，提取相关参数；否则直接使用options作为策略
    let utxoStrategy: string;
    let addressIndex: number;
    let mnemonic: string | undefined;
    let chronikClient: any | undefined; // 新增：chronik客户端
    
    if (typeof options === 'object' && options !== null) {
      utxoStrategy = (options as XecTransactionOptions).utxoStrategy || 'all';
      addressIndex = (options as XecTransactionOptions).addressIndex || 0;
      mnemonic = (options as XecTransactionOptions).mnemonic;
      chronikClient = (options as XecTransactionOptions).chronik; // 提取chronik客户端
    } else {
      utxoStrategy = options as string;
      addressIndex = 0;
      mnemonic = undefined;
      chronikClient = undefined;
    }
    
    return await createRawXecTransaction(recipients, utxoStrategy, addressIndex, mnemonic, chronikClient);
  }

  /**
   * 通用发送方法
   * @param type - 交易类型
   * @param recipients - 接收方数组
   * @param options - 交易选项（可包含助记词和chronik实例）
   */
  async send(type: TransactionType, recipients: Recipient[], options: GeneralSendOptions = {}): Promise<TransactionResult> {
    switch (type.toLowerCase() as TransactionType) {
      case 'slp':
        if (!options.tokenId || !options.tokenDecimals) {
          throw new Error('SLP transactions require tokenId and tokenDecimals');
        }
        return await this.sendSlp(recipients, {
          tokenId: options.tokenId,
          tokenDecimals: options.tokenDecimals,
          addressIndex: options.addressIndex,
          feeStrategy: options.feeStrategy,
          tokenStrategy: options.tokenStrategy,
          mnemonic: options.mnemonic,
          chronik: options.chronik // 传递chronik客户端
        });
      case 'alp':
        if (!options.tokenId || !options.tokenDecimals) {
          throw new Error('ALP transactions require tokenId and tokenDecimals');
        }
        return await this.sendAlp(recipients, {
          tokenId: options.tokenId,
          tokenDecimals: options.tokenDecimals,
          addressIndex: options.addressIndex,
          feeStrategy: options.feeStrategy,
          tokenStrategy: options.tokenStrategy,
          mnemonic: options.mnemonic,
          chronik: options.chronik // 传递chronik客户端
        });
      case 'xec':
        const xecOptions: XecTransactionOptions = {
          utxoStrategy: options.utxoStrategy,
          addressIndex: options.addressIndex,
          mnemonic: options.mnemonic,
          chronik: options.chronik // 传递chronik客户端
        };
        return await this.sendXec(recipients, xecOptions);
      default:
        throw new Error(`Unsupported transaction type: ${type}`);
    }
  }
}

// 创建单例实例
const quick = new TransactionManager();

// 导出实例和类
export default quick;
export { TransactionManager };

// 便捷方法导出
export const { sendSlp, sendAlp, sendXec, send } = quick; 