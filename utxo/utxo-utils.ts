import { calcTxFee, DEFAULT_FEE_SATS_PER_KB, Address } from 'ecash-lib';
import { chronik } from '../client/chronik-client';
import { Utxo, SlpToken, Recipient } from '../types';
import { ChronikClient } from 'chronik-client';

// P2PKH 交易字节大小常量
const P2PKH_INPUT_BYTES = 148;  // txid(32) + vout(4) + scriptLen(1) + sig(72) + pubkey(33) + sequence(4) + varint(2)
const P2PKH_OUTPUT_BYTES = 34; // value(8) + scriptLen(1) + script(25)
const TX_OVERHEAD_BYTES = 10;  // version(4) + locktime(4) + input/output count varints

/** 根据输入数和输出数估算交易手续费（satoshis） */
function estimateFee(nInputs: number, nOutputs: number): number {
  const txBytes = nInputs * P2PKH_INPUT_BYTES + nOutputs * P2PKH_OUTPUT_BYTES + TX_OVERHEAD_BYTES;
  return Number(calcTxFee(txBytes, DEFAULT_FEE_SATS_PER_KB));
}

// UTXO选择结果接口
interface UtxoSelection {
  selectedUtxos: Utxo[];
  totalInputValue: number;
  estimatedFee: number;
  changeAmount: number;
  utxoCount: number;
}

// SLP UTXO选择选项接口
interface SlpUtxoOptions {
  dustLimit?: number;
  feeStrategy?: 'all' | 'minimal' | 'largest_first';
  tokenStrategy?: 'largest' | 'minimal' | 'all';
}

// SLP UTXO选择结果接口
interface SlpUtxoSelection {
  selectedTokenUtxos: Utxo[];
  selectedFeeUtxos: Utxo[];
  totalFeeInputValue: number;
  estimatedFee: number;
  feeChangeAmount: number;
  tokenChange: bigint;
  finalSendAmounts: bigint[];
  totalSendTokens: bigint;
  totalTokens: bigint;
  dustLimit: number;
  summary: {
    tokenUtxoCount: number;
    feeUtxoCount: number;
    recipientCount: number;
    hasTokenChange: boolean;
    totalOutputs: number;
  };
}

// 代币余额信息接口
interface TokenBalance {
  tokenId: string;
  totalTokens: bigint;
  utxoCount: number;
  utxos: Utxo[];
}

// 地址余额信息接口
interface AddressBalance {
  totalBalance: number;
  utxoCount: number;
  slpUtxoCount: number;
  nonSlpUtxos: Utxo[];
  slpUtxos: Utxo[];
  tokenBalances: TokenBalance[];
}

// UTXO选择策略类型
type UtxoStrategy = 'all' | 'minimal' | 'largest_first';

/**
 * Get UTXOs for a given address
 * @param address - eCash address
 * @param chronikClient - Optional chronik client instance (uses default if not provided)
 * @returns Array of UTXOs
 */
async function getUtxos(address: string, chronikClient?: ChronikClient): Promise<Utxo[]> {
  const { type, hash } = Address.fromCashAddress(address);
  const client = chronikClient || chronik; // 使用传入的chronik客户端或默认的
  
  try {
    const utxosResponse = await client.script(type, hash).utxos();

    if (!utxosResponse || !utxosResponse.utxos) {
      throw new Error('utxosResponse does not contain utxos property');
    }

    const utxos: Utxo[] = utxosResponse.utxos.map(utxo => ({
      txid: utxo.outpoint.txid.toLowerCase(),
      vout: utxo.outpoint.outIdx,
      value: Number(utxo.sats),
      address: address,
      isCoinbase: utxo.isCoinbase ?? false,
      blockHeight: utxo.blockHeight ?? -1,
      slpToken: utxo.token ? {
        tokenId: utxo.token.tokenId,
        atoms: utxo.token.atoms,
        isMintBaton: utxo.token.isMintBaton ?? false,
      } : undefined,
    }));
    return utxos;
  } catch (err) {
    console.log(`Error fetching UTXOs for hash160: ${hash}`);
    return [];
  }
}

/**
 * 选择合适的UTXOs用于普通XEC交易
 * @param utxos - 所有可用的UTXOs
 * @param sendAmount - 要发送的金额
 * @param strategy - 选择策略
 * @returns 包含选择的UTXOs和相关信息
 */
