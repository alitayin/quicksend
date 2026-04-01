'use strict';

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

describe('validateRequiredParams', () => {
    test('throws with the specified message when a key is missing', () => {
        assert.throws(
            () => validateRequiredParams(
                {},
                [{ key: 'tokenId', message: 'tokenId is required' }],
            ),
            /tokenId is required/,
        );
    });

    test('throws for the first failing param and stops', () => {
        let thrownMessage;
        try {
            validateRequiredParams(
                { tokenId: '' },
                [
                    { key: 'tokenId',     message: 'tokenId is required' },
                ],
            );
        } catch (e) {
            thrownMessage = e.message;
        }
        assert.equal(thrownMessage, 'tokenId is required');
    });
});
