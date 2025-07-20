# ecash-quicksend

[![npm version](https://badge.fury.io/js/ecash-quicksend.svg)](https://badge.fury.io/js/ecash-quicksend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified transaction manager for eCash (XEC), SLP, and ALP token transactions. Simplify your eCash blockchain interactions with a single, easy-to-use library.

## Features

- ✅ **XEC Transactions**: Send eCash (XEC) with customizable UTXO strategies
- ✅ **SLP Token Support**: Full support for Simple Ledger Protocol tokens
- ✅ **ALP Token Support**: Advanced Ledger Protocol token transactions
- ✅ **TypeScript Support**: Full TypeScript definitions included
- ✅ **Unified API**: Single interface for all transaction types
- ✅ **Flexible Configuration**: Mnemonic-based wallet management
- ✅ **Automatic UTXO Management**: Smart UTXO selection strategies

## Installation

```bash
npm install ecash-quicksend
```

## Quick Start

### 1. Environment Setup

Create a `.env` file in your project root:

```env
# Required: Your wallet mnemonic (12-24 words)
MNEMONIC="your twelve word mnemonic phrase goes here and should be kept secret"
```

### 2. Basic Usage

```javascript
import quick from 'ecash-quicksend';

// Send XEC
const xecResult = await quick.sendXec([
  { address: 'ecash:qq...', amount: 1000 } // 1000 satoshis
]);

// Send SLP tokens
const slpResult = await quick.sendSlp([
  { address: 'ecash:qq...', amount: 100 } // 100 base units = 1.00 token
], {
  tokenId: 'your-slp-token-id',
  tokenDecimals: 2
});

// Send ALP tokens
const alpResult = await quick.sendAlp([
  { address: 'ecash:qq...', amount: 100 } // 100 base units = 0.01 token
], {
  tokenId: 'your-alp-token-id',
  tokenDecimals: 4
});
```

## API Reference

### TransactionManager

The main class that manages all transaction types.

#### Methods

##### `sendXec(recipients, options?)`

Send eCash (XEC) to one or more recipients.

```typescript
await quick.sendXec(
  [{ address: 'ecash:qq...', amount: 1000 }],
  {
    utxoStrategy: 'all', // 'all' | 'largest' | 'smallest'
    addressIndex: 0
  }
);
```

**Parameters:**
- `recipients`: Array of `{ address: string, amount: number }`
- `options`: Optional configuration object

##### `sendSlp(recipients, options)`

Send SLP tokens to one or more recipients.

```typescript
await quick.sendSlp(
  [{ address: 'ecash:qq...', amount: 100 }],
  {
    tokenId: 'your-token-id',
    tokenDecimals: 8,
    addressIndex: 0,
    feeStrategy: 'auto',
    tokenStrategy: 'auto'
  }
);
```

##### `sendAlp(recipients, options)`

Send ALP tokens to one or more recipients.

```typescript
await quick.sendAlp(
  [{ address: 'ecash:qq...', amount: 100 }],
  {
    tokenId: 'your-token-id',
    tokenDecimals: 8,
    addressIndex: 0,
    feeStrategy: 'auto',
    tokenStrategy: 'auto'
  }
);
```

##### `send(type, recipients, options?)`

Universal send method supporting all transaction types.

```typescript
// Send XEC
await quick.send('xec', recipients, {
  utxoStrategy: 'all',
  addressIndex: 0
});

// Send SLP
await quick.send('slp', recipients, {
  tokenId: 'your-token-id',
  tokenDecimals: 8
});

// Send ALP
await quick.send('alp', recipients, {
  tokenId: 'your-token-id',
  tokenDecimals: 8
});
```

## Types

### Recipient

```typescript
interface Recipient {
  address: string;  // eCash address (ecash:qq...)
  amount: number;   // Amount in base units (satoshis for XEC, token units for SLP/ALP)
}
```

### TransactionResult

```typescript
interface TransactionResult {
  txid: string;           // Transaction ID
  success: boolean;       // Transaction success status
  message?: string;       // Optional status message
  rawTx?: string;         // Raw transaction hex
}
```

### Token Transaction Options

```typescript
interface TokenTransactionOptions {
  tokenId: string;              // Token ID
  tokenDecimals: number;        // Token decimal places
  addressIndex?: number;        // Wallet address index (default: 0)
  feeStrategy?: string;         // Fee calculation strategy
  tokenStrategy?: string;       // Token UTXO selection strategy
}
```

### XEC Transaction Options

```typescript
interface XecTransactionOptions {
  utxoStrategy?: string;        // 'all' | 'largest' | 'smallest'
  addressIndex?: number;        // Wallet address index (default: 0)
}
```

## Advanced Usage

### Multiple Recipients

```javascript
// Send to multiple recipients in a single transaction
await quick.sendXec([
  { address: 'ecash:qq...', amount: 1000 },
  { address: 'ecash:qp...', amount: 2000 }
]);
```

### Custom UTXO Strategies

```javascript
// Use largest UTXO first (good for consolidation)
await quick.sendXec(recipients, { utxoStrategy: 'largest' });

// Use smallest UTXO first (good for privacy)
await quick.sendXec(recipients, { utxoStrategy: 'smallest' });

// Use all available UTXOs (default)
await quick.sendXec(recipients, { utxoStrategy: 'all' });
```

### Address Index Management

```javascript
// Use different derived addresses
await quick.sendXec(recipients, { addressIndex: 1 });
await quick.sendSlp(recipients, options, { addressIndex: 2 });
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

## Types

```typescript
interface Recipient {
  address: string;  // eCash address
  amount: number;   // Amount in base units
}

interface TransactionResult {
  txid: string;
  success: boolean;
  message?: string;
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