function selectUtxos(utxos: Utxo[], sendAmount: number, strategy: UtxoStrategy = 'all'): UtxoSelection {
  // 过滤掉SLP代币UTXOs和coinbase UTXOs（coinbase需要100个区块成熟才能花费）
  const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken && !utxo.isCoinbase);
  
  if (nonSlpUtxos.length === 0) {
    throw new Error('No non-SLP UTXOs available');
  }

  let selectedUtxos: Utxo[] = [];
  
  switch (strategy) {
    case 'all':
      // 使用所有非SLP UTXOs，避免产生碎片
      selectedUtxos = nonSlpUtxos;
      break;
      
    case 'minimal':
      // 选择最少数量的UTXOs来满足金额需求
      const sortedUtxos = nonSlpUtxos.sort((a, b) => b.value - a.value); // 从大到小排序
      let accumulatedValue = 0;
      
      for (const utxo of sortedUtxos) {
        selectedUtxos.push(utxo);
        accumulatedValue += utxo.value;
        
        // 估算手续费：inputs + 2 outputs（接收方 + 找零）
        const estimatedFee = estimateFee(selectedUtxos.length, 2);
        
        if (accumulatedValue >= sendAmount + estimatedFee) {
          break;
        }
      }
      break;
      
    case 'largest_first':
      // 优先选择最大的UTXOs
      selectedUtxos = nonSlpUtxos.sort((a, b) => b.value - a.value);
      break;
      
    default:
      throw new Error(`Unknown UTXO selection strategy: ${strategy}`);
  }

  const totalInputValue = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
  const estimatedFee = estimateFee(selectedUtxos.length, 2);
  
  // 检查余额是否足够
  if (totalInputValue < sendAmount + estimatedFee) {
    throw new Error(
      `Insufficient balance. Total input: ${totalInputValue}, required: ${sendAmount + estimatedFee} (including estimated fee ${estimatedFee})`
    );
  }

  return {
    selectedUtxos,
    totalInputValue,
    estimatedFee,
    changeAmount: totalInputValue - sendAmount - estimatedFee,
    utxoCount: selectedUtxos.length
  };
}

/**
 * 为SLP交易选择UTXOs
 * @param utxos - 所有可用的UTXOs
 * @param tokenId - SLP代币ID
 * @param recipients - 接收方数组，包含address和amount
 * @param tokenDecimals - 代币小数位数
 * @param options - 选项
 * @returns 包含选择的UTXOs和相关信息
 */
