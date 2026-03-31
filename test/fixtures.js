'use strict';
/**
 * fixtures.js
 *
 * Shared, deterministic test data for all ecash-quicksend tests.
 * All values are fixed so test outcomes are predictable and reproducible.
 * Pattern modeled after ecash-wallet/src/wallet.test.ts fixture definitions.
 */

const { encodeCashAddress } = require('ecashaddrjs');

// ---------------------------------------------------------------------------
// Mnemonics
// ---------------------------------------------------------------------------

const TEST_MNEMONIC =
    'morning average minor stable parrot refuse credit exercise february mirror just begin';

// A second distinct mnemonic for multi-wallet tests
const TEST_MNEMONIC_ALT =
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';

// ---------------------------------------------------------------------------
// Helpers for building deterministic data
// ---------------------------------------------------------------------------

/**
 * Build a 32-byte txid hex string by repeating a 2-char hex byte.
 * e.g. makeTxid('aa') → 'aaaa...aa' (64 chars)
 */
const makeTxid = hexByte => hexByte.repeat(32);

/**
 * Build a valid ecash P2PKH address by repeating a 2-char hex byte (20 bytes).
 * e.g. makeAddress('11') → 'ecash:qq...'
 */
const makeAddress = hexByte =>
    encodeCashAddress('ecash', 'p2pkh', Buffer.from(hexByte.repeat(20), 'hex'));

// ---------------------------------------------------------------------------
// Token IDs (64-char hex, exactly 32 bytes)
// ---------------------------------------------------------------------------

const TOKEN_ID_SLP = makeTxid('aa');  // fake SLP fungible token ID
const TOKEN_ID_ALP = makeTxid('bb');  // fake ALP standard token ID
const TOKEN_ID_SLP_2 = makeTxid('cc'); // second SLP token for multi-token tests

// ---------------------------------------------------------------------------
// Recipient addresses
// ---------------------------------------------------------------------------

const ADDR_1 = makeAddress('11');
const ADDR_2 = makeAddress('22');
const ADDR_3 = makeAddress('33');
const ADDR_4 = makeAddress('44');

// ---------------------------------------------------------------------------
// UTXO factory functions
// Return objects shaped to match chronik-client ScriptUtxo response,
// which is what your getUtxos() maps from:
//   utxo.outpoint.txid  → txid
//   utxo.outpoint.outIdx → vout
//   utxo.sats           → value (your code converts to Number)
//   utxo.token          → slpToken
// ---------------------------------------------------------------------------

/**
 * Build a plain XEC UTXO (no token).
 */
const makeXecUtxo = ({ txidByte, outIdx = 0, sats }) => ({
    outpoint: { txid: makeTxid(txidByte), outIdx },
    sats: BigInt(sats),
    token: undefined,
});

/**
 * Build a token UTXO (SLP or ALP – your getUtxos() maps utxo.token to slpToken).
 */
const makeTokenUtxo = ({ txidByte, outIdx = 0, sats = 546, tokenId, atoms }) => ({
    outpoint: { txid: makeTxid(txidByte), outIdx },
    sats: BigInt(sats),
    token: {
        tokenId,
        atoms: String(atoms),
        isMintBaton: false,
    },
});

/**
 * Build a mint-baton UTXO (excluded from sends).
 */
const makeMintBatonUtxo = ({ txidByte, outIdx = 0, tokenId }) => ({
    outpoint: { txid: makeTxid(txidByte), outIdx },
    sats: 546n,
    token: {
        tokenId,
        atoms: '0',
        isMintBaton: true,
    },
});

// ---------------------------------------------------------------------------
// Pre-built standard fixture UTXOs
// ---------------------------------------------------------------------------

// A healthy XEC-only wallet with a single 100 000 sat UTXO
const UTXO_XEC_100K = makeXecUtxo({ txidByte: 'f1', sats: 100_000 });

// Two XEC UTXOs of different sizes (useful for strategy tests)
const UTXO_XEC_10K  = makeXecUtxo({ txidByte: 'f2', sats: 10_000 });
const UTXO_XEC_50K  = makeXecUtxo({ txidByte: 'f3', sats: 50_000 });
const UTXO_XEC_200K = makeXecUtxo({ txidByte: 'f4', sats: 200_000 });

// SLP token UTXOs
const UTXO_SLP_150  = makeTokenUtxo({ txidByte: 'e1', tokenId: TOKEN_ID_SLP, atoms: 150 });
const UTXO_SLP_80   = makeTokenUtxo({ txidByte: 'e2', tokenId: TOKEN_ID_SLP, atoms: 80  });
const UTXO_SLP_30   = makeTokenUtxo({ txidByte: 'e3', tokenId: TOKEN_ID_SLP, atoms: 30  });
const UTXO_SLP_EXACT_100 = makeTokenUtxo({ txidByte: 'e4', tokenId: TOKEN_ID_SLP, atoms: 100 });

