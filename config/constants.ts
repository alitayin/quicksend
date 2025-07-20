import dotenv from 'dotenv';
import { deriveBuyerKey } from '../wallet/mnemonic-utils';
dotenv.config();

/**
 * 应用程序配置常量
 */
export const CONFIG = {
  // 钱包配置 - 只需要助记词
  MNEMONIC: process.env.MNEMONIC,
};

/**
 * 验证必需的环境变量
 */
function validateConfig(): void {
  if (!CONFIG.MNEMONIC) {
    throw new Error('必须设置 MNEMONIC 环境变量');
  }
}

// 在模块加载时自动验证配置
validateConfig();

/**
 * 获取助记词
 */
export function getMnemonic(): string {
  if (!CONFIG.MNEMONIC) {
    throw new Error('助记词未设置');
  }
  return CONFIG.MNEMONIC;
}

/**
 * 获取钱包私钥WIF (从助记词派生)
 * @param addressIndex - 地址索引，默认为0
 */
export function getPrivateKeyWIF(addressIndex: number = 0): string {
  const derived = deriveBuyerKey(CONFIG.MNEMONIC!, addressIndex);
  return derived.wif;
}

/**
 * 获取默认的 UTXO 地址 (从助记词派生)
 * @param addressIndex - 地址索引，默认为0
 */
export function getDefaultUtxoAddress(addressIndex: number = 0): string {
  const derived = deriveBuyerKey(CONFIG.MNEMONIC!, addressIndex);
  return derived.address;
} 