function selectSlpUtxos(
  utxos: Utxo[],
  tokenId: string,
  recipients: Recipient[],
  tokenDecimals: number = 0,
  options: SlpUtxoOptions = {}
): SlpUtxoSelection {
  const {
    dustLimit = 546,
    feeStrategy = 'all', // 手续费UTXO选择策略
    tokenStrategy = 'largest' // 代币UTXO选择策略
  } = options;

  // 分离SLP和非SLP UTXOs
  const slpUtxos = utxos.filter(utxo =>
    utxo.slpToken &&
    utxo.slpToken.tokenId === tokenId &&
    !utxo.slpToken.isMintBaton // never spend mint batons as regular send inputs
  );
  // 过滤掉coinbase UTXOs作为手续费输入（coinbase需100个区块成熟才能花费）
  const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken && !utxo.isCoinbase);

  if (slpUtxos.length === 0) {
    throw new Error(`No SLP UTXOs available for token ${tokenId}`);
  }
  if (nonSlpUtxos.length === 0) {
    throw new Error('No non-SLP UTXOs available for fee payment');
  }

  // 计算需要发送的代币总量（直接使用基础单位，不进行小数转换）
  const sendAmounts = recipients.map(r => BigInt(r.amount));
  const totalSendTokens = sendAmounts.reduce((acc, val) => acc + val, 0n);

  // 选择代币UTXOs
  let selectedTokenUtxos: Utxo[] = [];
  let totalTokens = 0n;

  if (tokenStrategy === 'all') {
    // 选择所有相同代币ID的SLP UTXOs，减少UTXO碎片
    selectedTokenUtxos = slpUtxos;
    totalTokens = slpUtxos.reduce((sum, utxo) => sum + BigInt(utxo.slpToken!.atoms), 0n);
  } else if (tokenStrategy === 'largest') {
    // 选择最大的SLP UTXO
    const selectedTokenUtxo = slpUtxos.reduce((max, current) => {
      const currentAmount = BigInt(current.slpToken!.atoms);
      const maxAmount = BigInt(max.slpToken!.atoms);
      return currentAmount > maxAmount ? current : max;
    }, slpUtxos[0]);
    selectedTokenUtxos = [selectedTokenUtxo];
    totalTokens = BigInt(selectedTokenUtxo.slpToken!.atoms);
  } else if (tokenStrategy === 'minimal') {
    // 选择刚好够用的最小UTXO
    const sortedSlpUtxos = slpUtxos
      .filter(utxo => BigInt(utxo.slpToken!.atoms) >= totalSendTokens)
      .sort((a, b) => {
        const aAmount = BigInt(a.slpToken!.atoms);
        const bAmount = BigInt(b.slpToken!.atoms);
        return aAmount < bAmount ? -1 : aAmount > bAmount ? 1 : 0;
      });
    
    if (sortedSlpUtxos.length === 0) {
      throw new Error('Insufficient token balance');
    }
    selectedTokenUtxos = [sortedSlpUtxos[0]];
    totalTokens = BigInt(sortedSlpUtxos[0].slpToken!.atoms);
  }
  
  if (totalSendTokens > totalTokens) {
    throw new Error(`Insufficient token balance. Available: ${totalTokens.toString()}, required: ${totalSendTokens.toString()}`);
  }

  const tokenChange = totalTokens - totalSendTokens;

  // 选择手续费UTXOs
  let selectedFeeUtxos: Utxo[];
  if (feeStrategy === 'all') {
    selectedFeeUtxos = nonSlpUtxos;
  } else {
    // 使用普通UTXO选择逻辑来选择手续费UTXOs
    const requiredSats = recipients.length * dustLimit + (tokenChange > 0n ? dustLimit : 0) + 500; // 预估需要的sats
    const feeSelection = selectUtxos(utxos, requiredSats, feeStrategy);
    selectedFeeUtxos = feeSelection.selectedUtxos;
  }

  const totalFeeInputValue = selectedFeeUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
  // 估算手续费：所有输入 + OP_RETURN(1) + 接收方输出 + token找零(1) + XEC找零(1)
  const nOutputs = 1 + recipients.length + (tokenChange > 0n ? 1 : 0) + 1;
  const estimatedFee = estimateFee(selectedFeeUtxos.length + selectedTokenUtxos.length, nOutputs);

  // 计算所需的最小金额
  const requiredAmount = recipients.length * dustLimit + (tokenChange > 0n ? dustLimit : 0) + estimatedFee;
  
  if (totalFeeInputValue < requiredAmount) {
    throw new Error(
      `Insufficient balance for fees. Total input: ${totalFeeInputValue}, required: ${requiredAmount} (including estimated fee ${estimatedFee})`
    );
  }

  // 构建最终的发送金额数组
  const finalSendAmounts = [...sendAmounts];
  if (tokenChange > 0n) {
    finalSendAmounts.push(tokenChange);
  }

  return {
    selectedTokenUtxos, // 改为数组
    selectedFeeUtxos,
    totalFeeInputValue,
    estimatedFee,
    feeChangeAmount: totalFeeInputValue - requiredAmount + estimatedFee,
    tokenChange,
    finalSendAmounts,
    totalSendTokens,
    totalTokens,
    dustLimit,
    summary: {
      tokenUtxoCount: selectedTokenUtxos.length, // 更新计数
      feeUtxoCount: selectedFeeUtxos.length,
      recipientCount: recipients.length,
      hasTokenChange: tokenChange > 0n,
      totalOutputs: 1 + recipients.length + (tokenChange > 0n ? 1 : 0) + 1 // OP_RETURN + recipients + token_change + fee_change
    }
  };
}

/**
 * 获取地址余额信息
 * @param address - eCash地址
 * @param chronikClient - Optional chronik client instance (uses default if not provided)
 * @returns 余额信息
 */
async function getAddressBalance(address: string, chronikClient?: ChronikClient): Promise<AddressBalance> {
  try {
    const utxos = await getUtxos(address, chronikClient);
    const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken);
    const slpUtxos = utxos.filter(utxo => utxo.slpToken);
    
    const totalBalance = nonSlpUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    // 按代币ID分组SLP UTXOs
    const tokenBalances: { [key: string]: TokenBalance } = {};
    slpUtxos.forEach(utxo => {
      const tokenId = utxo.slpToken!.tokenId;
      if (!tokenBalances[tokenId]) {
        tokenBalances[tokenId] = {
          tokenId,
          totalTokens: 0n,
          utxoCount: 0,
          utxos: []
        };
      }
      tokenBalances[tokenId].totalTokens += BigInt(utxo.slpToken!.atoms);
      tokenBalances[tokenId].utxoCount++;
      tokenBalances[tokenId].utxos.push(utxo);
    });
    
    return {
      totalBalance,
      utxoCount: nonSlpUtxos.length,
      slpUtxoCount: slpUtxos.length,
      nonSlpUtxos,
      slpUtxos,
      tokenBalances: Object.values(tokenBalances)
    };
  } catch (error) {
    console.error('Failed to get address balance:', error);
    throw error;
  }
}

export {
  getUtxos,
  selectUtxos,
  selectSlpUtxos,
  getAddressBalance
}; 