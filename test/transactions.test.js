'use strict';
/**
 * transactions.test.js
 *
 * End-to-end transaction build tests for ecash-quicksend.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { describe } = require('node:test');

const {
    slpSend, alpSend,
    SLP_FUNGIBLE, ALP_STANDARD,
    Script, OP_RETURN, OP_RESERVED, pushBytesOp,
} = require('ecash-lib');

const quick              = require('../dist/index.js').default;
const {
    sendXec,
    sendSlp,
    sendAlp,
    CASHTAB_PREFIX_HEX,
    parseXecAppActionOutput,
} = require('../dist/index.js');

const { FakeChronik, parseTx, computeTxid, assertOutputCount } = require('./helpers.js');
const {
    TEST_MNEMONIC,
    TOKEN_ID_SLP, TOKEN_ID_ALP,
    ADDR_1, ADDR_2, ADDR_3,
    UTXO_XEC_100K, UTXO_XEC_50K, UTXO_XEC_10K,
    UTXO_SLP_150, UTXO_SLP_80, UTXO_SLP_EXACT_100,
    UTXO_ALP_125,
    UTXO_FEE_20K, UTXO_FEE_5K,
    UTXO_SLP_MINTBATON,
} = require('./fixtures.js');

const BASE_OPTS = { mnemonic: TEST_MNEMONIC };

describe('sendXec', () => {
    test('single recipient: produces 2 outputs (recipient + change)', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        const result  = await sendXec(
            [{ address: ADDR_1, amount: 1000n }],
            { ...BASE_OPTS, chronik },
        );

        assert.equal(chronik.broadcasted.length, 1);
        const tx = assertOutputCount(chronik, 2, assert);

        assert.equal(tx.outputs[0].sats, 1000n, 'first output = recipient');
        assert.ok(tx.outputs[1].sats > 0n, 'second output = change > 0');
    });

    test('multiple recipients: produces N+1 outputs', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        const result  = await sendXec(
            [
                { address: ADDR_1, amount: 1000n },
                { address: ADDR_2, amount: 2000n },
                { address: ADDR_3, amount: 3000n },
            ],
            { ...BASE_OPTS, chronik },
        );

        assertOutputCount(chronik, 4, assert);
        assert.equal(result.totalSent, 6000n);
    });

    test('message only: prepends Cashtab-style OP_RETURN', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await sendXec(
            [{ address: ADDR_1, amount: 1000n }],
            { ...BASE_OPTS, chronik, message: 'hello xec' },
        );

        const tx = assertOutputCount(chronik, 3, assert);
        assert.equal(tx.outputs[0].sats, 0n, 'first output = OP_RETURN');
        assert.deepEqual(
            parseXecAppActionOutput(tx.outputs[0].script),
            {
                kind: 'message',
                prefixHex: CASHTAB_PREFIX_HEX,
                message: 'hello xec',
            },
        );
        assert.equal(tx.outputs[1].sats, 1000n, 'second output = recipient');
    });

    test('prefix-only: prepends app marker OP_RETURN', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await sendXec(
            [{ address: ADDR_1, amount: 1000n }],
            { ...BASE_OPTS, chronik, appPrefixHex: '51535434' },
        );

        const tx = assertOutputCount(chronik, 3, assert);
        assert.equal(tx.outputs[0].sats, 0n, 'first output = OP_RETURN');
        assert.deepEqual(
            parseXecAppActionOutput(tx.outputs[0].script),
            {
                kind: 'prefix_only',
                prefixHex: '51535434',
            },
        );
        assert.equal(tx.outputs[1].sats, 1000n, 'second output = recipient');
    });

    test('unified send rejects XEC app data when tokenId is present', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await assert.rejects(
            () => quick.send(
                'xec',
                [{ address: ADDR_1, amount: 100n }],
                {
                    ...BASE_OPTS,
                    chronik,
                    tokenId: TOKEN_ID_SLP,
                    message: 'wrong path',
                },
            ),
            /message\/appPrefixHex only support XEC transactions/,
        );
        assert.equal(chronik.broadcasted.length, 0);
    });
});

describe('sendSlp', () => {
    test('simple SLP send', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        const result  = await sendSlp(
            [{ address: ADDR_1, amount: 100n }],
            { ...BASE_OPTS, chronik, tokenId: TOKEN_ID_SLP },
        );

        assert.equal(chronik.broadcasted.length, 1);
        const tx = assertOutputCount(chronik, 4, assert);
        assert.equal(tx.outputs[0].sats, 0n, 'OP_RETURN');
        assert.equal(tx.outputs[1].sats, 546n, 'recipient 1');
        assert.equal(tx.outputs[2].sats, 546n, 'token change');
    });
});

describe('sendAlp', () => {
    test('simple ALP send', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        const result  = await sendAlp(
            [{ address: ADDR_1, amount: 100n }],
            { ...BASE_OPTS, chronik, tokenId: TOKEN_ID_ALP },
        );

        assert.equal(chronik.broadcasted.length, 1);
        const tx = assertOutputCount(chronik, 4, assert);
    });
});
