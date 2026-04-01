import { createRawSlpTransaction, createRawAlpTransaction } from './send/tokensend';
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

/**
 * Unified Transaction Manager
 * Supports SLP, ALP and XEC transaction types
 */
class TransactionManager {
  /**
   * Send SLP tokens
   * @param recipients - Array of recipients
   * @param options - Transaction options (mnemonic, chronik instance, etc.)
   */
  async sendSlp(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
    return await createRawSlpTransaction(recipients, options);
  }

  /**
   * Send ALP tokens
   * @param recipients - Array of recipients
   * @param options - Transaction options (mnemonic, chronik instance, etc.)
   */
  async sendAlp(recipients: Recipient[], options: TokenTransactionOptions): Promise<TransactionResult> {
    return await createRawAlpTransaction(recipients, options);
  }

  /**
   * Send XEC (eCash)
   * @param recipients - Array of recipients
   * @param options - UTXO strategy or options including mnemonic and chronik
   */
  async sendXec(recipients: Recipient[], options: XecTransactionOptions = {}): Promise<TransactionResult> {
    const { utxoStrategy = 'all', addressIndex = 0, mnemonic, chronik: chronikClient } = options;
    return await createRawXecTransaction(recipients, utxoStrategy, addressIndex, mnemonic, chronikClient);
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
   * General send method
   * @param type - Transaction type
   * @param recipients - Array of recipients
   * @param options - Transaction options (mnemonic, chronik, etc.)
   */
  async send(type: TransactionType, recipients: Recipient[], options: GeneralSendOptions = {}): Promise<TransactionResult> {
    switch (type.toLowerCase() as TransactionType) {
      case 'slp':
        if (!options.tokenId) {
          throw new Error('SLP transactions require tokenId');
        }
        return await this.sendSlp(recipients, {
          tokenId: options.tokenId,
          addressIndex: options.addressIndex,
          feeStrategy: options.feeStrategy,
          tokenStrategy: options.tokenStrategy,
          mnemonic: options.mnemonic,
          chronik: options.chronik
        });
      case 'alp':
        if (!options.tokenId) {
          throw new Error('ALP transactions require tokenId');
        }
        return await this.sendAlp(recipients, {
          tokenId: options.tokenId,
          addressIndex: options.addressIndex,
          feeStrategy: options.feeStrategy,
          tokenStrategy: options.tokenStrategy,
          mnemonic: options.mnemonic,
          chronik: options.chronik
        });
      case 'xec':
        const xecOptions: XecTransactionOptions = {
          utxoStrategy: options.utxoStrategy,
          addressIndex: options.addressIndex,
          mnemonic: options.mnemonic,
          chronik: options.chronik         };
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
export const { sendSlp, sendAlp, sendXec, send, fetchAgoraOffers, acceptAgoraOffer, buyAgoraTokens, createAgoraOffer, fetchMyAgoraOffers, cancelAgoraOffer } = quick;