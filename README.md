# ecash-quicksend

[![npm version](https://badge.fury.io/js/ecash-quicksend.svg)](https://badge.fury.io/js/ecash-quicksend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified transaction manager for eCash (XEC), SLP, and ALP token transactions.

## Installation

```bash
npm install ecash-quicksend
```

## Migration Notes

### v1.6.1+
Added Agora DEX management functionality:
- `fetchMyAgoraOffers()` - Query active sell offers listed by your wallet.
- `cancelAgoraOffer()` - Cancel an active sell offer and reclaim tokens.

### v1.5.1+
Added Agora DEX listing functionality:
- `createAgoraOffer()` - List your tokens for sale on the DEX.

### v1.4.0+
Added Agora DEX integration for buying tokens directly from the decentralized exchange. Two modes available:
- `acceptAgoraOffer()` - Buy from a specific offer (manual mode)
- `buyAgoraTokens()` - Auto-aggregate across multiple offers until target amount reached

### v1.3.3+
`Recipient.amount` unit is now clearly documented: satoshis for XEC (1 XEC = 100 sats), base atoms for SLP/ALP tokens. JSDoc and example comments updated.

### v1.3.2+
This library no longer calls `dotenv.config()` internally and does not depend on `dotenv`. If you rely on a `.env` file for your mnemonic, install `dotenv` yourself and call `dotenv.config()` in your own application entry point before using this library:

```javascript
import dotenv from 'dotenv';
dotenv.config(); // call this yourself

import quick from 'ecash-quicksend';
```

### v1.7.1+
**BREAKING CHANGE**: `tokenDecimals` is removed. `amount` in token recipients is now in **atoms** (smallest unit) and **must be a `bigint`**. This ensures atomicity and prevents floating-point precision issues.

---

## Quick Start

### Setup

**Option 1: Environment Variable**
```javascript
// In your app entry point:
import dotenv from 'dotenv';
dotenv.config();
// Then set MNEMONIC in your .env file
```

**Option 2: Direct in Code**
```javascript
// Provide mnemonic directly in function calls
```

### Basic Usage

```javascript
import quick from 'ecash-quicksend';

// Send XEC — amount in satoshis (1 XEC = 100 sats)
await quick.sendXec([
  { address: 'ecash:qq...', amount: 1000 } // 1000 sats = 10.00 XEC
]);

// Send XEC with custom mnemonic
await quick.sendXec([
  { address: 'ecash:qq...', amount: 1000 } // 1000 sats = 10.00 XEC
], {
  mnemonic: 'your twelve word mnemonic phrase'
});

// Send SLP tokens — amount in base atoms (smallest unit, NOT display amount)
await quick.sendSlp([
  { address: 'ecash:qq...', amount: 100 } // 100 atoms (e.g. 1.00 if tokenDecimals=2)
], {
  tokenId: 'your-token-id',
});

// Send ALP tokens — amount in base atoms (smallest unit, NOT display amount)
await quick.sendAlp([
  { address: 'ecash:qq...', amount: 100 } // 100 atoms (e.g. 1.00 if tokenDecimals=2)
], {
  tokenId: 'your-token-id',
});
```

## API

### Methods

- `sendXec(recipients, options?)` - Send eCash
- `sendSlp(recipients, options)` - Send SLP tokens  
- `sendAlp(recipients, options)` - Send ALP tokens
- `send(type, recipients, options?)` - Universal send method
- `fetchAgoraOffers(options)` - Query Agora DEX offers
- `acceptAgoraOffer(offer, options)` - Buy from specific Agora offer
- `buyAgoraTokens(options)` - Auto-buy tokens across multiple offers
- `createAgoraOffer(options)` - List tokens for sale
- `fetchMyAgoraOffers(options)` - Query your active sell offers
- `cancelAgoraOffer(offer, options)` - Cancel a sell offer

### Options

```typescript
// XEC Options
{
  utxoStrategy?: 'all' | 'minimal' | 'largest_first';
  addressIndex?: number;
  mnemonic?: string;
  chronik?: ChronikClient;
}

// Token Options (SLP/ALP)
{
  tokenId: string;                               // required
  tokenDecimals?: number;                        // optional, ignored (kept for backward compatibility)
  addressIndex?: number;
  feeStrategy?: 'all' | 'minimal' | 'largest_first';
  tokenStrategy?: 'all' | 'largest' | 'minimal';
  mnemonic?: string;
  chronik?: ChronikClient;
}
```

#### Strategy Details
- **utxoStrategy**: `'all'` (use all UTXOs) | `'minimal'` (fewest UTXOs) | `'largest_first'` (biggest UTXOs first)
- **feeStrategy**: `'all'` (all UTXOs for fees) | `'minimal'` (fewest for fees) | `'largest_first'` (biggest for fees)  
- **tokenStrategy**: `'all'` (all token UTXOs) | `'largest'` (biggest token UTXO) | `'minimal'` (smallest sufficient)

## Advanced Usage

```javascript
// Multiple recipients
await quick.sendXec([
  { address: 'ecash:qq...', amount: 1000 },
  { address: 'ecash:qp...', amount: 2000 }
]);

// Custom UTXO strategy
await quick.sendXec(recipients, { utxoStrategy: 'largest' });

// Different address index
await quick.sendXec(recipients, { addressIndex: 1 });

// Universal send method
await quick.send('xec', recipients);
await quick.send('slp', recipients, {
  tokenId: 'token-id',
});

// Custom chronik client
import { ChronikClient } from 'chronik-client';
const customChronik = new ChronikClient('https://your-chronik-url.com');

await quick.sendXec(recipients, { chronik: customChronik });
await quick.sendSlp(recipients, {
  tokenId: 'token-id',
  chronik: customChronik
});
```

## Agora DEX Integration

Buy tokens from Agora DEX with two modes:

### Mode 1: Manual (specify offer)

```javascript
// Step 1: Query offers
const offers = await quick.fetchAgoraOffers({
  tokenId: 'your-token-id',
  maxPrice: 5,        // max 5 XEC per token
  tokenDecimals: 2
});

// Step 2: Buy from specific offer
const result = await quick.acceptAgoraOffer(offers[0], {
  amount: 100,        // buy 100 tokens
  tokenDecimals: 2,
  mnemonic: 'your mnemonic'
});

console.log(result.txid);
```

### Mode 2: Auto-aggregate (multi-order)

```javascript
// Automatically buy across multiple offers
const result = await quick.buyAgoraTokens({
  tokenId: 'your-token-id',
  amount: 100000,     // target amount
  maxPrice: 2.8,      // max price per token
  tokenDecimals: 0,
  mnemonic: 'your mnemonic'
});

console.log(`Bought ${result.totalBought} tokens in ${result.transactions.length} orders`);
console.log(`Avg price: ${result.avgPrice} XEC`);
```

### Sell & Management

#### List tokens for sale

```javascript
const result = await quick.createAgoraOffer({
  tokenId: 'your-token-id',
  tokenAmount: 100,
  pricePerToken: 5.5,
  mnemonic: 'your mnemonic',
  chronik: agoraEnabledChronik
});
```

#### Cancel an offer

```javascript
// 1. Fetch your active offers
const myOffers = await quick.fetchMyAgoraOffers({ mnemonic, chronik });

// 2. Cancel a specific offer
const cancelResult = await quick.cancelAgoraOffer(myOffers[0], { mnemonic, chronik });
```

## Error Handling

```javascript
try {
  const result = await quick.sendXec(recipients);
  console.log('Success:', result.txid);
} catch (error) {
  console.error('Failed:', error.message);
}
```

## Requirements

- Node.js >= 18.0.0
- Valid eCash wallet mnemonic phrase

## License

MIT

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

[Issues](https://github.com/alitayin/quicksend/issues) | [GitHub](https://github.com/alitayin/quicksend)

---

## Changelog

### v1.3.5
- Fixed `send('slp', ...)` and `send('alp', ...)` incorrectly rejecting `tokenDecimals: 0`. The `!tokenDecimals` falsy check treated `0` as missing; validation now only requires `tokenId`.

### v1.3.4
- Added `tokenId` format validation: non-64-char or non-hex values now throw a clear error at the entry point instead of a cryptic library exception.
- `feeStrategy`, `tokenStrategy`, and `utxoStrategy` options are now typed as proper union types (`FeeStrategy`, `TokenStrategy`, `UtxoStrategy`) instead of `string`, improving type safety for callers using TypeScript.

### v1.3.3
- `validateMnemonic` now validates each word against the BIP39 wordlist (via `mnemonicToSeed` try/catch), catching misspellings that previously returned `true`.
- Coinbase UTXOs are now filtered from UTXO selection. Spending immature coinbase outputs causes node rejection; they are now silently excluded from both XEC and token fee inputs.
- `Recipient.amount` unit semantics clarified in JSDoc and examples: satoshis for XEC (1 XEC = 100 sats), base atoms for SLP/ALP tokens.

### v1.3.2
- `Ecc` instance is now a module-level singleton in `wallet-utils.ts`, eliminating redundant initialization overhead on every `sendXec`/`sendSlp`/`sendAlp` call.
- Removed `dotenv.config()` calls from library internals (`config/constants.ts`, `send/xecsend.ts`, `send/tokensend.ts`). The library no longer touches dotenv at all.
- Added SLP max send outputs validation: exceeding 19 recipients per tx throws a clear error instead of building an invalid transaction.
- Added ALP max send outputs validation: exceeding 29 recipients per tx throws a clear error.

### v1.3.0
- `tokenDecimals` is now optional in `sendSlp` / `sendAlp` / `send`. Token `amount` is in atoms (smallest unit), matching the ecash-wallet convention. `tokenDecimals` is accepted but ignored for backward compatibility.

### v1.2.0
- Fee verification now uses `EccDummy` (same approach as ecash-wallet) to build a dummy transaction with worst-case signature sizes before broadcasting. This guarantees the fee estimate is always a conservative upper bound — insufficient-fee broadcasts are impossible.

### v1.1.0
- **Breaking**: Library no longer calls `dotenv.config()` internally. Call it yourself in your app entry point if you use `.env` files.
- `broadcastTx` → `broadcastTxs` (chronik-client >= 0.32.10).
- Fee estimation replaced magic numbers with `calcTxFee` + named byte-size constants.
- Removed duplicate `console.log` calls for key derivation and transaction summaries.
- Merged duplicate `buildSlpOutputs` / `buildAlpOutputs` into shared `buildTokenOutputs`.

### v1.0.9
- Migrated to `broadcastTxs`, unified `TransactionResult` type, extracted XEC derivation path constant. 