'use strict';
/**
 * helpers.js
 *
 * Shared test helpers:
 *   - FakeChronik: deterministic chronik-client replacement (no network)
 *   - parseTx:     deserialize a raw tx hex back to { inputs, outputs, ... }
 *   - computeTxid: compute txid from raw hex
 *
 * FakeChronik faithfully reproduces the shape that your getUtxos() and
 * buildAndBroadcastTransaction() expect from chronik-client.
 */

const { Bytes, Script, readVarSize, fromHex, sha256d, toHexRev } = require('ecash-lib');

// ---------------------------------------------------------------------------
// FakeChronik
// ---------------------------------------------------------------------------

/**
 * A minimal chronik-client stand-in.
 *
 * Usage:
 *   const chronik = new FakeChronik([UTXO_XEC_100K, UTXO_SLP_150]);
 *   // then pass it as `chronik` option to sendXec / sendSlp / sendAlp
 *
 * The UTXOs you pass must be shaped like chronik ScriptUtxo objects:
 *   { outpoint: { txid, outIdx }, sats: BigInt, token?: { tokenId, atoms, isMintBaton } }
 *
 * All broadcasts are recorded in `this.broadcasted` as raw hex strings.
 * broadcastTx() returns a fake txid computed from the raw tx so your code
 * receives a deterministic but valid-looking response.
 *
 * If `errorOnBroadcast` is set, broadcastTx() rejects with that error.
 */
class FakeChronik {
    constructor(utxos, { errorOnBroadcast = null } = {}) {
        this._utxos = utxos;
        this._errorOnBroadcast = errorOnBroadcast;
        /** All raw hex strings that were passed to broadcastTx */
        this.broadcasted = [];
        /** All script() calls, useful for asserting address queries */
        this.scriptCalls = [];
    }

    /**
     * Matches the chronik-client pattern:
     *   chronik.script(type, hash).utxos()
     *
     * Your getUtxos() decodes the address, then calls:
     *   client.script(type, hash).utxos()
     */
    script(type, hash) {
        this.scriptCalls.push({ type, hash });
        const utxos = this._utxos;
        return {
            utxos: async () => ({ utxos }),
        };
    }

    async broadcastTx(rawTxHex) {
        if (this._errorOnBroadcast) {
            throw this._errorOnBroadcast;
        }
        this.broadcasted.push(rawTxHex);
        return { txid: computeTxid(rawTxHex) };
    }

    async broadcastTxs(rawTxHexes) {
        if (this._errorOnBroadcast) {
            throw this._errorOnBroadcast;
        }
        const txids = rawTxHexes.map(hex => {
            this.broadcasted.push(hex);
            return computeTxid(hex);
        });
        return { txids };
    }
}

// ---------------------------------------------------------------------------
// parseTx
// ---------------------------------------------------------------------------

/**
 * Deserialize a raw transaction hex string into a plain JS object.
 *
 * ecash-lib 3.2.0 does not export Tx.fromHex(), so we implement
 * the same deserialization manually using the Bytes reader.
 *
 * Returns:
 *   {
 *     version: number,
 *     inputs:  [{ prevOut: { txid: Uint8Array, outIdx }, script, sequence }],
 *     outputs: [{ sats: bigint, script: Script }],
 *     locktime: number,
 *   }
 */
function parseTx(hex) {
    const bytes = new Bytes(fromHex(hex));

    const version = bytes.readU32();

    const inputCount = readVarSize(bytes);
    const inputs = [];
    for (let i = 0; i < inputCount; i++) {
        const txid     = bytes.readBytes(32);
        const outIdx   = bytes.readU32();
        const script   = Script.readWithSize(bytes);
        const sequence = bytes.readU32();
        inputs.push({ prevOut: { txid, outIdx }, script, sequence });
    }

    const outputCount = readVarSize(bytes);
    const outputs = [];
    for (let i = 0; i < outputCount; i++) {
        const sats   = bytes.readU64();
        const script = Script.readWithSize(bytes);
        outputs.push({ sats, script });
    }

    const locktime = bytes.readU32();
    return { version, inputs, outputs, locktime };
}

// ---------------------------------------------------------------------------
// computeTxid
// ---------------------------------------------------------------------------

/**
 * Compute the txid of a raw transaction hex string.
 * txid = HASH256(rawTx) in little-endian hex.
 */
function computeTxid(hex) {
    return toHexRev(sha256d(fromHex(hex)));
}

// ---------------------------------------------------------------------------
// assertTxOutputCount
// ---------------------------------------------------------------------------

/**
 * Assert that the first broadcasted transaction has exactly `n` outputs.
 * Convenience wrapper so tests are readable.
 */
function assertOutputCount(chronik, n, assert) {
    const tx = parseTx(chronik.broadcasted[0]);
    assert.equal(
        tx.outputs.length,
        n,
        `Expected ${n} outputs, got ${tx.outputs.length}`,
    );
    return tx;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    FakeChronik,
    parseTx,
    computeTxid,
    assertOutputCount,
};
