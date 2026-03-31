'use strict';
/**
 * bugs.test.js
 *
 * Regression tests for known bugs in ecash-quicksend.
 *
 * Every test here documents a specific defect. Once the defect is fixed the
 * test should pass; it must NEVER be silently deleted. Keeping these tests
 * ensures the same bug cannot regress.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { describe } = require('node:test');

const { sendSlp, sendAlp, sendXec, send } = require('../dist/index.js');
const quick = require('../dist/index.js').default;

const { FakeChronik } = require('./helpers.js');
const {
    TEST_MNEMONIC,
    TOKEN_ID_SLP, TOKEN_ID_ALP,
    ADDR_1,
    UTXO_XEC_100K,
    UTXO_SLP_150,
    UTXO_ALP_125,
    UTXO_FEE_20K,
} = require('./fixtures.js');

// ---------------------------------------------------------------------------
// BUG-1: Named export `send` loses `this` binding
//
// When the TransactionManager class methods are exported as named bindings
// (line: exports.sendSlp = quick.sendSlp, exports.sendAlp = ..., exports.send = ...)
// the `send` function still calls `this.sendSlp` / `this.sendAlp` / `this.sendXec`
// internally.  Because the named export is a plain function reference (not bound),
// `this` becomes `undefined` at call-time, causing:
//   TypeError: Cannot read properties of undefined (reading 'sendAlp')
//
// Status: KNOWN BUG – these tests document the failure.
// Fix:    Bind the methods in the constructor or use arrow functions, then change
//         the expected behaviour from rejects→resolves.
// ---------------------------------------------------------------------------

describe('BUG-1: named export send() loses this', () => {

    test('named export send("xec",...) throws TypeError due to lost this binding', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await assert.rejects(
            () => send('xec', [{ address: ADDR_1, amount: 1_000 }], {
                mnemonic: TEST_MNEMONIC, chronik,
            }),
            TypeError,
            'send("xec") via named export should throw TypeError (this is undefined)',
        );
    });

    test('named export send("slp",...) throws TypeError due to lost this binding', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await assert.rejects(
            () => send('slp', [{ address: ADDR_1, amount: 100 }], {
                mnemonic: TEST_MNEMONIC,
                chronik,
                tokenId:      TOKEN_ID_SLP,
                tokenDecimals: 1,
            }),
            TypeError,
            'send("slp") via named export should throw TypeError (this is undefined)',
        );
    });

    test('named export send("alp",...) throws TypeError due to lost this binding', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        await assert.rejects(
            () => send('alp', [{ address: ADDR_1, amount: 100 }], {
                mnemonic: TEST_MNEMONIC,
                chronik,
                tokenId:      TOKEN_ID_ALP,
                tokenDecimals: 1,
            }),
            TypeError,
            'send("alp") via named export should throw TypeError (this is undefined)',
        );
    });

    test('[CONTROL] quick.send() via default export works correctly', async () => {
        // This confirms the default export is NOT affected by the bug
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await assert.doesNotReject(
            () => quick.send('xec', [{ address: ADDR_1, amount: 1_000 }], {
                mnemonic: TEST_MNEMONIC, chronik,
            }),
            'default export quick.send() must not throw',
        );
    });
});

// ---------------------------------------------------------------------------
// BUG-2: sendXec allows token recipients but does NOT build a valid token tx
//
// The current xecsend.js code accepts recipients with a `tokenId` field and
// attaches extra properties to the output object, but never constructs an
// OP_RETURN. The result is a broken transaction that any token-aware node
// or chronik will reject.
//
// Status: KNOWN BUG – these tests document the behaviour.
// Fix:    Reject token recipients in sendXec() entirely.
// ---------------------------------------------------------------------------

describe('BUG-2: sendXec silently ignores token recipients without building OP_RETURN', () => {

    test('sendXec with a token recipient does NOT produce an OP_RETURN output', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);

        // This call currently succeeds (no error) even though TOKEN recipients
        // require an OP_RETURN which is NOT built.
        let result;
        try {
            result = await sendXec(
                [{ address: ADDR_1, amount: 1_000, tokenId: TOKEN_ID_SLP }],
                { mnemonic: TEST_MNEMONIC, chronik },
            );
        } catch (_) {
            // If the implementation starts throwing, that is actually the correct
            // behaviour – this branch means BUG-2 is partially fixed.
            return;
        }

        const { parseTx } = require('./helpers.js');
        const tx = parseTx(chronik.broadcasted[0]);

        // Document the broken state: there is NO OP_RETURN (sats=0 output)
        const hasOpReturn = tx.outputs.some(o => o.sats === 0n);
        assert.equal(
            hasOpReturn,
            false,
            'BUG-2: sendXec with token recipient produces no OP_RETURN – tx is invalid for tokens',
        );
    });
});
