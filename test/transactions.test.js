'use strict';
/**
 * transactions.test.js
 *
 * End-to-end transaction build tests for ecash-quicksend.
 *
 * Philosophy (mirrors ecash-wallet/test/transactions.test.ts):
 *  - Call the real public API (sendXec / sendSlp / sendAlp / quick.send)
 *  - Inject a FakeChronik so no network is required
 *  - Deserialize the resulting raw tx and assert its *structure*:
 *      input count, output count, per-output sats, OP_RETURN script bytes
 *  - Assert result metadata (txid, recipients, totalSent, …)
 *  - Cover both happy paths and error paths
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
const { sendXec, sendSlp, sendAlp } = require('../dist/index.js');

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

// Default options shared by most tests
const BASE_OPTS = { mnemonic: TEST_MNEMONIC };

// ---------------------------------------------------------------------------
// sendXec
// ---------------------------------------------------------------------------

describe('sendXec', () => {

    test('single recipient: produces 2 outputs (recipient + change)', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        const result  = await sendXec(
            [{ address: ADDR_1, amount: 1_000 }],
            { ...BASE_OPTS, chronik },
        );

        assert.equal(chronik.broadcasted.length, 1);
        const tx = assertOutputCount(chronik, 2, assert);

        assert.equal(tx.outputs[0].sats, 1000n, 'first output = recipient');
        assert.ok(tx.outputs[1].sats > 0n, 'second output = change > 0');
    });

    test('multiple recipients: produces N+1 outputs (N recipients + change)', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        const result  = await sendXec(
            [
                { address: ADDR_1, amount: 1_000 },
                { address: ADDR_2, amount: 2_000 },
                { address: ADDR_3, amount: 3_000 },
            ],
            { ...BASE_OPTS, chronik },
        );

        const tx = assertOutputCount(chronik, 4, assert);
        assert.equal(tx.outputs[0].sats, 1000n);
        assert.equal(tx.outputs[1].sats, 2000n);
        assert.equal(tx.outputs[2].sats, 3000n);
        assert.ok(tx.outputs[3].sats > 0n, 'change output');
    });

    test('result.txid matches broadcastResult and is deterministic', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        const result  = await sendXec(
            [{ address: ADDR_1, amount: 1_000 }],
            { ...BASE_OPTS, chronik },
        );

        assert.equal(result.txid, result.broadcastResult);
        // Also verify it matches the txid we can compute ourselves
        assert.equal(result.txid, computeTxid(chronik.broadcasted[0]));
    });

    test('result metadata: recipients, xecRecipients, tokenRecipients, totalSent', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        const result  = await sendXec(
            [
                { address: ADDR_1, amount: 1_000 },
                { address: ADDR_2, amount: 2_000 },
            ],
            { ...BASE_OPTS, chronik },
        );

        assert.equal(result.recipients,      2);
        assert.equal(result.xecRecipients,   2);
        assert.equal(result.tokenRecipients, 0);
        assert.equal(result.totalSent,       3_000);
    });

    test('utxoStrategy "all": uses all XEC UTXOs as inputs', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K, UTXO_XEC_50K, UTXO_XEC_10K]);
        await sendXec(
            [{ address: ADDR_1, amount: 1_000 }],
            { ...BASE_OPTS, chronik, utxoStrategy: 'all' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        assert.equal(tx.inputs.length, 3, 'all 3 UTXOs should be inputs');
    });

    test('utxoStrategy "minimal": uses fewer inputs than "all"', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K, UTXO_XEC_50K, UTXO_XEC_10K]);
        await sendXec(
            [{ address: ADDR_1, amount: 1_000 }],
            { ...BASE_OPTS, chronik, utxoStrategy: 'minimal' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        // minimal should pick 100K alone and stop
        assert.equal(tx.inputs.length, 1);
    });

    test('chronik.script() is called exactly once (address lookup)', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await sendXec([{ address: ADDR_1, amount: 1_000 }], { ...BASE_OPTS, chronik });
        assert.equal(chronik.scriptCalls.length, 1);
    });

    test('throws when recipients array is empty', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await assert.rejects(
            () => sendXec([], { ...BASE_OPTS, chronik }),
            /recipients must be a non-empty array/,
        );
    });

    test('throws when balance is insufficient', async () => {
        // Only 100 sats available, trying to send 50 000
        const { makeXecUtxo } = require('./fixtures.js');
        const tinyUtxo = makeXecUtxo({ txidByte: 'fa', sats: 100 });
        const chronik  = new FakeChronik([tinyUtxo]);
        await assert.rejects(
            () => sendXec([{ address: ADDR_1, amount: 50_000 }], { ...BASE_OPTS, chronik }),
            /Insufficient balance/,
        );
    });
});

// ---------------------------------------------------------------------------
// sendSlp
// ---------------------------------------------------------------------------

describe('sendSlp', () => {

    const slpOpts = { ...BASE_OPTS, tokenId: TOKEN_ID_SLP, tokenDecimals: 1 };

    test('output[0] is OP_RETURN with sats = 0', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await sendSlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...slpOpts, chronik, tokenStrategy: 'largest' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        assert.equal(tx.outputs[0].sats, 0n, 'OP_RETURN must have 0 sats');
    });

    test('output[0] script equals slpSend(tokenId, SLP_FUNGIBLE, [send, change])', async () => {
        // 150 atoms total, sending 100 → change 50
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await sendSlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...slpOpts, chronik, tokenStrategy: 'largest' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        const expectedOpReturn = slpSend(TOKEN_ID_SLP, SLP_FUNGIBLE, [100n, 50n]);
        assert.equal(
            tx.outputs[0].script.toHex(),
            expectedOpReturn.toHex(),
            'OP_RETURN script must match slpSend()',
        );
    });

    test('with token change: 4 outputs (OP_RETURN + recipient + token change + fee change)', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await sendSlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...slpOpts, chronik, tokenStrategy: 'largest' },
        );
        assertOutputCount(chronik, 4, assert);
    });

    test('without token change: 3 outputs (OP_RETURN + recipient + fee change)', async () => {
        // UTXO_SLP_EXACT_100 has exactly 100 atoms → no token change
        const chronik = new FakeChronik([UTXO_SLP_EXACT_100, UTXO_FEE_20K]);
        await sendSlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...slpOpts, chronik, tokenStrategy: 'largest' },
        );
        assertOutputCount(chronik, 3, assert);
    });

    test('recipient and token-change outputs have exactly dust sats (546n)', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await sendSlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...slpOpts, chronik, tokenStrategy: 'largest' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        assert.equal(tx.outputs[1].sats, 546n, 'recipient output = 546 sats');
        assert.equal(tx.outputs[2].sats, 546n, 'token-change output = 546 sats');
    });

    test('fee-change output sats > 0', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await sendSlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...slpOpts, chronik, tokenStrategy: 'largest' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        assert.ok(tx.outputs[3].sats > 0n, 'fee-change must be positive');
    });

    test('multi-recipient: OP_RETURN encodes all send amounts', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await sendSlp(
            [
                { address: ADDR_1, amount: 60 },
                { address: ADDR_2, amount: 40 },
            ],
            { ...slpOpts, chronik, tokenStrategy: 'all' },
        );

        const tx       = parseTx(chronik.broadcasted[0]);
        const expected = slpSend(TOKEN_ID_SLP, SLP_FUNGIBLE, [60n, 40n, 50n]); // 150 total, 150-100=50 change
        assert.equal(tx.outputs[0].script.toHex(), expected.toHex());
    });

    test('tokenStrategy "all": uses all token UTXOs as inputs', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_SLP_80, UTXO_FEE_20K]);
        await sendSlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...slpOpts, chronik, tokenStrategy: 'all' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        // 2 token inputs + fee inputs
        assert.ok(tx.inputs.length >= 2, 'should include both token UTXOs');
    });

    test('throws when token balance is insufficient', async () => {
        const chronik = new FakeChronik([UTXO_SLP_80, UTXO_FEE_20K]);
        await assert.rejects(
            () => sendSlp(
                [{ address: ADDR_1, amount: 100 }],
                { ...slpOpts, chronik, tokenStrategy: 'largest' },
            ),
            /Insufficient token balance/,
        );
    });

    test('throws when tokenId is missing', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await assert.rejects(
            () => sendSlp(
                [{ address: ADDR_1, amount: 100 }],
                { mnemonic: TEST_MNEMONIC, tokenDecimals: 1, chronik },
            ),
            /tokenId is required/,
        );
    });

    test('throws when tokenDecimals is missing', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await assert.rejects(
            () => sendSlp(
                [{ address: ADDR_1, amount: 100 }],
                { mnemonic: TEST_MNEMONIC, tokenId: TOKEN_ID_SLP, chronik },
            ),
            /tokenDecimals is required/,
        );
    });
});

// ---------------------------------------------------------------------------
// sendAlp
// ---------------------------------------------------------------------------

describe('sendAlp', () => {

    const alpOpts = { ...BASE_OPTS, tokenId: TOKEN_ID_ALP, tokenDecimals: 1 };

    test('output[0] is OP_RETURN with sats = 0', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        await sendAlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...alpOpts, chronik, tokenStrategy: 'largest' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        assert.equal(tx.outputs[0].sats, 0n);
    });

    test('output[0] script equals ALP OP_RETURN+OP_RESERVED+pushBytesOp(alpSend(...))', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        await sendAlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...alpOpts, chronik, tokenStrategy: 'largest' },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        const expectedScript = Script.fromOps([
            OP_RETURN,
            OP_RESERVED,
            pushBytesOp(alpSend(TOKEN_ID_ALP, ALP_STANDARD, [100n, 25n])),
        ]);
        assert.equal(
            tx.outputs[0].script.toHex(),
            expectedScript.toHex(),
            'ALP OP_RETURN script must match',
        );
    });

    test('with token change: 4 outputs', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        await sendAlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...alpOpts, chronik, tokenStrategy: 'largest' },
        );
        assertOutputCount(chronik, 4, assert);
    });

    test('result.txid equals computeTxid of broadcasted hex', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        const result  = await sendAlp(
            [{ address: ADDR_1, amount: 100 }],
            { ...alpOpts, chronik, tokenStrategy: 'largest' },
        );

        assert.equal(result.txid, computeTxid(chronik.broadcasted[0]));
    });

    test('throws when token balance is insufficient', async () => {
        const { makeTokenUtxo } = require('./fixtures.js');
        const smallAlp = makeTokenUtxo({ txidByte: 'f9', tokenId: TOKEN_ID_ALP, atoms: 50 });
        const chronik  = new FakeChronik([smallAlp, UTXO_FEE_20K]);
        await assert.rejects(
            () => sendAlp(
                [{ address: ADDR_1, amount: 100 }],
                { ...alpOpts, chronik, tokenStrategy: 'largest' },
            ),
            /Insufficient token balance/,
        );
    });
});

// ---------------------------------------------------------------------------
// quick.send() – universal send method
// ---------------------------------------------------------------------------

describe('quick.send()', () => {

    test('send("xec", ...) is equivalent to sendXec(...)', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        const result  = await quick.send(
            'xec',
            [{ address: ADDR_1, amount: 1_000 }],
            { ...BASE_OPTS, chronik },
        );

        assert.equal(chronik.broadcasted.length, 1);
        assert.equal(result.txid, computeTxid(chronik.broadcasted[0]));
    });

    test('send("slp", ...) produces the same SLP structure as sendSlp(...)', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await quick.send(
            'slp',
            [{ address: ADDR_1, amount: 100 }],
            {
                ...BASE_OPTS,
                chronik,
                tokenId:      TOKEN_ID_SLP,
                tokenDecimals: 1,
                tokenStrategy: 'largest',
            },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        assert.equal(tx.outputs[0].sats, 0n, 'first output is OP_RETURN');
        assertOutputCount(chronik, 4, assert);
    });

    test('send("alp", ...) produces the same ALP structure as sendAlp(...)', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        await quick.send(
            'alp',
            [{ address: ADDR_1, amount: 100 }],
            {
                ...BASE_OPTS,
                chronik,
                tokenId:      TOKEN_ID_ALP,
                tokenDecimals: 1,
                tokenStrategy: 'largest',
            },
        );

        const tx = parseTx(chronik.broadcasted[0]);
        assert.equal(tx.outputs[0].sats, 0n);
        assertOutputCount(chronik, 4, assert);
    });

    test('send("SLP", ...) is case-insensitive', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await assert.doesNotReject(() =>
            quick.send(
                'SLP',
                [{ address: ADDR_1, amount: 100 }],
                {
                    ...BASE_OPTS,
                    chronik,
                    tokenId:      TOKEN_ID_SLP,
                    tokenDecimals: 1,
                    tokenStrategy: 'largest',
                },
            ),
        );
    });

    test('send("slp", ...) throws when tokenId is missing', async () => {
        const chronik = new FakeChronik([UTXO_SLP_150, UTXO_FEE_20K]);
        await assert.rejects(
            () => quick.send('slp', [{ address: ADDR_1, amount: 100 }], {
                ...BASE_OPTS, chronik, tokenDecimals: 1,
            }),
            /tokenId/,
        );
    });

    test('send("alp", ...) throws when tokenDecimals is missing', async () => {
        const chronik = new FakeChronik([UTXO_ALP_125, UTXO_FEE_20K]);
        await assert.rejects(
            () => quick.send('alp', [{ address: ADDR_1, amount: 100 }], {
                ...BASE_OPTS, chronik, tokenId: TOKEN_ID_ALP,
            }),
            /tokenDecimals/,
        );
    });

    test('send("unknown", ...) throws with Unsupported transaction type', async () => {
        const chronik = new FakeChronik([UTXO_XEC_100K]);
        await assert.rejects(
            () => quick.send('unknown', [{ address: ADDR_1, amount: 1_000 }], {
                ...BASE_OPTS, chronik,
            }),
            /Unsupported transaction type/,
        );
    });
});
