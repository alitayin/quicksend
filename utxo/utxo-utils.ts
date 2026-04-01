import { calcTxFee, DEFAULT_FEE_SATS_PER_KB, Address } from 'ecash-lib';
import { chronik } from '../client/chronik-client';
import { Utxo, SlpToken, Recipient, UtxoStrategy, FeeStrategy, TokenStrategy } from '../types';
import { ChronikClient } from 'chronik-client';

// P2PKH transaction byte size constants
const P2PKH_INPUT_BYTES = 148;  // txid(32) + vout(4) + scriptLen(1) + sig(72) + pubkey(33) + sequence(4) + varint(2)
const P2PKH_OUTPUT_BYTES = 34; // value(8) + scriptLen(1) + script(25)
const TX_OVERHEAD_BYTES = 10;  // version(4) + locktime(4) + input/output count varints

/** Estimate transaction fee (satoshis) based on input and output counts */
function estimateFee(nInputs: number, nOutputs: number): number {
  const txBytes = nInputs * P2PKH_INPUT_BYTES + nOutputs * P2PKH_OUTPUT_BYTES + TX_OVERHEAD_BYTES;
  return Number(calcTxFee(txBytes, DEFAULT_FEE_SATS_PER_KB));
}

// UTXO selection result interface
interface UtxoSelection {
  selectedUtxos: Utxo[];
  totalInputValue: number;
  estimatedFee: number;
  changeAmount: number;
  utxoCount: number;
}

// SLP UTXO selection options interface
interface SlpUtxoOptions {
  dustLimit?: number;
  feeStrategy?: FeeStrategy;
  tokenStrategy?: TokenStrategy;
}

// SLP UTXO selection result interface
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

// Token balance info interface
interface TokenBalance {
  tokenId: string;
  totalTokens: bigint;
  utxoCount: number;
  utxos: Utxo[];
}

// Address balance info interface
interface AddressBalance {
  totalBalance: number;
  utxoCount: number;
  slpUtxoCount: number;
  nonSlpUtxos: Utxo[];
  slpUtxos: Utxo[];
  tokenBalances: TokenBalance[];
}

// UtxoStrategy imported from types.ts

/**
 * Get UTXOs for a given address
 * @param address - eCash address
 * @param chronikClient - Optional chronik client instance (uses default if not provided)
 * @returns Array of UTXOs
 */
