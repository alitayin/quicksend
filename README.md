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

Add a Cashtab-compatible app message by passing `message`. This uses the default
Cashtab prefix `00746162`.

```javascript
await sendXec(
  [{ address: 'ecash:q...', amount: 1000n }],
  {
    mnemonic: '...',
    message: 'hello from my app',
  }
);
```

Add a custom 4-byte app prefix without a message by passing `appPrefixHex`.

```javascript
await sendXec(
  [{ address: 'ecash:q...', amount: 1000n }],
  {
    mnemonic: '...',
    appPrefixHex: '51535434',
  }
);
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
  mnemonic: '...', // Optional
  feeOutput: {
    address: 'ecash:q...',
    feeBps: 50, // 0.5%
  },
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
  mnemonic: '...', // Optional
  feeOutput: {
    address: 'ecash:q...',
    feeBps: 100, // 1%
    minSats: 0n, // exact rate; omit or raise for a fee floor
  },
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
| `message` | `string` | XEC-only app message. Uses default prefix `00746162` if `appPrefixHex` is omitted. | `undefined` |
| `appPrefixHex` | `string` | XEC-only custom 4-byte lowercase hex prefix. Can be used with or without `message`. | `undefined` |
| `feeOutput` | `AgoraFeeOutput` | Agora buy-only extra XEC output appended after the taker token output and before change. `feeBps` is basis points; set `minSats` only if you want a fee floor. | `undefined` |

`message` and `appPrefixHex` are only supported for `sendXec()` / XEC transactions.
Token sends keep their protocol-defined `OP_RETURN` handling and reject these options.
Agora `feeOutput` is only supported for `acceptAgoraOffer()` and `buyAgoraTokens()`.

If the calculated Agora fee output is below dust (`546 sats`), the buy call will fail with `FEE_BELOW_DUST` unless you explicitly set `feeOutput.minSats`.

---

## API Summary

- `sendXec(recipients, options)`: Send XEC to one or more addresses.
- `sendToken(recipients, options)`: Send tokens (auto-detects SLP/ALP).
- `createAgoraOffer(options)`: List tokens (SLP or ALP) for sale on Agora.
- `buyAgoraTokens(options)`: Market buy tokens up to a max price.
- `acceptAgoraOffer(offer, options)`: Buy from a specific Agora offer.
- `fetchAgoraOffers(options)`: List available offers for a token.
- `fetchMyAgoraOffers(options)`: List offers created by your mnemonic.
- `cancelAgoraOffer(offer, options)`: Cancel an active offer.

## Changelog

- v2.3.0: Added optional Agora buy `feeOutput` support, exact-rate fee validation, and `local-test6` for live XECX fee-output verification.
- v2.2.0: Added XEC app prefix/message support, parser helpers, and live local tests for message and prefix-only broadcasts.
- v2.0.2: Dynamically calculate minAcceptedAtoms to prevent dust errors.
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
