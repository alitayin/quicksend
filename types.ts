// 基础接口定义

/**
 * 交易接收方
 */
export interface Recipient {
  address: string;
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
  [key: string]: any; // 允许其他属性
}

/**
 * SLP代币信息接口
 */
export interface SlpToken {
  tokenId: string;
  atoms: string | bigint;
  [key: string]: any;
}

/**
 * 交易结果 - 统一的交易结果接口
 */
export interface TransactionResult {
  txid: string;
  explorerLink?: string;
  broadcastResult?: string;
  fee?: number;
  inputs?: any[];
  outputs?: any[];
  [key: string]: any; // 允许其他属性
}

/**
 * SLP/ALP 代币交易选项
 */
export interface TokenTransactionOptions {
  tokenId: string;
  tokenDecimals: number;
  addressIndex?: number;
  feeStrategy?: string;
  tokenStrategy?: string;
  mnemonic?: string; // 可选：如果提供则使用，否则从环境变量读取
}

/**
 * XEC 交易选项（可以是字符串或对象）
 */
export interface XecTransactionOptions {
  utxoStrategy?: string;
  addressIndex?: number;
  mnemonic?: string; // 可选：如果提供则使用，否则从环境变量读取
}

/**
 * XEC 交易选项联合类型
 */
export type XecOptions = string | XecTransactionOptions;

/**
 * 通用发送方法的选项
 */
export interface GeneralSendOptions {
  utxoStrategy?: string;
  addressIndex?: number;
  tokenId?: string;
  tokenDecimals?: number;
  feeStrategy?: string;
  tokenStrategy?: string;
  mnemonic?: string; // 可选：如果提供则使用，否则从环境变量读取
}

/**
 * 交易类型
 */
export type TransactionType = 'slp' | 'alp' | 'xec';

/**
 * UTXO策略类型
 */
export type UtxoStrategy = 'all' | 'single' | 'multiple'; 