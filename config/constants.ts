import { deriveBuyerKey } from '../wallet/mnemonic-utils';

/**
 * 应用程序配置常量
 */
export const CONFIG = {
  // 钱包配置 - 只需要助记词
  MNEMONIC: process.env.MNEMONIC,
};

/**
 * 验证必需的环境变量（可选调用）
 */
export function validateConfig(): void {
  if (!CONFIG.MNEMONIC) {
    throw new Error('MNEMONIC environment variable must be set');
  }
}

// 注释掉自动验证，因为用户现在可以在代码中提供助记词
// validateConfig();

/**
 * 获取助记词（从环境变量）
 * 如果环境变量未设置，返回 null 而不是抛出错误
 */
export function getMnemonic(): string | null {
  return CONFIG.MNEMONIC || null;
}

/**
 * 获取钱包私钥WIF (从助记词派生)
 * @param addressIndex - 地址索引，默认为0
 * @param mnemonic - 可选：直接提供助记词，否则从环境变量获取
 */
export function getPrivateKeyWIF(addressIndex: number = 0, mnemonic?: string): string {
  const finalMnemonic = mnemonic || getMnemonic();
  if (!finalMnemonic) {
    throw new Error('Mnemonic not set: please set the MNEMONIC environment variable or provide it as a parameter');
  }
  const derived = deriveBuyerKey(finalMnemonic, addressIndex);
  return derived.wif;
}

/**
 * 获取默认的 UTXO 地址 (从助记词派生)
 * @param addressIndex - 地址索引，默认为0
 * @param mnemonic - 可选：直接提供助记词，否则从环境变量获取
 */
export function getDefaultUtxoAddress(addressIndex: number = 0, mnemonic?: string): string {
  const finalMnemonic = mnemonic || getMnemonic();
  if (!finalMnemonic) {
    throw new Error('Mnemonic not set: please set the MNEMONIC environment variable or provide it as a parameter');
  }
  const derived = deriveBuyerKey(finalMnemonic, addressIndex);
  return derived.address;
} 