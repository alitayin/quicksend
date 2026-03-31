# ecash-quicksend

[![npm version](https://badge.fury.io/js/ecash-quicksend.svg)](https://badge.fury.io/js/ecash-quicksend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified transaction manager for eCash (XEC), SLP, and ALP token transactions.

## Installation

```bash
npm install ecash-quicksend
```

## Migration Notes

### v1.1.0+
This library no longer calls `dotenv.config()` internally. If you rely on a `.env` file for your mnemonic, call `dotenv.config()` in your own application entry point before using this library:

```javascript
import dotenv from 'dotenv';
dotenv.config(); // call this yourself

import quick from 'ecash-quicksend';
```

### v1.3.0+
`tokenDecimals` is now optional. `amount` in token recipients is in **atoms** (smallest unit). `tokenDecimals` is kept for backward compatibility but has no effect.

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

// Send XEC
await quick.sendXec([
  { address: 'ecash:qq...', amount: 1000 } // 10.00 XEC
]);

// Send XEC with custom mnemonic
await quick.sendXec([
  { address: 'ecash:qq...', amount: 1000 } // 10.00 XEC
], {
  mnemonic: 'your twelve word mnemonic phrase'
});

// Send SLP tokens — amount in atoms (smallest unit)
await quick.sendSlp([
  { address: 'ecash:qq...', amount: 100 } // 100 atoms
], {
  tokenId: 'your-token-id',
});

// Send ALP tokens — amount in atoms (smallest unit)
await quick.sendAlp([
  { address: 'ecash:qq...', amount: 100 } // 100 atoms
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