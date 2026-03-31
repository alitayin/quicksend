import { chronik } from "../client/chronik-client";
import {
  TxBuilder, toHex, EccDummy, P2PKHSignatory, ALL_BIP143,
  DEFAULT_DUST_SATS, DEFAULT_FEE_SATS_PER_KB, fromHex, Script
} from "ecash-lib";
import { ChronikClient } from "chronik-client";
import { TransactionResult } from "../types";

// EccDummy 使用固定最大签名长度（73字节），保证费用估算永远不低于实际
const _eccDummy = new EccDummy();
const _DUMMY_SK = fromHex('1122334455667788990011223344556677889900112233445566778899001122');
const _DUMMY_PK = _eccDummy.derivePubkey(_DUMMY_SK);
const _DUMMY_P2PKH = Script.p2pkh(new Uint8Array(20).fill(0x11));

/**
 * 用 EccDummy 验证 UTXOs 能否覆盖 outputs + 真实手续费。
 * EccDummy 签名长度固定为最大值（73字节），结果是保守上界，永远不低估。
 * 如果验证失败，在广播前提前抛出，避免浪费网络请求。
 */
export function verifyFee(
  utxos: Array<{ value: number }>,
  outputs: any[],
  feePerKb: bigint = DEFAULT_FEE_SATS_PER_KB,
  dustSats: bigint = DEFAULT_DUST_SATS,
): void {
  const dummyInputs = utxos.map((utxo, i) => ({
    input: {
      prevOut: { txid: '00'.repeat(32), outIdx: i },
      signData: { sats: BigInt(utxo.value), outputScript: _DUMMY_P2PKH },
    },
    signatory: P2PKHSignatory(_DUMMY_SK, _DUMMY_PK, ALL_BIP143),
  }));

  try {
    const txBuilder = new TxBuilder({ inputs: dummyInputs, outputs });
    txBuilder.sign({ ecc: _eccDummy, feePerKb, dustSats });
  } catch (e) {
    throw new Error(
      `Insufficient balance to cover outputs and fee: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

// 交易选项接口
interface TransactionOptions {
  feePerKb?: bigint;
  dustSats?: bigint;
  dustLimit?: number;
  chronik?: ChronikClient;
}

// 必需参数配置接口
interface RequiredParamConfig {
  key: string;
  message: string;
  checkUndefined?: boolean;
}

/**
 * 构建并广播交易的通用函数
 * @param inputs - 交易输入数组
 * @param outputs - 交易输出数组
 * @param options - 交易选项
 * @returns 包含 explorer 链接和交易 ID 的对象
 */
export async function buildAndBroadcastTransaction(
  inputs: any[], 
  outputs: any[], 
  options: TransactionOptions = {}
): Promise<TransactionResult> {
  const {
    feePerKb = 1000n,
    dustSats = 546n,
    dustLimit = 546,
    chronik: chronikClient // 提取chronik客户端
  } = options;

  const client = chronikClient || chronik; // 使用传入的chronik客户端或默认的

  try {
    // 构建交易
    const txBuild = new TxBuilder({ inputs, outputs });

    // 签名交易
    const tx = txBuild.sign({ 
      feePerKb, 
      dustSats: typeof dustSats === 'bigint' ? dustSats : BigInt(dustLimit) 
    });
    
    // 序列化交易
    const rawTxHex = toHex(tx.ser());

    // 广播交易
    const { txids } = await client.broadcastTxs([rawTxHex]);
    if (!txids || txids.length === 0) {
      throw new Error("Empty Chronik broadcast response");
    }
    const txid = txids[0];

    return {
      explorerLink: `https://explorer.e.cash/tx/${txid}`,
      broadcastResult: txid,
      txid,
    };
  } catch (error) {
    console.error("Transaction build/broadcast failed:", error);
    throw error;
  }
}

/**
 * 验证必需参数的通用函数
 * @param params - 参数对象
 * @param required - 必需参数配置数组
 */
export function validateRequiredParams(params: any, required: RequiredParamConfig[]): void {
  for (const { key, message, checkUndefined } of required) {
    if (checkUndefined ? params[key] === undefined : !params[key]) {
      throw new Error(message);
    }
  }
}

/**
 * 记录交易摘要的通用函数
 * @param type - 交易类型
 * @param summary - 摘要信息
 */
export function logTransactionSummary(type: string, summary: any): void {
  console.log(`${type} transaction summary:`, summary);
} 