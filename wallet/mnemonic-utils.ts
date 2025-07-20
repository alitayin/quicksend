import { mnemonicToSeed, HdNode, shaRmd160 } from 'ecash-lib';
import * as wif from 'wif';
import { encodeCashAddress } from 'ecashaddrjs';

// 派生密钥结果接口
interface DerivedKey {
  wif: string;
  address: string;
  addressIndex: number;
  derivationPath: string;
}

/**
 * 从助记词派生出WIF格式的私钥和地址
 * @param mnemonic - 助记词
 * @param addressIndex - 地址索引，默认为0（第0个地址）
 * @param derivationPath - 派生路径基础部分，默认为 "m/44'/1899'/0'/0"
 * @returns 包含 wif 和 address 的对象
 */
export function deriveBuyerKey(
  mnemonic: string, 
  addressIndex: number = 0, 
  derivationPath: string = "m/44'/1899'/0'/0"
): DerivedKey {
  console.log(`从助记词派生密钥...（地址索引: ${addressIndex}）`);
  
  // 将助记词转换为种子
  const seed = mnemonicToSeed(mnemonic);
  
  // 从种子生成根 HD 节点
  const hdRoot = HdNode.fromSeed(seed);
  
  // 构建完整的派生路径，包含地址索引
  const fullDerivationPath = `${derivationPath}/${addressIndex}`;
  
  // 使用路径派生子节点
  const childNode = hdRoot.derivePath(fullDerivationPath);
  
  // 获取公钥并创建 eCash 地址
  const pubkey = childNode.pubkey();
  const pubkeyHash = shaRmd160(pubkey);
  const ecashAddress = encodeCashAddress('ecash', 'p2pkh', pubkeyHash);
  
  // 提取私钥缓冲区
  const privateKeyBuffer = childNode.seckey();
  
  // 将私钥转换为 WIF (0x80 是比特币主网的前缀)
  const buyerWIF = wif.encode({
    version: 0x80,
    privateKey: Buffer.from(privateKeyBuffer),
    compressed: true
  });
  
  console.log(`密钥派生完成，地址索引 ${addressIndex}:`, ecashAddress);
  
  return {
    wif: buyerWIF,
    address: ecashAddress,
    addressIndex: addressIndex,
    derivationPath: fullDerivationPath
  };
}

/**
 * 验证助记词格式
 * @param mnemonic - 助记词
 * @returns 是否为有效助记词
 */
export function validateMnemonic(mnemonic: string | null | undefined): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return false;
  }
  
  const words = mnemonic.trim().split(/\s+/);
  // 助记词通常是12, 15, 18, 21, 24个单词
  return [12, 15, 18, 21, 24].includes(words.length);
} 