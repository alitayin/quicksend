import { createRawSlpTransaction, createRawAlpTransaction } from './send/tokensend';
import { createRawXecTransaction } from './send/xecsend';
import { fetchAgoraOffers as _fetchAgoraOffers, acceptAgoraOffer as _acceptAgoraOffer, buyAgoraTokens as _buyAgoraTokens } from './send/agorabuy';
import { createAgoraOffer as _createAgoraOffer } from './send/agorasell';
import {
  Recipient,
  TransactionResult,
  TokenTransactionOptions,
  XecTransactionOptions,
  GeneralSendOptions,
  TransactionType,
  AgoraFetchOptions,
  AgoraOffer,
  AgoraAcceptOptions,
  AgoraBuyResult,
  AgoraBuyOptions,
  AgoraBuyAggregateResult,
  AgoraSellOptions,
  AgoraSellResult,
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
  async sendXec(recipients: Recipient[], options: XecTransactionOptions = {}): Promise<TransactionResult> {
    const { utxoStrategy = 'all', addressIndex = 0, mnemonic, chronik: chronikClient } = options;
    return await createRawXecTransaction(recipients, utxoStrategy, addressIndex, mnemonic, chronikClient);
  }

  /**
   * 查询 Agora 报价列表
   * @param options - 查询参数
   */
  async fetchAgoraOffers(options: AgoraFetchOptions): Promise<AgoraOffer[]> {
    return await _fetchAgoraOffers(options);
  }

  /**
   * 执行 Agora 成交购买（单笔模式）
   * @param offer - fetchAgoraOffers 返回的报价对象
   * @param options - 购买选项
   */
  async acceptAgoraOffer(offer: AgoraOffer, options: AgoraAcceptOptions): Promise<AgoraBuyResult> {
    return await _acceptAgoraOffer(offer, options);
  }

  /**
   * 聚合购买 Agora 代币（自动循环多个订单）
   * @param options - 购买选项（指定数量和最大价格）
   */
  async buyAgoraTokens(options: AgoraBuyOptions): Promise<AgoraBuyAggregateResult> {
    return await _buyAgoraTokens(options);
  }

  /**
   * 创建 Agora 卖单（挂单）
   * @param options - 挂单选项
   */
  async createAgoraOffer(options: AgoraSellOptions): Promise<AgoraSellResult> {
    return await _createAgoraOffer(options);
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
        if (!options.tokenId) {
          throw new Error('SLP transactions require tokenId');
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
        if (!options.tokenId) {
          throw new Error('ALP transactions require tokenId');
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
export const { sendSlp, sendAlp, sendXec, send, fetchAgoraOffers, acceptAgoraOffer, buyAgoraTokens, createAgoraOffer } = quick;