import { ChronikClient } from "chronik-client";
import { AgoraOffer as EcashAgoraOffer } from 'ecash-agora';

/**
 * fetchAgoraOffers 的查询参数
 */
export interface AgoraFetchOptions {
  tokenId: string;
  tokenDecimals?: number; // 默认 0
  maxPrice?: number;      // 每个代币最高 XEC 价格
  chronik?: ChronikClient;
}

/**
 * 单个报价
 */
export interface AgoraOffer {
  offer: EcashAgoraOffer;
  pricePerToken: number;
  totalTokenAmount: number;
  totalXEC: number;
  offerType: 'PARTIAL' | 'ONE_TO_ONE';
}

/**
 * acceptAgoraOffer 的执行参数
 */
export interface AgoraAcceptOptions {
  amount: number;
  tokenDecimals?: number;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * Agora 购买执行结果
 */
export interface AgoraBuyResult {
  success: boolean;
  reason: string;
  message?: string;
  txid?: string;
  explorerLink?: string;
  actualAmount?: number;
  totalXECPaid?: number;
  pricePerToken?: number;
  networkFee?: number;
  details?: Record<string, unknown>;
}

/**
 * 聚合购买选项
 */
export interface AgoraBuyOptions {
  tokenId: string;
  amount: number;
  maxPrice: number;
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
  totalBought: number;
  totalXECPaid: number;
  avgPrice: number;
  transactions: Array<{
    txid: string;
    amount: number;
    price: number;
    fee: number;
  }>;
  skippedOffers: number;
  message?: string;
}

/**
 * createAgoraOffer 的执行参数
 */
export interface AgoraSellOptions {
  tokenId: string;
  tokenAmount: number;
  pricePerToken: number;
  tokenDecimals?: number;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
  offerType?: 'PARTIAL' | 'ONE_TO_ONE';
}

/**
 * Agora 卖单创建结果
 */
export interface AgoraSellResult {
  success: boolean;
  message?: string;
  txid?: string;
  explorerLink?: string;
  tokenAmount?: number;
  pricePerToken?: number;
  offerType?: string;
}

/**
 * fetchMyAgoraOffers 的执行参数
 */
export interface AgoraMyOffersOptions {
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * cancelAgoraOffer 的执行参数
 */
export interface AgoraCancelOptions {
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * Agora 取消订单结果
 */
export interface AgoraCancelResult {
  success: boolean;
  message?: string;
  txid?: string;
  explorerLink?: string;
}

/**
 * 交易接收方
 */
export interface Recipient {
  address: string;
  amount: number; // 必须是 number 以兼容现有代码
}

/**
 * UTXO 接口定义
 */
export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  sats?: bigint;
  address: string;
  isCoinbase: boolean;
  blockHeight: number;
  slpToken?: SlpToken;
}

/**
 * SLP 代币信息接口
 */
export interface SlpToken {
  tokenId: string;
  amount?: number | bigint;
  atoms: string | bigint;
  isMintBaton: boolean;
}

/**
 * 交易结果
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
  tokenDecimals?: number;
  addressIndex?: number;
  feeStrategy?: FeeStrategy;
  tokenStrategy?: TokenStrategy;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * XEC 交易选项
 */
export interface XecTransactionOptions {
  utxoStrategy?: UtxoStrategy;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
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
  mnemonic?: string;
  chronik?: ChronikClient;
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
