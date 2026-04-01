# ecash-quicksend

Unified transaction manager for eCash (XEC), SLP, and ALP.

## Installation

```bash
npm install ecash-quicksend
```

### Setup

**Environment Variables**

This library does not load `.env` files automatically. If you use one, manage it with `dotenv` in your entry point:

```javascript
import 'dotenv/config'; // or dotenv.config()
import { sendXec } from 'ecash-quicksend';

// Library will now pick up process.env.MNEMONIC
```

**Manual Options**

You can also pass `mnemonic` and `chronik` directly in the `options` object of any method.

---

## Quick Start

All amounts in `ecash-quicksend` are specified in **atoms** (satoshis) using `BigInt` (e.g., `1000n`).

### Send XEC

```javascript
import { sendXec } from 'ecash-quicksend';

const result = await sendXec(
  [{ address: 'ecash:q...', amount: 1000n }],
  { mnemonic: '...' } // Optional if MNEMONIC env var is set
);
console.log(result.txid);
```

### Send Tokens (Unified SLP/ALP)

Protocol is automatically detected from UTXO data. No need to specify if it's SLP or ALP.

```javascript
import { sendToken } from 'ecash-quicksend';

await sendToken(
  [{ address: 'ecash:q...', amount: 500n }],
  { 
    tokenId: '...', 
    mnemonic: '...' // Optional
  }
);
```

## Agora DEX

### Listing

List your tokens for sale on the decentralized exchange.

```javascript
import { createAgoraOffer } from 'ecash-quicksend';

const result = await createAgoraOffer({
  tokenId: '...',
  tokenAmount: 1000n,
  pricePerToken: 5.5,
  mnemonic: '...' // Optional
});
```

### Buying

**Option 1: Market Buy (Auto-fill)**

```javascript
import { buyAgoraTokens } from 'ecash-quicksend';

const result = await buyAgoraTokens({
  tokenId: '...',
  amount: 5000n,
  maxPrice: 2.8,
  mnemonic: '...' // Optional
});
```

**Option 2: Manual Buy (Query & Accept)**

```javascript
import { fetchAgoraOffers, acceptAgoraOffer } from 'ecash-quicksend';

// 1. Query offers for a token
const offers = await fetchAgoraOffers({
  tokenId: 'your-token-id',
  maxPrice: 2.5
});

/*
  offers returns Array<AgoraOffer> sorted by price:
  {
    offer: Object,
    pricePerToken: number,
    totalTokenAmount: bigint,
    totalXEC: number,
    offerType: string
  }
*/

// 2. Accept the best offer
const result = await acceptAgoraOffer(offers[0], {
  amount: 1000n,
  mnemonic: '...' // Optional
});
```

### Management & Cancellation

```javascript
import { fetchMyAgoraOffers, cancelAgoraOffer } from 'ecash-quicksend';

// 1. Fetch your active listings
const myOffers = await fetchMyAgoraOffers({
  mnemonic: '...' // Optional
});

// 2. Cancel a specific listing
const cancelResult = await cancelAgoraOffer(myOffers[0], {
  mnemonic: '...' // Optional
});
```

## Options & Defaults

### Common Options

| Parameter | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `mnemonic` | `string` | Wallet mnemonic | `process.env.MNEMONIC` |
| `chronik` | `ChronikClient` | Custom Chronik instance | Default library instance |
| `addressIndex`| `number` | HD wallet address index | `0` |
| `utxoStrategy` | `UtxoStrategy` | XEC selection: `all`, `minimal`, `largest_first` | `all` |
| `feeStrategy` | `FeeStrategy` | Fee selection: `all`, `minimal`, `largest_first` | `all` |
| `tokenStrategy` | `TokenStrategy` | Token selection: `all` (merge), `largest`, `minimal` | `all` |

---

## API Summary

- `sendXec(recipients, options)`: Send XEC to one or more addresses.
- `sendToken(recipients, options)`: Send tokens (auto-detects SLP/ALP).
- `sendSlp(recipients, options)`: Send SLP tokens (Deprecated: use `sendToken`).
- `sendAlp(recipients, options)`: Send ALP tokens (Deprecated: use `sendToken`).
- `createAgoraOffer(options)`: List tokens (SLP or ALP) for sale on Agora.
- `buyAgoraTokens(options)`: Market buy tokens up to a max price.
- `acceptAgoraOffer(offer, options)`: Buy from a specific Agora offer.
- `fetchAgoraOffers(options)`: List available offers for a token.
- `fetchMyAgoraOffers(options)`: List offers created by your mnemonic.
- `cancelAgoraOffer(offer, options)`: Cancel an active offer.

## Changelog

- v2.0.0: Unified SLP/ALP handling via auto-detection. Added support for SLP listings on Agora.
- v1.7.1: Removed tokenDecimals, amounts are now BigInt atoms.
- v1.6.1: Added Agora DEX management (fetch/cancel).
- v1.5.1: Added Agora DEX listing.
- v1.4.0: Added Agora DEX buying.
- v1.3.3: Clarified amount units.
- v1.1.0: Internal refactoring and performance improvements.

## Requirements

- Node.js >= 18.0.0

## License

MIT
