import { chronik } from "../client/chronik-client";
import ecashLib from "ecash-lib";
import { ChronikClient } from "chronik-client";

const { TxBuilder, toHex } = ecashLib;

// 交易选项接口
interface TransactionOptions {
  feePerKb?: bigint;
  dustSats?: bigint;
  dustLimit?: number;
  chronik?: ChronikClient; // 新增：可选的chronik实例
}

// 交易结果接口
interface TransactionResult {
  explorerLink: string;
  broadcastResult: string;
  txid: string;
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
    const broadcastResponse = await client.broadcastTx(rawTxHex);
    if (!broadcastResponse) {
      throw new Error("Empty Chronik broadcast response");
    }

    return {
      explorerLink: `https://explorer.e.cash/tx/${broadcastResponse.txid}`,
      broadcastResult: broadcastResponse.txid,
      txid: broadcastResponse.txid
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
  console.log(`${type}交易摘要:`, summary);
} 