// ALP token UTXO
const UTXO_ALP_200  = makeTokenUtxo({ txidByte: 'd1', tokenId: TOKEN_ID_ALP, atoms: 200 });
const UTXO_ALP_125  = makeTokenUtxo({ txidByte: 'd2', tokenId: TOKEN_ID_ALP, atoms: 125 });

// Mint baton (must NOT be selected for sends)
const UTXO_SLP_MINTBATON = makeMintBatonUtxo({ txidByte: 'e9', tokenId: TOKEN_ID_SLP });

// Fee UTXO to pair with token UTXOs
const UTXO_FEE_20K  = makeXecUtxo({ txidByte: 'c1', sats: 20_000 });
const UTXO_FEE_5K   = makeXecUtxo({ txidByte: 'c2', sats: 5_000  });

// ---------------------------------------------------------------------------
// Internal-format UTXOs (after getUtxos() mapping)
// Your selectUtxos / selectSlpUtxos work on these mapped objects:
//   { txid, vout, value, slpToken }
// ---------------------------------------------------------------------------

const makeInternalXecUtxo = ({ txidByte, outIdx = 0, value }) => ({
    txid: makeTxid(txidByte),
    vout: outIdx,
    value,
    address: ADDR_1,
    slpToken: undefined,
});

const makeInternalTokenUtxo = ({ txidByte, outIdx = 0, value = 546, tokenId, atoms }) => ({
    txid: makeTxid(txidByte),
    vout: outIdx,
    value,
    address: ADDR_1,
    slpToken: {
        tokenId,
        atoms: String(atoms),
        isMintBaton: false,
    },
});

// Pre-built internal UTXOs used in unit tests
const INT_XEC_100K  = makeInternalXecUtxo({ txidByte: 'f1', value: 100_000 });
const INT_XEC_50K   = makeInternalXecUtxo({ txidByte: 'f3', value: 50_000  });
const INT_XEC_10K   = makeInternalXecUtxo({ txidByte: 'f2', value: 10_000  });
const INT_XEC_200K  = makeInternalXecUtxo({ txidByte: 'f4', value: 200_000 });

const INT_SLP_150   = makeInternalTokenUtxo({ txidByte: 'e1', tokenId: TOKEN_ID_SLP, atoms: 150 });
const INT_SLP_80    = makeInternalTokenUtxo({ txidByte: 'e2', tokenId: TOKEN_ID_SLP, atoms: 80  });
const INT_SLP_30    = makeInternalTokenUtxo({ txidByte: 'e3', tokenId: TOKEN_ID_SLP, atoms: 30  });
const INT_SLP_EXACT = makeInternalTokenUtxo({ txidByte: 'e4', tokenId: TOKEN_ID_SLP, atoms: 100 });
const INT_FEE_20K   = makeInternalXecUtxo({ txidByte: 'c1', value: 20_000 });
const INT_FEE_5K    = makeInternalXecUtxo({ txidByte: 'c2', value: 5_000  });

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    // Mnemonics
    TEST_MNEMONIC,
    TEST_MNEMONIC_ALT,

    // Helpers
    makeTxid,
    makeAddress,
    makeXecUtxo,
    makeTokenUtxo,
    makeMintBatonUtxo,
    makeInternalXecUtxo,
    makeInternalTokenUtxo,

    // Token IDs
    TOKEN_ID_SLP,
    TOKEN_ID_ALP,
    TOKEN_ID_SLP_2,

    // Addresses
    ADDR_1,
    ADDR_2,
    ADDR_3,
    ADDR_4,

    // Chronik-shaped UTXOs (for FakeChronik)
    UTXO_XEC_100K,
    UTXO_XEC_10K,
    UTXO_XEC_50K,
    UTXO_XEC_200K,
    UTXO_SLP_150,
    UTXO_SLP_80,
    UTXO_SLP_30,
    UTXO_SLP_EXACT_100,
    UTXO_ALP_200,
    UTXO_ALP_125,
    UTXO_SLP_MINTBATON,
    UTXO_FEE_20K,
    UTXO_FEE_5K,

    // Internal-mapped UTXOs (for unit tests)
    INT_XEC_100K,
    INT_XEC_50K,
    INT_XEC_10K,
    INT_XEC_200K,
    INT_SLP_150,
    INT_SLP_80,
    INT_SLP_30,
    INT_SLP_EXACT,
    INT_FEE_20K,
    INT_FEE_5K,
};
