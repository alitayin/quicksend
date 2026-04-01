'use strict';

const test    = require('node:test');
const assert  = require('node:assert/strict');
const { describe } = require('node:test');

const { selectUtxos, selectSlpUtxos } = require('../../dist/utxo/utxo-utils.js');
const {
    TOKEN_ID_SLP,
    INT_XEC_100K,
    INT_XEC_50K,
    INT_SLP_150,
    INT_FEE_20K,
    ADDR_1,
} = require('../fixtures.js');

describe('selectSlpUtxos', () => {
    test('simple select', () => {
        const utxos = [INT_SLP_150, INT_FEE_20K];
        const recipients = [{ address: ADDR_1, amount: 100n }];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipients, {
            tokenStrategy: 'largest',
        });

        assert.equal(result.totalSendTokens, 100n);
        assert.equal(result.tokenChange, 50n);
    });

    test('multi-recipient', () => {
        const recipients = [
            { address: ADDR_1, amount: 50n },
            { address: ADDR_1, amount: 40n },
        ];
        const utxos = [INT_SLP_150, INT_FEE_20K];
        const result = selectSlpUtxos(utxos, TOKEN_ID_SLP, recipients, {
            tokenStrategy: 'largest',
        });

        assert.equal(result.totalSendTokens, 90n);
        assert.equal(result.tokenChange, 60n);
    });
});
