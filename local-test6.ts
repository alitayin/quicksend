import assert from 'node:assert/strict';
import quick from './index';
import { chronik } from './client/chronik-client';
import { Address } from 'ecash-lib';
import { calculateAgoraFeeSats } from './send/agorabuy';

const mnemonic =
    process.env.MNEMONIC ??
    'valve vast enrich divorce mandate load risk miracle remind people play maid';

const TOKEN_ID =
    process.env.AGORA_TOKEN_ID ??
    'c67bf5c2b6d91cfb46a5c1772582eff80d88686887be10aa63b0945479cf4ed4';

const MAX_PRICE = Number(process.env.AGORA_MAX_PRICE ?? '10');
const REQUESTED_DISPLAY_AMOUNT = Number(process.env.AGORA_BUY_DISPLAY_AMOUNT ?? '1000');
const FEE_ADDRESS = 'ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv';
const FEE_BPS = 100; // 1%
const FETCH_RETRIES = 15;
const FETCH_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTx(txid: string) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
        try {
            return await chronik.tx(txid);
        } catch (error) {
            lastError = error;
            console.log(`tx lookup retry ${attempt}/${FETCH_RETRIES} for ${txid.slice(0, 8)}...`);
            await sleep(FETCH_DELAY_MS);
        }
    }
    throw lastError;
}

function toBigIntSats(value: bigint | number | string): bigint {
    return typeof value === 'bigint' ? value : BigInt(value);
}

async function run() {
    console.log('\n=== [Local Test 6] Agora buy with 1% platform fee ===');
    console.log(`Token: ${TOKEN_ID}`);
    console.log(`Max price: ${MAX_PRICE} XEC`);
    console.log(`Requested amount: ${REQUESTED_DISPLAY_AMOUNT} display tokens`);
    console.log(`Platform fee: ${FEE_BPS / 100}% -> ${FEE_ADDRESS}`);

    const tokenInfo = await chronik.token(TOKEN_ID);
    const decimals = tokenInfo.genesisInfo?.decimals ?? 0;
    const requestedAtoms = BigInt(Math.round(REQUESTED_DISPLAY_AMOUNT * 10 ** decimals));
    console.log(`Token decimals: ${decimals}`);
    console.log(`Requested amount: ${requestedAtoms} atoms`);

    const offers = await quick.fetchAgoraOffers({
        tokenId: TOKEN_ID,
        maxPrice: MAX_PRICE,
        chronik,
    });

    if (offers.length === 0) {
        throw new Error(`No Agora offers found for ${TOKEN_ID} below ${MAX_PRICE} XEC`);
    }

    const preferredOffer =
        offers.find(offer => offer.offerType === 'PARTIAL') ??
        offers[0];

    if (
        preferredOffer.offerType === 'ONE_TO_ONE' &&
        preferredOffer.totalTokenAmount > requestedAtoms
    ) {
        throw new Error(
            `Best available offer is ONE_TO_ONE for ${preferredOffer.totalTokenAmount} atoms. ` +
            `Increase AGORA_BUY_DISPLAY_AMOUNT or pick a token with PARTIAL offers.`,
        );
    }

    const amountToBuy =
        preferredOffer.offerType === 'ONE_TO_ONE'
            ? preferredOffer.totalTokenAmount
            : (requestedAtoms < preferredOffer.totalTokenAmount
                ? requestedAtoms
                : preferredOffer.totalTokenAmount);

    console.log(
        `Using ${preferredOffer.offerType} offer at ${preferredOffer.pricePerToken} XEC/token for ${amountToBuy} atoms...`,
    );

    const result = await quick.acceptAgoraOffer(preferredOffer, {
        amount: amountToBuy,
        mnemonic,
        chronik,
        feeOutput: {
            address: FEE_ADDRESS,
            feeBps: FEE_BPS,
            minSats: 0n,
        },
    });

    if (!result.success || !result.txid) {
        throw new Error(result.message ?? 'Agora buy failed');
    }

    console.log(`Broadcasted txid: ${result.txid}`);
    console.log(`Explorer: ${result.explorerLink}`);
    console.log(`Bought atoms: ${result.actualAmount}`);
    console.log(`Total paid: ${result.totalXECPaid} XEC`);
    console.log(`Network fee: ${result.networkFee} XEC`);
    console.log(`Platform fee: ${result.swapFeePaid} XEC`);

    assert.ok(
        typeof result.swapFeePaid === 'number' && result.swapFeePaid > 0,
        'Expected a positive platform fee in the buy result',
    );

    const expectedFeeSats = calculateAgoraFeeSats(
        preferredOffer.offer.askedSats(result.actualAmount ?? amountToBuy),
        FEE_BPS,
        0n,
    );
    const feeScriptHex = Address.parse(FEE_ADDRESS).toScriptHex();
    const tx = await waitForTx(result.txid);
    const feeOutput = tx.outputs.find(output =>
        output.outputScript === feeScriptHex &&
        toBigIntSats(output.sats) === expectedFeeSats,
    );

    assert.ok(
        feeOutput,
        `No platform fee output found paying ${expectedFeeSats} sats to ${FEE_ADDRESS}`,
    );

    console.log(`Platform fee output confirmed: ${expectedFeeSats} sats -> ${FEE_ADDRESS}`);
    console.log('local-test6 completed successfully.');
}

run().catch(error => {
    console.error('local-test6 failed:', error);
    process.exitCode = 1;
});
