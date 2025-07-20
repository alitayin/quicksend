# ecash-quicksend

[![npm version](https://badge.fury.io/js/ecash-quicksend.svg)](https://badge.fury.io/js/ecash-quicksend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A unified transaction manager for eCash (XEC), SLP, and ALP token transactions.

## Installation

```bash
npm install ecash-quicksend
```

## Quick Start

### Setup

**Option 1: Environment Variable (Recommended)**
```env
# .env file
MNEMONIC="your twelve word mnemonic phrase"
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

// Send SLP tokens
await quick.sendSlp([
  { address: 'ecash:qq...', amount: 100 } // 1.00 token
], {
  tokenId: 'your-token-id',
  tokenDecimals: 2
});

// Send ALP tokens
await quick.sendAlp([
  { address: 'ecash:qq...', amount: 100 } // 0.01 token
], {
  tokenId: 'your-token-id',
  tokenDecimals: 4
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
}

// Token Options (SLP/ALP)
{
  tokenId: string;
  tokenDecimals: number;
  addressIndex?: number;
  feeStrategy?: 'all' | 'minimal' | 'largest_first';
  tokenStrategy?: 'all' | 'largest' | 'minimal';
  mnemonic?: string;
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
  tokenDecimals: 2
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