async function getUtxos(address: string, chronikClient?: ChronikClient): Promise<Utxo[]> {
  const { type, hash } = Address.fromCashAddress(address);
  const client = chronikClient || chronik;
  
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
    throw new Error(`Failed to fetch UTXOs for ${address}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Select suitable UTXOs for basic XEC transaction
 * @param utxos - All available UTXOs
 * @param sendAmount - Amount to send
 * @param strategy - Selection strategy
 * @returns Selected UTXOs and related info
 */
function selectUtxos(utxos: Utxo[], sendAmount: number, strategy: UtxoStrategy = 'all'): UtxoSelection {
  // Filter SLP tokens and immature coinbase UTXOs
  const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken && !utxo.isCoinbase);
  
  if (nonSlpUtxos.length === 0) {
    throw new Error('No non-SLP UTXOs available');
  }

  let selectedUtxos: Utxo[] = [];
  
  switch (strategy) {
    case 'all':
      // Use all non-SLP UTXOs to avoid fragmentation
      selectedUtxos = nonSlpUtxos;
      break;
      
    case 'minimal':
      // Select minimal UTXOs to satisfy amount
      const sortedUtxos = [...nonSlpUtxos].sort((a, b) => b.value - a.value); // Sort descending
      let accumulatedValue = 0;
      
      for (const utxo of sortedUtxos) {
        selectedUtxos.push(utxo);
        accumulatedValue += utxo.value;
        
        // Estimate fee: inputs + 2 outputs (recipient + change)
        const estimatedFee = estimateFee(selectedUtxos.length, 2);
        
        if (accumulatedValue >= sendAmount + estimatedFee) {
          break;
        }
      }
      break;
      
    case 'largest_first':
      // Select largest UTXOs first
      selectedUtxos = [...nonSlpUtxos].sort((a, b) => b.value - a.value);
      break;
      
    default:
      throw new Error(`Unknown UTXO selection strategy: ${strategy}`);
  }

  const totalInputValue = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
  const estimatedFee = estimateFee(selectedUtxos.length, 2);
  
  // Check if balance is sufficient
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
 * Select UTXOs for SLP/ALP transaction
 * @param utxos - All available UTXOs
 * @param tokenId - Token ID
 * @param recipients - Array of recipients
 * @param options - Selection options
 * @returns Selected UTXOs and related info
 */
function selectSlpUtxos(
  utxos: Utxo[],
  tokenId: string,
  recipients: Recipient[],
  options: SlpUtxoOptions = {}
): SlpUtxoSelection {
  const {
    dustLimit = 546,
    feeStrategy = 'all',
    tokenStrategy = 'largest'
  } = options;

  // Separate SLP and non-SLP UTXOs
  const slpUtxos = utxos.filter(utxo =>
    utxo.slpToken &&
    utxo.slpToken.tokenId === tokenId &&
    !utxo.slpToken.isMintBaton // never spend mint batons as regular send inputs
  );
  // Filter immature coinbase UTXOs
  const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken && !utxo.isCoinbase);

  if (slpUtxos.length === 0) {
    throw new Error(`No SLP UTXOs available for token ${tokenId}`);
  }
  if (nonSlpUtxos.length === 0) {
    throw new Error('No non-SLP UTXOs available for fee payment');
  }

  // Calculate total tokens to send (using base units)
  const sendAmounts = recipients.map(r => BigInt(r.amount));
  const totalSendTokens = sendAmounts.reduce((acc, val) => acc + val, 0n);

  // Select token UTXOs
  let selectedTokenUtxos: Utxo[] = [];
  let totalTokens = 0n;

  if (tokenStrategy === 'all') {
    // Select all UTXOs for the same token ID to reduce fragmentation
    selectedTokenUtxos = slpUtxos;
    totalTokens = slpUtxos.reduce((sum, utxo) => sum + BigInt(utxo.slpToken!.atoms), 0n);
  } else if (tokenStrategy === 'largest') {
    // Select largest SLP UTXO
    const selectedTokenUtxo = slpUtxos.reduce((max, current) => {
      const currentAmount = BigInt(current.slpToken!.atoms);
      const maxAmount = BigInt(max.slpToken!.atoms);
      return currentAmount > maxAmount ? current : max;
    }, slpUtxos[0]);
    selectedTokenUtxos = [selectedTokenUtxo];
    totalTokens = BigInt(selectedTokenUtxo.slpToken!.atoms);
  } else if (tokenStrategy === 'minimal') {
    // Select smallest sufficient UTXO
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

  // Select fee UTXOs
  let selectedFeeUtxos: Utxo[];
  if (feeStrategy === 'all') {
    selectedFeeUtxos = nonSlpUtxos;
  } else {
    // Use basic UTXO selection logic for fee UTXOs
    const requiredSats = recipients.length * dustLimit + (tokenChange > 0n ? dustLimit : 0) + 500; // Estimated sats required
    const feeSelection = selectUtxos(utxos, requiredSats, feeStrategy);
    selectedFeeUtxos = feeSelection.selectedUtxos;
  }

  const totalFeeInputValue = selectedFeeUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
  // Estimate fee: inputs + OP_RETURN(1) + recipients + token change(1) + XEC change(1)
  const nOutputs = 1 + recipients.length + (tokenChange > 0n ? 1 : 0) + 1;
  const estimatedFee = estimateFee(selectedFeeUtxos.length + selectedTokenUtxos.length, nOutputs);

  // Calculate minimum amount required
  const requiredAmount = recipients.length * dustLimit + (tokenChange > 0n ? dustLimit : 0) + estimatedFee;
  
  if (totalFeeInputValue < requiredAmount) {
    throw new Error(
      `Insufficient balance for fees. Total input: ${totalFeeInputValue}, required: ${requiredAmount} (including estimated fee ${estimatedFee})`
    );
  }

  // Build final send amounts array
  const finalSendAmounts = [...sendAmounts];
  if (tokenChange > 0n) {
    finalSendAmounts.push(tokenChange);
  }

  return {
    selectedTokenUtxos,     selectedFeeUtxos,
    totalFeeInputValue,
    estimatedFee,
    feeChangeAmount: totalFeeInputValue - requiredAmount + estimatedFee,
    tokenChange,
    finalSendAmounts,
    totalSendTokens,
    totalTokens,
    dustLimit,
    summary: {
      tokenUtxoCount: selectedTokenUtxos.length,       feeUtxoCount: selectedFeeUtxos.length,
      recipientCount: recipients.length,
      hasTokenChange: tokenChange > 0n,
      totalOutputs: 1 + recipients.length + (tokenChange > 0n ? 1 : 0) + 1 // OP_RETURN + recipients + token_change + fee_change
    }
  };
}

/**
 * Get balance info for an address
 * @param address - eCash address
 * @param chronikClient - Optional chronik client instance (uses default if not provided)
 * @returns Balance information
 */
async function getAddressBalance(address: string, chronikClient?: ChronikClient): Promise<AddressBalance> {
  try {
    const utxos = await getUtxos(address, chronikClient);
    const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken);
    const slpUtxos = utxos.filter(utxo => utxo.slpToken);
    
    const totalBalance = nonSlpUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    
    // Group SLP UTXOs by token ID
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