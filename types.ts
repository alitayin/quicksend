// 基础接口定义

// 引入ChronikClient类型
import { ChronikClient } from "chronik-client";

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