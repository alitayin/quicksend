'use strict';
/**
 * utxo.test.js
 *
 * Unit tests for selectUtxos() and selectSlpUtxos() in utxo-utils.js.
 *
 * These tests operate on already-mapped (internal) UTXO objects and require
 * NO network, NO chronik, NO ecash-lib signing – pure logic only.
 *
 * Test structure mirrors ecash-wallet's context('selectUtxos', ...) block.
 */

const test    = require('node:test');
const assert  = require('node:assert/strict');
const { describe } = require('node:test');

const { selectUtxos, selectSlpUtxos } = require('../../dist/utxo/utxo-utils.js');
const {
    TOKEN_ID_SLP,
    TOKEN_ID_SLP_2,
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
    makeInternalXecUtxo,
    makeInternalTokenUtxo,
    ADDR_1,
} = require('../fixtures.js');

// ---------------------------------------------------------------------------
// selectUtxos
// ---------------------------------------------------------------------------

describe('selectUtxos', () => {

    test('strategy "all": returns ALL non-token UTXOs and ignores token UTXOs', () => {
        const utxos = [INT_XEC_100K, INT_XEC_50K, INT_SLP_150];
        const result = selectUtxos(utxos, 1000, 'all');

        assert.equal(result.selectedUtxos.length, 2);
        assert.equal(result.totalInputValue, 150_000);
        assert.equal(result.utxoCount, 2);
        // token UTXO must not appear
        assert.ok(result.selectedUtxos.every(u => !u.slpToken));
    });

    test('strategy "all": totalInputValue, estimatedFee, changeAmount are consistent', () => {
        const utxos = [INT_XEC_100K];
        const sendAmount = 10_000;
        const result = selectUtxos(utxos, sendAmount, 'all');

        assert.equal(result.totalInputValue, 100_000);
        assert.equal(result.changeAmount, result.totalInputValue - sendAmount - result.estimatedFee);
    });

    test('strategy "minimal": selects fewest UTXOs that cover amount + estimated fee', () => {
        // 200K alone is enough; 10K + 50K together are also enough but "minimal" should prefer fewer
        const utxos = [INT_XEC_10K, INT_XEC_50K, INT_XEC_200K];
        const result = selectUtxos(utxos, 5_000, 'minimal');

        // With minimal, the largest UTXO (200K) should be selected first and alone be sufficient
        assert.equal(result.selectedUtxos.length, 1);
        assert.equal(result.selectedUtxos[0].value, 200_000);
    });

    test('strategy "minimal": selects multiple UTXOs when no single one is enough', () => {
        // Largest available is 50K; need 80K → must combine two
        const utxos = [
            makeInternalXecUtxo({ txidByte: 'a1', value: 50_000 }),
            makeInternalXecUtxo({ txidByte: 'a2', value: 50_000 }),
        ];
        const result = selectUtxos(utxos, 80_000, 'minimal');
        assert.equal(result.selectedUtxos.length, 2);
    });

    test('strategy "largest_first": returns all non-token UTXOs sorted descending by value', () => {
        const utxos = [INT_XEC_10K, INT_XEC_200K, INT_XEC_50K];
        const result = selectUtxos(utxos, 1_000, 'largest_first');

        const values = result.selectedUtxos.map(u => u.value);
        const sorted = [...values].sort((a, b) => b - a);
        assert.deepEqual(values, sorted);
        assert.equal(values[0], 200_000);
    });

    test('throws when ALL UTXOs are token UTXOs (no XEC available)', () => {
        const utxos = [INT_SLP_150, INT_SLP_80];
        assert.throws(
            () => selectUtxos(utxos, 1_000, 'all'),
            /No non-SLP UTXOs available/,
        );
    });

    test('throws when balance is insufficient even after selecting all UTXOs', () => {
        const utxos = [makeInternalXecUtxo({ txidByte: 'b1', value: 100 })];
        assert.throws(
            () => selectUtxos(utxos, 50_000, 'all'),
            /Insufficient balance/,
        );
    });

    test('throws with error message containing totalInputValue and required amount', () => {
        const utxos = [makeInternalXecUtxo({ txidByte: 'b2', value: 500 })];
        let caught;
        try {
            selectUtxos(utxos, 50_000, 'all');
        } catch (e) {
            caught = e;
        }
        assert.ok(caught, 'should have thrown');
        assert.ok(caught.message.includes('Insufficient balance'), `message: ${caught.message}`);
        assert.ok(caught.message.includes('500'), `message should contain totalInput: ${caught.message}`);
    });

    test('throws on unknown strategy name', () => {
        const utxos = [INT_XEC_100K];
        assert.throws(
            () => selectUtxos(utxos, 1_000, 'super_optimal'),
            /Unknown UTXO selection strategy/,
        );
    });

    test('empty UTXO array treated the same as all-token (throws)', () => {
        assert.throws(
            () => selectUtxos([], 1_000, 'all'),
            /No non-SLP UTXOs available/,
        );
    });

    test('coinbase UTXOs are excluded from selection', () => {
        const coinbaseUtxo = { ...makeInternalXecUtxo({ txidByte: 'cb', value: 500_000 }), isCoinbase: true };
        // Only the coinbase UTXO — should throw as if no UTXOs available
        assert.throws(
            () => selectUtxos([coinbaseUtxo], 1_000, 'all'),
            /No non-SLP UTXOs available/,
        );
    });

    test('coinbase UTXOs are excluded but non-coinbase UTXOs are still used', () => {
        const coinbaseUtxo = { ...makeInternalXecUtxo({ txidByte: 'cb', value: 500_000 }), isCoinbase: true };
        const result = selectUtxos([coinbaseUtxo, INT_XEC_100K], 1_000, 'all');
        assert.equal(result.selectedUtxos.length, 1);
        assert.equal(result.selectedUtxos[0].value, 100_000);
    });
});

