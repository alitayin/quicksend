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

### Send XEC

```javascript
import { sendXec } from 'ecash-quicksend';

const result = await sendXec(
  [{ address: 'ecash:q...', amount: 1000n }],
  { mnemonic: 'your mnemonic...' }
);
console.log(result.txid);
```

### Send Tokens (SLP/ALP)

```javascript
import { sendSlp, sendAlp } from 'ecash-quicksend';

// Send SLP
await sendSlp(
  [{ address: 'ecash:q...', amount: 500n }],
  { 
    tokenId: '...', 
    mnemonic: 'your mnemonic...'
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
  pricePerToken: 5.5, // XEC per token
  mnemonic: 'your mnemonic...'
});
```

### Buying

**Option 1: Market Buy (Auto-fill)**
Automatically aggregate and buy tokens from multiple offers until the desired amount is reached.

```javascript
import { buyAgoraTokens } from 'ecash-quicksend';

const result = await buyAgoraTokens({
  tokenId: '...',
  amount: 5000n,
  maxPrice: 2.8,
  mnemonic: 'your mnemonic...'
});
```

**Option 2: Manual Buy (Query & Accept)**
Fetch available offers and manually accept a specific one.

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
    offer: Object,           // Raw offer data for acceptAgoraOffer
    pricePerToken: number,   // Price in XEC
    totalTokenAmount: bigint,// Available atoms
    totalXEC: number,        // Total XEC cost for entire offer
    offerType: string        // 'PARTIAL' or 'ONE_TO_ONE'
  }
*/

// 2. Accept the best offer (first in sorted list)
const result = await acceptAgoraOffer(offers[0], {
  amount: 1000n,
  mnemonic: 'your mnemonic...'
});
```

### Management & Cancellation

Query and cancel your active listings.

```javascript
import { fetchMyAgoraOffers, cancelAgoraOffer } from 'ecash-quicksend';

// 1. Fetch your active listings
const myOffers = await fetchMyAgoraOffers({
  mnemonic: 'your mnemonic...'
});

// 2. Cancel a specific listing
const cancelResult = await cancelAgoraOffer(myOffers[0], {
  mnemonic: 'your mnemonic...'
});
```

## API Summary

- `sendXec(recipients, options)`: Send XEC to one or more addresses.
- `sendSlp(recipients, options)`: Send SLP tokens.
- `sendAlp(recipients, options)`: Send ALP tokens.
- `createAgoraOffer(options)`: List tokens for sale on Agora.
- `buyAgoraTokens(options)`: Market buy tokens up to a max price.
- `acceptAgoraOffer(offer, options)`: Buy from a specific Agora offer.
- `fetchAgoraOffers(options)`: List available offers for a token.
- `fetchMyAgoraOffers(options)`: List offers created by your mnemonic.
- `cancelAgoraOffer(offer, options)`: Cancel an active offer.

## Changelog

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
