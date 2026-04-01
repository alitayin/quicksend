// 基础接口定义

// 引入ChronikClient类型
import { ChronikClient } from "chronik-client";
import { AgoraOffer as EcashAgoraOffer } from 'ecash-agora';

/**
 * fetchAgoraOffers 的查询参数
 */
export interface AgoraFetchOptions {
  tokenId: string;
  tokenDecimals?: number; // 默认 0，用于计算展示单价
  maxPrice?: number;      // 每个代币最高 XEC 价格（不传或 0 = 不限价）
  chronik?: ChronikClient;
}

/**
 * 单个报价（包含定价信息，内含原始 offer 对象供后续成交使用）
 */
export interface AgoraOffer {
  offer: EcashAgoraOffer;       // 原始 ecash-agora 报价对象
  pricePerToken: number;        // 单价 (XEC)
  totalTokenAmount: number;     // 可买总量 (展示单位)
  totalXEC: number;             // 总价 (XEC)
  offerType: 'PARTIAL' | 'ONE_TO_ONE';
}

/**
 * acceptAgoraOffer 的执行参数
 */
export interface AgoraAcceptOptions {
  amount: number;          // 想买的数量 (展示单位，按 tokenDecimals 缩放)
  tokenDecimals?: number;  // 默认 0
  addressIndex?: number;   // 默认 0
  mnemonic?: string;       // 不传则从环境变量读取
  chronik?: ChronikClient;
}

/**
 * Agora 购买执行结果
 */
export interface AgoraBuyResult {
  success: boolean;
  reason: string; // 'SUCCESS' | 'AMOUNT_TOO_SMALL' | 'INVALID_REMAINING_AMOUNT' | 'INSUFFICIENT_BALANCE' | ...
  message?: string;
  // 成功时：
  txid?: string;
  explorerLink?: string;
  actualAmount?: number;
  totalXECPaid?: number;
  pricePerToken?: number;
  networkFee?: number;
  // 失败时：
  details?: Record<string, unknown>;
}

/**
 * 聚合购买选项（模式2：自动循环购买多个订单）
 */
export interface AgoraBuyOptions {
  tokenId: string;
  amount: number;              // 目标购买数量
  maxPrice: number;            // 最高单价（XEC）
  tokenDecimals?: number;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * 聚合购买结果
 */
export interface AgoraBuyAggregateResult {
  success: boolean;
  totalBought: number;         // 实际买到的总数量
  totalXECPaid: number;        // 总花费（含手续费）
  avgPrice: number;            // 平均单价
  transactions: Array<{
    txid: string;
    amount: number;
    price: number;
    fee: number;
  }>;
  skippedOffers: number;       // 跳过的订单数（买不了的）
  message?: string;
}

/**
 * 交易接收方
 *
 * @property address - eCash address (ecash:qq...)
 * @property amount - Unit depends on transaction type:
 *   - XEC: satoshis (1 XEC = 100 sats, e.g. amount: 1000 = 10.00 XEC)
 *   - SLP/ALP token: base atoms (smallest unit; combine with tokenDecimals to get display amount)
 */
export interface Recipient {
  address: string;
  /** XEC: satoshis (1 XEC = 100 sats) | Token: base atoms (smallest unit) */
  amount: number;
}

/**
 * UTXO接口 - 统一的UTXO定义
 */
export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  address?: string;
  slpToken?: SlpToken;
  isCoinbase?: boolean;
  blockHeight?: number;
}

/**
 * SLP代币信息接口
 */
export interface SlpToken {
  tokenId: string;
  atoms: string | bigint;
  isMintBaton: boolean; // Mint baton UTXOs must never be spent as regular send inputs
}

/**
 * 交易结果 - 统一的交易结果接口
 */
export interface TransactionResult {
  txid: string;
  explorerLink?: string;
  broadcastResult?: string;
  fee?: number;
}

/**
 * SLP/ALP 代币交易选项
 */
export interface TokenTransactionOptions {
  tokenId: string;
  tokenDecimals?: number; // 可选，向后兼容；amount 直接以 atoms（最小单位）表示
  addressIndex?: number;
  feeStrategy?: FeeStrategy;
  tokenStrategy?: TokenStrategy;
  mnemonic?: string; // 可选：如果提供则使用，否则从环境变量读取
  chronik?: ChronikClient; // 新增：可选的chronik实例
}

/**
 * XEC 交易选项（可以是字符串或对象）
 */
export interface XecTransactionOptions {
  utxoStrategy?: UtxoStrategy;
  addressIndex?: number;
  mnemonic?: string; // 可选：如果提供则使用，否则从环境变量读取
  chronik?: ChronikClient; // 新增：可选的chronik实例
}

/**
 * 通用发送方法的选项
 */
export interface GeneralSendOptions {
  utxoStrategy?: UtxoStrategy;
  addressIndex?: number;
  tokenId?: string;
  tokenDecimals?: number;
  feeStrategy?: FeeStrategy;
  tokenStrategy?: TokenStrategy;
  mnemonic?: string; // 可选：如果提供则使用，否则从环境变量读取
  chronik?: ChronikClient; // 新增：可选的chronik实例
}

/**
 * 交易类型
 */
export type TransactionType = 'slp' | 'alp' | 'xec';

/**
 * UTXO选择策略类型
 */
export type UtxoStrategy = 'all' | 'minimal' | 'largest_first';

/**
 * 手续费UTXO选择策略类型
 */
export type FeeStrategy = 'all' | 'minimal' | 'largest_first';

/**
 * 代币UTXO选择策略类型
 */
export type TokenStrategy = 'largest' | 'minimal' | 'all';