// ---------------------------------------------------------------------------
// selectSlpUtxos
// ---------------------------------------------------------------------------

describe('selectSlpUtxos', () => {

    // Shared recipient helpers
    const recipient100 = [{ address: ADDR_1, amount: 100 }];
    const recipient50  = [{ address: ADDR_1, amount: 50  }];

    test('tokenStrategy "largest": selects the single token UTXO with most atoms', () => {
        const utxos = [INT_SLP_150, INT_SLP_80, INT_SLP_30, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
            tokenStrategy: 'largest',
        });

        assert.equal(result.selectedTokenUtxos.length, 1);
        assert.equal(result.selectedTokenUtxos[0].slpToken.atoms, '150');
    });

    test('tokenStrategy "all": selects ALL token UTXOs for this tokenId', () => {
        const utxos = [INT_SLP_150, INT_SLP_80, INT_SLP_30, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
            tokenStrategy: 'all',
        });

        assert.equal(result.selectedTokenUtxos.length, 3);
        assert.equal(result.totalTokens, 260n);
    });

    test('tokenStrategy "minimal": selects the smallest UTXO that alone covers send amount', () => {
        // 150 and 80 are both >= 50; minimal should pick 80
        const utxos = [INT_SLP_150, INT_SLP_80, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient50, 0, {
            tokenStrategy: 'minimal',
        });

        assert.equal(result.selectedTokenUtxos.length, 1);
        assert.equal(result.selectedTokenUtxos[0].slpToken.atoms, '80');
    });

    test('tokenChange is correctly calculated (totalTokens - totalSendTokens)', () => {
        const utxos = [INT_SLP_150, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
            tokenStrategy: 'largest',
        });

        assert.equal(result.tokenChange, 50n);
        assert.equal(result.totalSendTokens, 100n);
    });

    test('finalSendAmounts includes token change when tokenChange > 0', () => {
        const utxos = [INT_SLP_150, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
            tokenStrategy: 'largest',
        });

        // [sendAmount, tokenChange]
        assert.equal(result.finalSendAmounts.length, 2);
        assert.equal(result.finalSendAmounts[0], 100n);
        assert.equal(result.finalSendAmounts[1], 50n);
    });

    test('finalSendAmounts does NOT include token change when send is exact', () => {
        const utxos = [INT_SLP_EXACT, INT_FEE_20K]; // exact 100 atoms
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
            tokenStrategy: 'largest',
        });

        assert.equal(result.tokenChange, 0n);
        assert.equal(result.finalSendAmounts.length, 1);
        assert.equal(result.finalSendAmounts[0], 100n);
    });

    test('summary.totalOutputs = 1 (OP_RETURN) + recipients + tokenChange + feeChange', () => {
        const utxos = [INT_SLP_150, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
            tokenStrategy: 'largest',
        });

        // 1 OP_RETURN + 1 recipient + 1 token change + 1 fee change = 4
        assert.equal(result.summary.totalOutputs, 4);
        assert.equal(result.summary.hasTokenChange, true);
        assert.equal(result.summary.recipientCount, 1);
    });

    test('feeStrategy "all": all non-token UTXOs are used as fee inputs', () => {
        const utxos = [INT_SLP_150, INT_FEE_20K, INT_FEE_5K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
            tokenStrategy: 'largest',
            feeStrategy: 'all',
        });

        assert.equal(result.selectedFeeUtxos.length, 2);
        assert.equal(result.totalFeeInputValue, 25_000);
    });

    test('throws when no token UTXOs for this tokenId', () => {
        // Only has SLP_2 tokens, not TOKEN_ID_SLP
        const utxos = [
            makeInternalTokenUtxo({ txidByte: 'z1', tokenId: TOKEN_ID_SLP_2, atoms: 200 }),
            INT_FEE_20K,
        ];
        assert.throws(
            () => selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0),
            new RegExp(`No SLP UTXOs available for token ${TOKEN_ID_SLP}`),
        );
    });

    test('throws when no fee UTXOs available', () => {
        const utxos = [INT_SLP_150]; // no XEC utxo
        assert.throws(
            () => selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0),
            /No non-SLP UTXOs available for fee payment/,
        );
    });

    test('throws when token balance is insufficient', () => {
        // Only 30 atoms available but trying to send 100
        const utxos = [INT_SLP_30, INT_FEE_20K];
        assert.throws(
            () => selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
                tokenStrategy: 'largest',
            }),
            /Insufficient token balance/,
        );
    });

    test('throws when minimal strategy finds no single UTXO large enough', () => {
        // Two 30-atom UTXOs but need 100; minimal only picks single UTXOs
        const utxos = [
            makeInternalTokenUtxo({ txidByte: 'z2', tokenId: TOKEN_ID_SLP, atoms: 30 }),
            makeInternalTokenUtxo({ txidByte: 'z3', tokenId: TOKEN_ID_SLP, atoms: 30 }),
            INT_FEE_20K,
        ];
        assert.throws(
            () => selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
                tokenStrategy: 'minimal',
            }),
            /Insufficient token balance/,
        );
    });

    test('throws when fee balance is insufficient', () => {
        // Token is fine but XEC fee UTXO is too small
        const utxos = [
            INT_SLP_150,
            makeInternalXecUtxo({ txidByte: 'z4', value: 1 }), // 1 sat is not enough
        ];
        assert.throws(
            () => selectSlpUtxos(utxos, TOKEN_ID_SLP, recipient100, 0, {
                tokenStrategy: 'largest',
                feeStrategy: 'all',
            }),
            /Insufficient balance for fees/,
        );
    });

    test('multi-recipient: totalSendTokens is sum of all recipient amounts', () => {
        const recipients = [
            { address: ADDR_1, amount: 50 },
            { address: ADDR_1, amount: 40 },
        ];
        const utxos = [INT_SLP_150, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipients, 0, {
            tokenStrategy: 'largest',
        });

        assert.equal(result.totalSendTokens, 90n);
        assert.equal(result.tokenChange, 60n);
    });
});
