import { getMnemonic } from '../config/constants';
import { deriveBuyerKey } from './mnemonic-utils';
import * as wif from 'wif';
import * as ecashLib from 'ecash-lib';

const {
  Ecc,
  Script,
  fromHex,
  shaRmd160,
} = ecashLib;

// 钱包信息接口
interface WalletInfo {
  ecc: any;
  walletSk: Uint8Array;
  walletPk: Uint8Array;
  walletPkh: Uint8Array;
  walletP2pkh: any;
  address: string;
  addressIndex: number;
}

/**
 * 初始化钱包 - 优化版本，只调用一次 deriveBuyerKey
 * @param addressIndex - 地址索引，默认为0
 * @param mnemonic - 可选：直接提供助记词，否则从环境变量获取
 * @returns 钱包相关的密钥、脚本和地址
 */
export function initializeWallet(addressIndex: number = 0, mnemonic?: string): WalletInfo {
  // 如果提供了助记词参数就使用，否则从环境变量获取
  const finalMnemonic = mnemonic || getMnemonic();
  
  if (!finalMnemonic) {
    throw new Error('助记词未设置：请在环境变量中设置 MNEMONIC 或在函数调用中提供助记词参数');
  }
  
  console.log('使用助记词派生私钥...');
  
  // 只调用一次 deriveBuyerKey，获取完整信息
  const derived = deriveBuyerKey(finalMnemonic, addressIndex);
  
  const ecc = new Ecc();
  const decoded = wif.decode(derived.wif);
  const privateKey = decoded.privateKey;
  const privateKeyHex = Buffer.from(privateKey).toString('hex');
  const walletSk = fromHex(privateKeyHex);
  const walletPk = ecc.derivePubkey(walletSk);
  const walletPkh = shaRmd160(walletPk);
  const walletP2pkh = Script.p2pkh(walletPkh);

  return {
    ecc,
    walletSk,
    walletPk,
    walletPkh,
    walletP2pkh,
    address: derived.address,  // 新增：返回地址信息
    addressIndex
  };
} 