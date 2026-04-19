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
 * Optional swap fee output appended to Agora buy transactions
 */
export interface AgoraFeeOutput {
  address: string;
  feeBps: number;      // 50 = 0.5%
  minSats?: bigint;    // Optional fee floor in sats
}

/**
 * Parameters for acceptAgoraOffer
 */
export interface AgoraAcceptOptions {
  amount: bigint;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
  feeOutput?: AgoraFeeOutput;
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
  swapFeePaid?: number;
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
  feeOutput?: AgoraFeeOutput;
}

/**
 * Aggregate purchase result
 */
export interface AgoraBuyAggregateResult {
  success: boolean;
  totalBought: bigint;
  totalXECPaid: number;
  totalSwapFeePaid: number;
  avgPrice: number;
  transactions: Array<{
    txid: string;
    amount: bigint;
    price: number;
    fee: number;
    swapFee: number;
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
  token?: TokenInfo;
}

/**
 * Token information interface (supports SLP and ALP)
 */
export interface TokenInfo {
  tokenId: string;
  atoms: bigint;
  isMintBaton: boolean;
  protocol: 'SLP' | 'ALP';
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
 * XEC app action options
 */
export interface XecAppActionOptions {
  message?: string;
  appPrefixHex?: string;
}

/**
 * Parsed XEC app action
 */
export type XecAppActionParseResult =
  | { kind: 'message'; prefixHex: string; message: string }
  | { kind: 'prefix_only'; prefixHex: string };

/**
 * XEC transaction options
 */
export interface XecTransactionOptions extends XecAppActionOptions {
  utxoStrategy?: UtxoStrategy;
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

/**
 * General send method options
 */
export interface GeneralSendOptions extends XecAppActionOptions {
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

/**
 * Transaction error types for type-safe error handling
 */
export type TransactionError =
  | { type: 'NETWORK_ERROR'; message: string; statusCode?: number }
  | { type: 'VALIDATION_ERROR'; message: string; field?: string }
  | { type: 'INSUFFICIENT_BALANCE'; required: bigint; available: bigint; message: string }
  | { type: 'UNKNOWN_ERROR'; message: string };

/**
 * Normalize unknown error to TransactionError
 */
export function normalizeError(error: unknown): TransactionError {
  if (error instanceof Error) {
    return { type: 'UNKNOWN_ERROR', message: error.message };
  }
  if (typeof error === 'string') {
    return { type: 'UNKNOWN_ERROR', message: error };
  }
  return { type: 'UNKNOWN_ERROR', message: 'Unknown error occurred' };
}

/**
 * Extract message from TransactionError
 */
export function getErrorMessage(error: TransactionError): string {
  return error.message;
}
