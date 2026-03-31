'use strict';
/**
 * transaction-builder.test.js
 *
 * Unit tests for:
 *  - buildTransactionInputs()  in transaction-utils.js
 *  - createP2pkhScript()       in transaction-utils.js
 *  - validateRequiredParams()  in transaction-builder.js
 *
 * No network, no chronik, no signing – pure structure and logic tests.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { describe } = require('node:test');

const {
    buildTransactionInputs,
    createP2pkhScript,
} = require('../../dist/transaction/transaction-utils.js');
const {
    validateRequiredParams,
} = require('../../dist/transaction/transaction-builder.js');

const { Ecc, Script, shaRmd160, fromHex } = require('ecash-lib');
const { encodeCashAddress, decodeCashAddress } = require('ecashaddrjs');

const { INT_XEC_100K, INT_XEC_50K, INT_SLP_150, makeInternalXecUtxo, ADDR_1, ADDR_2 } =
    require('../fixtures.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Build a minimal fake wallet keypair for testing inputs
function makeFakeKeypair() {
    const ecc = new Ecc();
    const sk  = fromHex('33'.repeat(32));
    const pk  = ecc.derivePubkey(sk);
    const pkh = shaRmd160(pk);
    return { sk, pk, walletP2pkh: Script.p2pkh(pkh) };
}

// ---------------------------------------------------------------------------
// buildTransactionInputs
// ---------------------------------------------------------------------------

describe('buildTransactionInputs', () => {

    test('maps a flat UTXO array to TxBuilderInput objects correctly', () => {
        const { sk, pk, walletP2pkh } = makeFakeKeypair();
        const utxos  = [INT_XEC_100K, INT_XEC_50K];
        const inputs = buildTransactionInputs(utxos, walletP2pkh, sk, pk);

        assert.equal(inputs.length, 2);

        // First input
        assert.equal(inputs[0].input.prevOut.txid,   INT_XEC_100K.txid);
        assert.equal(inputs[0].input.prevOut.outIdx, INT_XEC_100K.vout);
        assert.equal(inputs[0].input.signData.sats,  BigInt(INT_XEC_100K.value));
        assert.ok(inputs[0].signatory, 'signatory must be present');

        // Second input
        assert.equal(inputs[1].input.prevOut.txid,   INT_XEC_50K.txid);
        assert.equal(inputs[1].input.signData.sats,  BigInt(INT_XEC_50K.value));
    });

    test('all inputs share the same outputScript (walletP2pkh)', () => {
        const { sk, pk, walletP2pkh } = makeFakeKeypair();
        const inputs = buildTransactionInputs([INT_XEC_100K, INT_XEC_50K], walletP2pkh, sk, pk);

        for (const inp of inputs) {
            assert.equal(
                inp.input.signData.outputScript.toHex(),
                walletP2pkh.toHex(),
            );
        }
    });

    test('accepts nested arrays (token + fee UTXOs) and flattens them', () => {
        const { sk, pk, walletP2pkh } = makeFakeKeypair();
        // Passing [[tokenUtxos], [feeUtxos]] – the function should flatten
        const inputs = buildTransactionInputs(
            [[INT_SLP_150], [INT_XEC_100K]],
            walletP2pkh, sk, pk,
        );

        assert.equal(inputs.length, 2);
    });

    test('single UTXO produces exactly one input', () => {
        const { sk, pk, walletP2pkh } = makeFakeKeypair();
        const inputs = buildTransactionInputs([INT_XEC_100K], walletP2pkh, sk, pk);
        assert.equal(inputs.length, 1);
    });

    test('signData.sats is a bigint (required by ecash-lib TxBuilder)', () => {
        const { sk, pk, walletP2pkh } = makeFakeKeypair();
        const inputs = buildTransactionInputs([INT_XEC_100K], walletP2pkh, sk, pk);
        assert.equal(typeof inputs[0].input.signData.sats, 'bigint');
    });
});

// ---------------------------------------------------------------------------
// createP2pkhScript
// ---------------------------------------------------------------------------

describe('createP2pkhScript', () => {

    test('returns a Script for a valid ecash: address', () => {
        const script = createP2pkhScript(ADDR_1);
        assert.ok(script instanceof Script, 'should return a Script instance');
    });

    test('round-trips correctly: address → script → hash matches original', () => {
        const script = createP2pkhScript(ADDR_1);
        const { hash } = decodeCashAddress(ADDR_1);
        // The script bytecode should contain the 20-byte hash
        assert.ok(
            script.toHex().includes(hash),
            `script hex should contain address hash ${hash}`,
        );
    });

    test('two different addresses produce two different scripts', () => {
        const s1 = createP2pkhScript(ADDR_1);
        const s2 = createP2pkhScript(ADDR_2);
        assert.notEqual(s1.toHex(), s2.toHex());
    });

    test('same address always produces the same script', () => {
        const s1 = createP2pkhScript(ADDR_1);
        const s2 = createP2pkhScript(ADDR_1);
        assert.equal(s1.toHex(), s2.toHex());
    });

    test('throws a clear error for an invalid address', () => {
        assert.throws(
            () => createP2pkhScript('not_a_real_address'),
            /Invalid address/,
        );
    });

    test('throws for an empty string', () => {
        assert.throws(
            () => createP2pkhScript(''),
            /Invalid address/,
        );
    });
});

// ---------------------------------------------------------------------------
// validateRequiredParams
// ---------------------------------------------------------------------------

describe('validateRequiredParams', () => {

    test('does not throw when all required params are present', () => {
        assert.doesNotThrow(() =>
            validateRequiredParams(
                { tokenId: 'abc', tokenDecimals: 2 },
                [
                    { key: 'tokenId',     message: 'tokenId required' },
                    { key: 'tokenDecimals', message: 'tokenDecimals required', checkUndefined: true },
                ],
            ),
        );
    });

    test('throws with the specified message when a required key is missing (falsy check)', () => {
        assert.throws(
            () => validateRequiredParams(
                { tokenId: '' },
                [{ key: 'tokenId', message: 'tokenId is required' }],
            ),
            /tokenId is required/,
        );
    });

    test('throws with the specified message when a key is undefined (checkUndefined mode)', () => {
        assert.throws(
            () => validateRequiredParams(
                { tokenDecimals: undefined },
                [{ key: 'tokenDecimals', message: 'tokenDecimals is required', checkUndefined: true }],
            ),
            /tokenDecimals is required/,
        );
    });

    test('does NOT throw for tokenDecimals = 0 in checkUndefined mode (0 is valid)', () => {
        // tokenDecimals of 0 is legitimate – it should NOT trigger the required check
        assert.doesNotThrow(() =>
            validateRequiredParams(
                { tokenDecimals: 0 },
                [{ key: 'tokenDecimals', message: 'tokenDecimals required', checkUndefined: true }],
            ),
        );
    });

    test('throws for the first failing param and stops', () => {
        let thrownMessage;
        try {
            validateRequiredParams(
                { tokenId: '', tokenDecimals: undefined },
                [
                    { key: 'tokenId',     message: 'tokenId is required' },
                    { key: 'tokenDecimals', message: 'tokenDecimals required', checkUndefined: true },
                ],
            );
        } catch (e) {
            thrownMessage = e.message;
        }
        assert.equal(thrownMessage, 'tokenId is required');
    });
});
