import { Agora } from 'ecash-agora';
import { Wallet } from 'ecash-wallet';
import { chronik as defaultChronik } from '../client/chronik-client';
import { getMnemonic } from '../config/constants';
import {
    AgoraSellOptions,
    AgoraSellResult
} from '../types';
import { ChronikClient } from 'chronik-client';
import * as wif from 'wif';
import { deriveBuyerKey } from '../wallet/mnemonic-utils';

/**
 * 创建 Agora 卖单（挂单）
 * 使用 ecash-wallet 和 AgoraPartial.list 方法
 */
export async function createAgoraOffer(
    options: AgoraSellOptions
): Promise<AgoraSellResult> {
    try {
        const {
            tokenId,
            tokenAmount,
            pricePerToken,
            addressIndex = 0,
            mnemonic,
            chronik = defaultChronik,
            offerType = 'PARTIAL'
        } = options;

        const finalMnemonic = mnemonic || getMnemonic();
        if (!finalMnemonic) {
            throw new Error('Mnemonic not set');
        }

        // 1. 获取私钥 (绕过 normalize 报错)
        const derived = deriveBuyerKey(finalMnemonic, addressIndex);
        const decoded = wif.decode(derived.wif);
        const walletSk = decoded.privateKey;

        // 2. 正确初始化 Wallet 实例
        // 构造函数签名: constructor(sk, chronik, baseHdNode?, accountNumber?, prefix?)
        // @ts-ignore
        const wallet = new Wallet(walletSk, chronik as ChronikClient);

        // 3. 同步数据
        await wallet.sync();

        // 4. 准备价格参数
        // pricePerToken is XEC per token. 1 token = 1 atom now in this simplified logic?
        // No, pricePerToken is usually per 1 whole token (which might be 10^decimals atoms).
        // The user said they want to remove decimals, so 1 token is now defined by the user as some amount of atoms.
        // If the user means price per atom:
        const priceNanoSatsPerAtom = BigInt(Math.floor(pricePerToken * 100 * 1000000000));
        const atomsToSell = tokenAmount;

        let result;

        if (offerType === 'PARTIAL') {
            // 5. 使用 agora.selectParams
            // @ts-ignore
            const agora = new Agora(chronik as ChronikClient);
            const partial = await agora.selectParams({
                offeredAtoms: atomsToSell,
                priceNanoSatsPerAtom,
                makerPk: wallet.pk,
                minAcceptedAtoms: atomsToSell / 100n > 1n ? atomsToSell / 100n : 1n,
                tokenId,
                tokenProtocol: 'ALP',
                tokenType: 0
            });

            // 6. 执行挂单
            result = await partial.list({
                wallet,
                feePerKb: 1000n
            });
        } else {
            throw new Error('ONE_TO_ONE offer type is currently only supported for NFTs');
        }

        if (result.success) {
            const offerTxid = result.broadcasted[result.broadcasted.length - 1];
            return {
                success: true,
                txid: offerTxid,
                explorerLink: `https://explorer.e.cash/tx/${offerTxid}`,
                tokenAmount,
                pricePerToken,
                offerType
            };
        } else {
            return {
                success: false,
                message: result.errors?.join(', ') || 'Failed to list offer'
            };
        }

    } catch (error: any) {
        console.error('Agora offer creation failed:', error);
        return {
            success: false,
            message: error.message || 'Unknown error during Agora offer creation'
        };
    }
}
