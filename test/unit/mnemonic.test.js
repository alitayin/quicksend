'use strict';
/**
 * mnemonic.test.js
 *
 * Unit tests for deriveBuyerKey() and validateMnemonic() in mnemonic-utils.js.
 *
 * Key properties tested (mirroring ecash-wallet's "We can initialize a Wallet
 * from a mnemonic" block):
 *  - Same mnemonic always produces the same address and sk
 *  - Different address indexes produce different addresses
 *  - The derivation path follows m/44'/1899'/0'/0/<index>
 *  - validateMnemonic accepts exactly 12/15/18/21/24 words
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { describe } = require('node:test');

const { deriveBuyerKey, validateMnemonic } = require('../../dist/wallet/mnemonic-utils.js');
const { TEST_MNEMONIC, TEST_MNEMONIC_ALT } = require('../fixtures.js');

// ---------------------------------------------------------------------------
// deriveBuyerKey
// ---------------------------------------------------------------------------

describe('deriveBuyerKey', () => {

    test('same mnemonic + same index always produces the same address', () => {
        const a = deriveBuyerKey(TEST_MNEMONIC, 0);
        const b = deriveBuyerKey(TEST_MNEMONIC, 0);
        assert.equal(a.address, b.address);
        assert.equal(a.wif,     b.wif);
    });

    test('known mnemonic produces the known address at index 0', () => {
        // Deterministic check: if this ever changes, derivation is broken
        const result = deriveBuyerKey(TEST_MNEMONIC, 0);
        assert.equal(result.address, 'ecash:qp58r6w7umxvpjfndnajyg52d5fdzdqm9qcd4fvlpg');
    });

    test('index 0 and index 1 produce different addresses', () => {
        const r0 = deriveBuyerKey(TEST_MNEMONIC, 0);
        const r1 = deriveBuyerKey(TEST_MNEMONIC, 1);
        assert.notEqual(r0.address, r1.address);
        assert.notEqual(r0.wif,     r1.wif);
    });

    test('index 0 and index 2 produce different addresses', () => {
        const r0 = deriveBuyerKey(TEST_MNEMONIC, 0);
        const r2 = deriveBuyerKey(TEST_MNEMONIC, 2);
        assert.notEqual(r0.address, r2.address);
    });

    test('different mnemonics produce different addresses at the same index', () => {
        const r1 = deriveBuyerKey(TEST_MNEMONIC,     0);
        const r2 = deriveBuyerKey(TEST_MNEMONIC_ALT, 0);
        assert.notEqual(r1.address, r2.address);
        assert.notEqual(r1.wif,     r2.wif);
    });

    test('returns the correct derivationPath for index 0', () => {
        const result = deriveBuyerKey(TEST_MNEMONIC, 0);
        assert.equal(result.derivationPath, "m/44'/1899'/0'/0/0");
    });

    test('returns the correct derivationPath for index 3', () => {
        const result = deriveBuyerKey(TEST_MNEMONIC, 3);
        assert.equal(result.derivationPath, "m/44'/1899'/0'/0/3");
    });

    test('returned addressIndex matches the input index', () => {
        for (const idx of [0, 1, 5, 10]) {
            const result = deriveBuyerKey(TEST_MNEMONIC, idx);
            assert.equal(result.addressIndex, idx);
        }
    });

    test('returned address is a valid ecash: address string', () => {
        const result = deriveBuyerKey(TEST_MNEMONIC, 0);
        assert.ok(
            result.address.startsWith('ecash:'),
            `Expected ecash: prefix, got: ${result.address}`,
        );
    });

    test('returned wif is a non-empty string', () => {
        const result = deriveBuyerKey(TEST_MNEMONIC, 0);
        assert.equal(typeof result.wif, 'string');
        assert.ok(result.wif.length > 0);
    });
});

// ---------------------------------------------------------------------------
// validateMnemonic
// ---------------------------------------------------------------------------

describe('validateMnemonic', () => {

    test('returns true for a valid 12-word mnemonic', () => {
        assert.equal(validateMnemonic(TEST_MNEMONIC), true);
    });

    test('returns true for 15 words', () => {
        const m15 = 'word '.repeat(15).trim();
        assert.equal(validateMnemonic(m15), true);
    });

    test('returns true for 18 words', () => {
        const m18 = 'word '.repeat(18).trim();
        assert.equal(validateMnemonic(m18), true);
    });

    test('returns true for 21 words', () => {
        const m21 = 'word '.repeat(21).trim();
        assert.equal(validateMnemonic(m21), true);
    });

    test('returns true for 24 words', () => {
        const m24 = 'word '.repeat(24).trim();
        assert.equal(validateMnemonic(m24), true);
    });

    test('returns false for 11 words (too short)', () => {
        const m11 = 'word '.repeat(11).trim();
        assert.equal(validateMnemonic(m11), false);
    });

    test('returns false for 13 words (invalid count)', () => {
        const m13 = 'word '.repeat(13).trim();
        assert.equal(validateMnemonic(m13), false);
    });

    test('returns false for an empty string', () => {
        assert.equal(validateMnemonic(''), false);
    });

    test('returns false for null', () => {
        assert.equal(validateMnemonic(null), false);
    });

    test('returns false for undefined', () => {
        assert.equal(validateMnemonic(undefined), false);
    });

    test('returns false for a number', () => {
        assert.equal(validateMnemonic(12345), false);
    });

    test('trims extra whitespace correctly (12 words with extra spaces)', () => {
        const padded = '  ' + TEST_MNEMONIC + '  ';
        assert.equal(validateMnemonic(padded), true);
    });
});
