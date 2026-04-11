import {
  bytesToStr,
  fromHex,
  getStackArray,
  OP_RETURN,
  pushBytesOp,
  Script,
  strToBytes,
  toHex,
  TxOutput,
} from 'ecash-lib';
import { XecAppActionOptions, XecAppActionParseResult } from '../types';

export const CASHTAB_PREFIX_HEX = '00746162';
export const XEC_APP_MESSAGE_BYTE_LIMIT = 215;

const APP_PREFIX_HEX_REGEX = /^[0-9a-f]{8}$/;

function toOutputScriptHex(outputScript: string | { bytecode: Uint8Array }): string {
  return typeof outputScript === 'string' ? outputScript : toHex(outputScript.bytecode);
}

export function validateAppPrefixHex(appPrefixHex?: string): string {
  if (typeof appPrefixHex === 'undefined') {
    return CASHTAB_PREFIX_HEX;
  }
  if (!APP_PREFIX_HEX_REGEX.test(appPrefixHex)) {
    throw new Error('appPrefixHex must be an 8-character lowercase hex string (4 bytes)');
  }
  return appPrefixHex;
}

export function validateAppMessage(message: string): Uint8Array {
  if (typeof message !== 'string') {
    throw new Error('message must be a string');
  }
  if (message === '') {
    throw new Error('message cannot be an empty string');
  }

  const messageBytes = strToBytes(message);
  if (messageBytes.length > XEC_APP_MESSAGE_BYTE_LIMIT) {
    throw new Error(
      `message is ${messageBytes.length} bytes. Exceeds ${XEC_APP_MESSAGE_BYTE_LIMIT} byte limit.`,
    );
  }

  return messageBytes;
}

export function buildXecAppActionOutput(options: XecAppActionOptions): TxOutput {
  const { message, appPrefixHex } = options;
  if (typeof message === 'undefined' && typeof appPrefixHex === 'undefined') {
    throw new Error('message or appPrefixHex is required');
  }

  const prefixHex = validateAppPrefixHex(appPrefixHex);
  const ops = [OP_RETURN, pushBytesOp(fromHex(prefixHex))];

  if (typeof message !== 'undefined') {
    ops.push(pushBytesOp(validateAppMessage(message)));
  }

  const script = Script.fromOps(ops);

  // Reuse ecash-lib OP_RETURN validation to ensure the final script is standard.
  getStackArray(toHex(script.bytecode));

  return { sats: 0n, script };
}

export function parseXecAppActionOutput(
  outputScript: string | { bytecode: Uint8Array },
): XecAppActionParseResult | undefined {
  let stackArray: string[];
  try {
    stackArray = getStackArray(toOutputScriptHex(outputScript));
  } catch {
    return undefined;
  }

  if (stackArray.length === 0 || stackArray.length > 2) {
    return undefined;
  }

  const [prefixHex, payloadHex] = stackArray;
  if (!APP_PREFIX_HEX_REGEX.test(prefixHex)) {
    return undefined;
  }

  if (typeof payloadHex === 'undefined') {
    return { kind: 'prefix_only', prefixHex };
  }

  try {
    return {
      kind: 'message',
      prefixHex,
      message: bytesToStr(fromHex(payloadHex)),
    };
  } catch {
    return undefined;
  }
}
