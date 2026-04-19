'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { describe } = require('node:test');

const { fromHex, Address, toHex } = require('ecash-lib');
const {
    acceptAgoraOffer,
    calculateAgoraFeeSats,
} = require('../../dist/send/agorabuy.js');
const {
    TEST_MNEMONIC,
    UTXO_XEC_200K,
    ADDR_2,
    ADDR_3,
} = require('../fixtures.js');

function makeChronik(utxos = [UTXO_XEC_200K]) {
    return {
        script() {
            return {
                utxos: async () => ({ utxos }),
            };
        },
        blockchainInfo: async () => ({ tipHeight: 1_000_000 }),
        broadcastTx: async () => ({ txid: 'ab'.repeat(32) }),
    };
}

function makeStubAgoraOffer({
    askedSats = 100_000n,
    atoms = 100_000n,
    inputSats = [546n, 200_000n],
    changeSats = 98_500n,
} = {}) {
    let captured;

    const builder = {
        inputs: inputSats.map(sats => ({
            input: {
                signData: { sats },
            },
        })),
        sign: () => {
            const outputs = [
                { sats: askedSats },
                { sats: 546n },
            ];

            if (captured.params.extraOutputs.length === 3) {
                outputs.push({ sats: captured.params.extraOutputs[1].sats });
            }

            outputs.push({ sats: changeSats });

            return {
                outputs,
                ser: () => fromHex('0200000000000000'),
            };
        },
    };

    const offer = {
        token: { atoms },
        variant: { type: 'ONE_TO_ONE' },
        askedSats: () => askedSats,
        _acceptTxBuilder(params) {
            captured = { params };
            return builder;
        },
    };

    return {
        wrapped: {
            offer,
            pricePerToken: Number(askedSats) / 100 / Number(atoms),
            totalTokenAmount: atoms,
            totalXEC: Number(askedSats) / 100,
            offerType: 'ONE_TO_ONE',
        },
        getCaptured: () => captured,
    };
}

describe('calculateAgoraFeeSats', () => {
    test('uses the exact rate by default', () => {
        assert.equal(calculateAgoraFeeSats(100_000n, 100), 1_000n);
    });

    test('supports an explicit minimum fee floor', () => {
        assert.equal(calculateAgoraFeeSats(100_000n, 50, 546n), 546n);
    });
});

describe('acceptAgoraOffer fee output', () => {
    test('rejects fee outputs below dust when no minimum is specified', async () => {
        const stub = makeStubAgoraOffer({ askedSats: 100_000n, atoms: 1_000n });
        const result = await acceptAgoraOffer(stub.wrapped, {
            amount: 1_000n,
            mnemonic: TEST_MNEMONIC,
            chronik: makeChronik(),
            feeOutput: {
                address: ADDR_2,
                feeBps: 50,
            },
        });

        assert.equal(result.success, false);
        assert.equal(result.reason, 'FEE_BELOW_DUST');
    });

    test('appends the fee output and reports exact fee amounts', async () => {
        const stub = makeStubAgoraOffer();
        const result = await acceptAgoraOffer(stub.wrapped, {
            amount: 100_000n,
            mnemonic: TEST_MNEMONIC,
            chronik: makeChronik(),
            feeOutput: {
                address: ADDR_3,
                feeBps: 100,
                minSats: 0n,
            },
        });

        assert.equal(result.success, true);
        assert.equal(result.txid, 'ab'.repeat(32));
        assert.equal(result.swapFeePaid, 10);
        assert.equal(result.networkFee, 5);
        assert.equal(result.totalXECPaid, 1015);

        const captured = stub.getCaptured();
        assert.equal(captured.params.extraOutputs.length, 3);
        assert.equal(captured.params.extraOutputs[0].sats, 546n);
        assert.equal(captured.params.extraOutputs[1].sats, 1_000n);
        assert.equal(
            toHex(captured.params.extraOutputs[1].script.bytecode),
            Address.parse(ADDR_3).toScriptHex(),
        );
    });
});
