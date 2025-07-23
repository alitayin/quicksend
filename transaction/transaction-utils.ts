import * as ecashLib from 'ecash-lib';
import { decodeCashAddress } from 'ecashaddrjs';
import { Utxo } from '../types';

const {
  P2PKHSignatory,
  ALL_BIP143,
  Script,
} = ecashLib;

// 交易输入接口
interface TransactionInput {
  input: {
    prevOut: {
      txid: string;
      outIdx: number;
    };
    signData: {
      sats: bigint;
      outputScript: any;
    };
  };
  signatory: any;
}

/**
 * 构建交易输入 - 通用函数，支持单个或多个UTXO数组
 * @param utxos - 单个UTXO数组或多个UTXO数组
 * @param walletP2pkh - 钱包脚本
 * @param walletSk - 私钥
 * @param walletPk - 公钥
 * @returns 交易输入数组
 */
export function buildTransactionInputs(
  utxos: Utxo[] | Utxo[][], 
  walletP2pkh: any, 
  walletSk: Uint8Array, 
  walletPk: Uint8Array
): TransactionInput[] {
  // 如果传入的是多个数组（如SLP交易的tokenUtxos和feeUtxos），则合并
  const allUtxos: Utxo[] = Array.isArray(utxos[0]) ? (utxos as Utxo[][]).flat() : utxos as Utxo[];
  
  return allUtxos.map(utxo => ({
    input: {
      prevOut: { txid: utxo.txid, outIdx: utxo.vout },
      signData: { sats: BigInt(utxo.value), outputScript: walletP2pkh },
    },
    signatory: P2PKHSignatory(walletSk, walletPk, ALL_BIP143),
  }));
}

/**
 * 创建P2PKH脚本
 * @param address - eCash地址
 * @returns P2PKH脚本
 */
export function createP2pkhScript(address: string): any {
  try {
    const { hash } = decodeCashAddress(address);
    return Script.p2pkh(Buffer.from(hash, 'hex'));
  } catch (error) {
    throw new Error(`Invalid address: ${address}`);
  }
} 