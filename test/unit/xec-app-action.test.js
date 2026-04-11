'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { describe } = require('node:test');

const { slpSend, SLP_FUNGIBLE } = require('ecash-lib');
const {
    CASHTAB_PREFIX_HEX,
    XEC_APP_MESSAGE_BYTE_LIMIT,
    buildXecAppActionOutput,
    parseXecAppActionOutput,
    validateAppMessage,
    validateAppPrefixHex,
} = require('../../dist/index.js');
const { TOKEN_ID_SLP } = require('../fixtures.js');

describe('xec app action helpers', () => {
    test('build + parse round-trips a default-prefix message', () => {
        const output = buildXecAppActionOutput({ message: 'unit test message' });
        assert.deepEqual(parseXecAppActionOutput(output.script), {
            kind: 'message',
            prefixHex: CASHTAB_PREFIX_HEX,
            message: 'unit test message',
        });
    });

    test('build + parse round-trips a prefix-only marker', () => {
        const output = buildXecAppActionOutput({ appPrefixHex: '51535434' });
        assert.deepEqual(parseXecAppActionOutput(output.script), {
            kind: 'prefix_only',
            prefixHex: '51535434',
        });
    });

    test('validateAppPrefixHex rejects invalid custom prefixes', () => {
        assert.throws(
            () => validateAppPrefixHex('QST4'),
            /appPrefixHex must be an 8-character lowercase hex string/,
        );
    });

    test('validateAppMessage rejects empty and over-limit payloads', () => {
        assert.throws(
            () => validateAppMessage(''),
            /message cannot be an empty string/,
        );
        assert.throws(
            () => validateAppMessage('a'.repeat(XEC_APP_MESSAGE_BYTE_LIMIT + 1)),
            /Exceeds 215 byte limit/,
        );
    });

    test('parser ignores non-app-action OP_RETURN payloads such as SLP SEND', () => {
        const slpScript = slpSend(TOKEN_ID_SLP, SLP_FUNGIBLE, [100n]);
        assert.equal(parseXecAppActionOutput(slpScript), undefined);
    });
});
