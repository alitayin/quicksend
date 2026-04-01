'use strict';
/**
 * bugs.test.js
 *
 * Regression tests for known bugs in ecash-quicksend.
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

describe('BUG-1: named export send() loses this', () => {
    test('named export send("xec",...) throws TypeError due to lost this binding', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await assert.rejects(
            () => send('xec', [{ address: ADDR_1, amount: 1000n }], {
                mnemonic: TEST_MNEMONIC, chronik,
            }),
            TypeError,
        );
    });
});

describe('BUG-2: sendXec silently ignores token recipients without building OP_RETURN', () => {
    test('sendXec with a token recipient does NOT produce an OP_RETURN output', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        try {
            await sendXec(
                [{ address: ADDR_1, amount: 1000n, tokenId: TOKEN_ID_SLP }],
                { mnemonic: TEST_MNEMONIC, chronik },
            );
        } catch (_) {
            return;
        }

        const { parseTx } = require('./helpers.js');
        const tx = parseTx(chronik.broadcasted[0]);
        const hasOpReturn = tx.outputs.some(o => o.sats === 0n);
        assert.equal(hasOpReturn, false);
    });
});
