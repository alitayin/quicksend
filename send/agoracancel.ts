import { Agora } from 'ecash-agora';
import { Wallet } from 'ecash-wallet';
import { chronik as defaultChronik } from '../client/chronik-client';
import { getMnemonic } from '../config/constants';
import {
    AgoraMyOffersOptions,
    AgoraCancelOptions,
    AgoraCancelResult,
    AgoraOffer as WrappedAgoraOffer
} from '../types';
import { ChronikClient } from 'chronik-client';
import { initializeWallet } from '../wallet/wallet-utils';
import * as wif from 'wif';
import { deriveBuyerKey } from '../wallet/mnemonic-utils';

/**
 * 获取我当前挂出的所有活跃订单
 */
export async function fetchMyAgoraOffers(options: AgoraMyOffersOptions): Promise<WrappedAgoraOffer[]> {
    const { addressIndex = 0, mnemonic, chronik = defaultChronik } = options;

    const finalMnemonic = mnemonic || getMnemonic();
    if (!finalMnemonic) {
        throw new Error('Mnemonic not set');
    }

    // 1. 获取钱包公钥
    const walletInfo = initializeWallet(addressIndex, finalMnemonic);
    const pubkeyHex = Buffer.from(walletInfo.walletPk).toString('hex');

    // 2. 查询节点
    // @ts-ignore
    const agora = new Agora(chronik as ChronikClient);
    const offers = await agora.activeOffersByPubKey(pubkeyHex);

    // 3. 转换为项目统一的 WrappedAgoraOffer 格式
    return offers.map(offer => {
        let totalAtoms: bigint;
        let totalSats: bigint;
        let offerType: 'PARTIAL' | 'ONE_TO_ONE';

        if (offer.variant.type === 'PARTIAL') {
            const partial = offer.variant.params;
            totalAtoms = partial.offeredAtoms();
            totalSats = partial.askedSats(totalAtoms);
            offerType = 'PARTIAL';
        } else {
            // ONE_TO_ONE
            totalAtoms = BigInt(offer.token.atoms);
            totalSats = offer.askedSats();
            offerType = 'ONE_TO_ONE';
        }

        const totalXEC = Number(totalSats) / 100;
        const pricePerToken = totalAtoms > 0n ? totalXEC / Number(totalAtoms) : 0;

        return {
            offer,
            pricePerToken,
            totalTokenAmount: totalAtoms,
            totalXEC,
            offerType
        };
    });
}

/**
 * 取消订单
 */
export async function cancelAgoraOffer(
    agoraOffer: WrappedAgoraOffer,
    options: AgoraCancelOptions
): Promise<AgoraCancelResult> {
    try {
        const { addressIndex = 0, mnemonic, chronik = defaultChronik } = options;

        const finalMnemonic = mnemonic || getMnemonic();
        if (!finalMnemonic) {
            throw new Error('Mnemonic not set');
        }

        // 1. 获取私钥信息 (绕过 ecash-lib 助记词 normalize 报错)
        const derived = deriveBuyerKey(finalMnemonic, addressIndex);
        const decoded = wif.decode(derived.wif);
        const walletSk = decoded.privateKey;

        // 2. 正确初始化 Wallet 实例
        // @ts-ignore
        const wallet = new Wallet(walletSk, chronik as ChronikClient);
        await wallet.sync();

        // 3. 执行取消
        const offer = agoraOffer.offer;
        const result = await offer.cancel({
            wallet,
            feePerKb: 1000n
        });

        if (result.success) {
            return {
                success: true,
                txid: result.broadcasted[0],
                explorerLink: `https://explorer.e.cash/tx/${result.broadcasted[0]}`
            };
        } else {
            return {
                success: false,
                message: result.errors?.join(', ') || 'Failed to cancel offer'
            };
        }

    } catch (error: any) {
        console.error('Agora cancel failed:', error);
        return {
            success: false,
            message: error.message || 'Unknown error during Agora cancellation'
        };
    }
}
