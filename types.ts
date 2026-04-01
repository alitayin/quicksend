import { ChronikClient } from "chronik-client";
import { AgoraOffer as EcashAgoraOffer } from 'ecash-agora';

/**
 * Query parameters for fetchAgoraOffers
 */
export interface AgoraFetchOptions {
  tokenId: string;
  maxPrice?: number;      // Max XEC price per token
  chronik?: ChronikClient;
}

/**
 * Individual Agora offer
 */
export interface AgoraOffer {
  offer: EcashAgoraOffer;
  pricePerToken: number;
  totalTokenAmount: bigint;
  totalXEC: number;
  offerType: 'PARTIAL' | 'ONE_TO_ONE';
}

/**
 * Parameters for acceptAgoraOffer
 */
export interface AgoraAcceptOptions {
  amount: bigint;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * Agora purchase result
 */
export interface AgoraBuyResult {
  success: boolean;
  reason: string;
  message?: string;
  txid?: string;
  explorerLink?: string;
  actualAmount?: bigint;
  totalXECPaid?: number;
  pricePerToken?: number;
  networkFee?: number;
  details?: Record<string, unknown>;
}

/**
 * Aggregate purchase options
 */
export interface AgoraBuyOptions {
  tokenId: string;
  amount: bigint;
  maxPrice: number;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * Aggregate purchase result
 */
export interface AgoraBuyAggregateResult {
  success: boolean;
  totalBought: bigint;
  totalXECPaid: number;
  avgPrice: number;
  transactions: Array<{
    txid: string;
    amount: bigint;
    price: number;
    fee: number;
  }>;
  skippedOffers: number;
  message?: string;
}

/**
 * Parameters for createAgoraOffer
 */
export interface AgoraSellOptions {
  tokenId: string;
  tokenAmount: bigint;
  pricePerToken: number;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
  offerType?: 'PARTIAL' | 'ONE_TO_ONE';
}

/**
 * Agora sell offer creation result
 */
export interface AgoraSellResult {
  success: boolean;
  message?: string;
  txid?: string;
  explorerLink?: string;
  tokenAmount?: bigint;
  pricePerToken?: number;
  offerType?: string;
}

/**
 * Parameters for fetchMyAgoraOffers
 */
export interface AgoraMyOffersOptions {
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * Parameters for cancelAgoraOffer
 */
export interface AgoraCancelOptions {
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * Agora cancel offer result
 */
export interface AgoraCancelResult {
  success: boolean;
  message?: string;
  txid?: string;
  explorerLink?: string;
}

/**
 * Transaction recipient
 */
export interface Recipient {
  address: string;
  amount: bigint;
}

/**
 * UTXO interface definition
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
 * SLP token information interface
 */
export interface SlpToken {
  tokenId: string;
  atoms: bigint;
  isMintBaton: boolean;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  txid: string;
  explorerLink?: string;
  broadcastResult?: string;
  fee?: number;
}

/**
 * SLP/ALP token transaction options
 */
export interface TokenTransactionOptions {
  tokenId: string;
  addressIndex?: number;
  feeStrategy?: FeeStrategy;
  tokenStrategy?: TokenStrategy;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * XEC transaction options
 */
export interface XecTransactionOptions {
  utxoStrategy?: UtxoStrategy;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * General send method options
 */
export interface GeneralSendOptions {
  utxoStrategy?: UtxoStrategy;
  addressIndex?: number;
  tokenId?: string;
  feeStrategy?: FeeStrategy;
  tokenStrategy?: TokenStrategy;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * Transaction type
 */
export type TransactionType = 'slp' | 'alp' | 'xec';

/**
 * UTXO selection strategy type
 */
export type UtxoStrategy = 'all' | 'minimal' | 'largest_first';

/**
 * Fee UTXO selection strategy type
 */
export type FeeStrategy = 'all' | 'minimal' | 'largest_first';

/**
 * Token UTXO selection strategy type
 */
export type TokenStrategy = 'largest' | 'minimal' | 'all';
