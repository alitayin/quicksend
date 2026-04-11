import { createRawTokenTransaction, createRawSlpTransaction, createRawAlpTransaction } from './send/tokensend';
import { createRawXecTransaction } from './send/xecsend';
import { fetchAgoraOffers as _fetchAgoraOffers, acceptAgoraOffer as _acceptAgoraOffer, buyAgoraTokens as _buyAgoraTokens } from './send/agorabuy';
import { createAgoraOffer as _createAgoraOffer } from './send/agorasell';
import { fetchMyAgoraOffers as _fetchMyAgoraOffers, cancelAgoraOffer as _cancelAgoraOffer } from './send/agoracancel';
import {
  Recipient,
  TransactionResult,
  TokenTransactionOptions,
  XecTransactionOptions,
  GeneralSendOptions,
  XecAppActionOptions,
  XecAppActionParseResult,
  TransactionType,
  AgoraFetchOptions,
  AgoraOffer,
  AgoraAcceptOptions,
  AgoraBuyResult,
  AgoraBuyOptions,
  AgoraBuyAggregateResult,
  AgoraSellOptions,
  AgoraSellResult,
  AgoraMyOffersOptions,
  AgoraCancelOptions,
  AgoraCancelResult,
} from './types';
export {
  CASHTAB_PREFIX_HEX,
  XEC_APP_MESSAGE_BYTE_LIMIT,
  buildXecAppActionOutput,
  parseXecAppActionOutput,
  validateAppMessage,
  validateAppPrefixHex,
} from './send/xec-app-action';
export type { XecAppActionOptions, XecAppActionParseResult } from './types';

/**
 * Unified Transaction Manager
 * Supports SLP, ALP and XEC transaction types
 */
class TransactionManager {
  /**
   * Send tokens (automatically detects SLP or ALP)
   * @param recipients - Array of recipients
   * @param options - Transaction options (tokenId, mnemonic, chronik instance, etc.)
   */
  async sendToken(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
    return await createRawTokenTransaction(recipients, options);
  }

  /**
   * Send SLP tokens (Deprecated: use sendToken)
   */
  async sendSlp(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
    return await createRawTokenTransaction(recipients, options);
  }

  /**
   * Send ALP tokens (Deprecated: use sendToken)
   */
  async sendAlp(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
    return await createRawTokenTransaction(recipients, options);
  }

  /**
   * Send XEC (eCash)
   * @param recipients - Array of recipients
   * @param options - UTXO strategy or options including mnemonic and chronik
   */
  async sendXec(recipients: Recipient[], options: XecTransactionOptions = {}): Promise<TransactionResult> {
    return await createRawXecTransaction(recipients, options);
  }

  /**
   * Fetch Agora offers
   * @param options - Fetch parameters
   */
  async fetchAgoraOffers(options: AgoraFetchOptions): Promise<AgoraOffer[]> {
    return await _fetchAgoraOffers(options);
  }

  /**
   * Accept an Agora offer (single mode)
   * @param offer - Offer object from fetchAgoraOffers
   * @param options - Purchase options
   */
  async acceptAgoraOffer(offer: AgoraOffer, options: AgoraAcceptOptions): Promise<AgoraBuyResult> {
    return await _acceptAgoraOffer(offer, options);
  }

  /**
   * Aggregate purchase Agora tokens (auto-loop multiple offers)
   * @param options - Purchase options (amount and max price)
   */
  async buyAgoraTokens(options: AgoraBuyOptions): Promise<AgoraBuyAggregateResult> {
    return await _buyAgoraTokens(options);
  }

  /**
   * Create an Agora sell offer (listing)
   * @param options - Sell options
   */
  async createAgoraOffer(options: AgoraSellOptions): Promise<AgoraSellResult> {
    return await _createAgoraOffer(options);
  }

  /**
   * Fetch my active Agora offers
   * @param options - Query options
   */
  async fetchMyAgoraOffers(options: AgoraMyOffersOptions): Promise<AgoraOffer[]> {
    return await _fetchMyAgoraOffers(options);
  }

  /**
   * Cancel a specific Agora offer
   * @param offer - Offer object from fetchMyAgoraOffers
   * @param options - Cancel options
   */
  async cancelAgoraOffer(offer: AgoraOffer, options: AgoraCancelOptions): Promise<AgoraCancelResult> {
    return await _cancelAgoraOffer(offer, options);
  }

  /**
   * General send method. Automatically handles tokens if options.tokenId is present.
   * @param type - Transaction type ('slp', 'alp', 'xec'). Optional if tokenId is in options.
   * @param recipients - Array of recipients
   * @param options - Transaction options (mnemonic, chronik, etc.)
   */
  async send(type: TransactionType | string, recipients: Recipient[], options: GeneralSendOptions = {}): Promise<TransactionResult> {
    const hasXecAppAction =
      typeof options.message !== 'undefined' || typeof options.appPrefixHex !== 'undefined';

    // If tokenId is provided, handle it as a token transaction
    if (options.tokenId) {
      if (hasXecAppAction) {
        throw new Error('message/appPrefixHex only support XEC transactions');
      }
      return await this.sendToken(recipients, {
        tokenId: options.tokenId,
        addressIndex: options.addressIndex,
        feeStrategy: options.feeStrategy,
        tokenStrategy: options.tokenStrategy,
        mnemonic: options.mnemonic,
        chronik: options.chronik
      });
    }

    switch (type.toLowerCase()) {
      case 'slp':
      case 'alp':
        throw new Error(`${type.toUpperCase()} transactions require tokenId in options`);
      case 'xec':
        const xecOptions: XecTransactionOptions = {
          utxoStrategy: options.utxoStrategy,
          addressIndex: options.addressIndex,
          mnemonic: options.mnemonic,
          chronik: options.chronik,
          message: options.message,
          appPrefixHex: options.appPrefixHex,
        };
        return await this.sendXec(recipients, xecOptions);
      default:
        throw new Error(`Unsupported transaction type: ${type}`);
    }
  }
}

// Create singleton instance
const quick = new TransactionManager();

// Export instance and class
export default quick;
export { TransactionManager };

// Convenience method exports
export const { sendToken, sendSlp, sendAlp, sendXec, send, fetchAgoraOffers, acceptAgoraOffer, buyAgoraTokens, createAgoraOffer, fetchMyAgoraOffers, cancelAgoraOffer } = quick;
