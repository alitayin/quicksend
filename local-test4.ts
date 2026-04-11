import assert from 'node:assert/strict';
import quick, {
    CASHTAB_PREFIX_HEX,
    parseXecAppActionOutput,
} from './index';
import { chronik } from './client/chronik-client';

const mnemonic = 'valve vast enrich divorce mandate load risk miracle remind people play maid';
const RECIPIENT = 'ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv';
const MESSAGE = 'local-test4 message';
const PREFIX_ONLY_HEX = '51535434';
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

async function runScenario(
    label: string,
    options: { message?: string; appPrefixHex?: string },
    expected:
        | { kind: 'message'; prefixHex: string; message: string }
        | { kind: 'prefix_only'; prefixHex: string },
) {
    console.log(`\n=== [Local Test 4] ${label} ===`);
    const result = await quick.sendXec(
        [{ address: RECIPIENT, amount: SEND_AMOUNT }],
        { mnemonic, chronik, ...options },
    );

    console.log(`Broadcasted txid: ${result.txid}`);
    console.log(`Explorer: ${result.explorerLink}`);

    const tx = await waitForTx(result.txid);
    const opReturnOutput = getFirstOpReturnOutput(result.txid, tx.outputs);
    const parsed = parseXecAppActionOutput(opReturnOutput.outputScript);

    assert.deepStrictEqual(parsed, expected);
    console.log('Parsed app action:', parsed);

    await waitForLokad(result.txid, expected.prefixHex);
    console.log(`lokadId(${expected.prefixHex}) lookup confirmed the tx`);
}

async function run() {
    await runScenario(
        'Default Prefix Message',
        { message: MESSAGE },
        { kind: 'message', prefixHex: CASHTAB_PREFIX_HEX, message: MESSAGE },
    );

    await runScenario(
        'Custom Prefix Only',
        { appPrefixHex: PREFIX_ONLY_HEX },
        { kind: 'prefix_only', prefixHex: PREFIX_ONLY_HEX },
    );

    console.log('\nlocal-test4 completed successfully.');
}

run().catch(error => {
    console.error('local-test4 failed:', error);
    process.exitCode = 1;
});
