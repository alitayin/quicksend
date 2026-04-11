import assert from 'node:assert/strict';
import quick, { parseXecAppActionOutput } from './index';
import { chronik } from './client/chronik-client';

const mnemonic = 'valve vast enrich divorce mandate load risk miracle remind people play maid';
const RECIPIENT = 'ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv';
const SWAP_PREFIX_HEX = '53575000';
const SEND_AMOUNT = 10000n;
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

async function waitForLokad(txid: string, prefixHex: string) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
        try {
            const page = await chronik.lokadId(prefixHex).history();
            if (page.txs.some(tx => tx.txid === txid)) {
                return;
            }
            lastError = new Error(`tx ${txid} not found in lokad history for ${prefixHex}`);
        } catch (error) {
            lastError = error;
        }
        console.log(`lokad lookup retry ${attempt}/${FETCH_RETRIES} for ${prefixHex}...`);
        await sleep(FETCH_DELAY_MS);
    }
    throw lastError;
}

function getFirstOpReturnOutput(txid: string, outputs: Array<{ outputScript: string }>) {
    const output = outputs.find(candidate => candidate.outputScript.startsWith('6a'));
    if (!output) {
        throw new Error(`No OP_RETURN output found in tx ${txid}`);
    }
    return output;
}

async function run() {
    console.log('\n=== [Local Test 5] Cashtab-known SWaP Prefix ===');
    console.log(`Broadcasting prefix-only tx with SWaP lokad ${SWAP_PREFIX_HEX}...`);

    const result = await quick.sendXec(
        [{ address: RECIPIENT, amount: SEND_AMOUNT }],
        { mnemonic, chronik, appPrefixHex: SWAP_PREFIX_HEX },
    );

    console.log(`Broadcasted txid: ${result.txid}`);
    console.log(`Explorer: ${result.explorerLink}`);

    const tx = await waitForTx(result.txid);
    const opReturnOutput = getFirstOpReturnOutput(result.txid, tx.outputs);
    const parsed = parseXecAppActionOutput(opReturnOutput.outputScript);

    assert.deepStrictEqual(parsed, {
        kind: 'prefix_only',
        prefixHex: SWAP_PREFIX_HEX,
    });
    console.log('Parsed app action:', parsed);

    await waitForLokad(result.txid, SWAP_PREFIX_HEX);
    console.log(`lokadId(${SWAP_PREFIX_HEX}) lookup confirmed the tx`);
    console.log('Expected Cashtab rendering: known app label "SWaP" instead of "Unknown App".');
}

run().catch(error => {
    console.error('local-test5 failed:', error);
    process.exitCode = 1;
});
