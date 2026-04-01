import { randomBytes } from 'crypto';
import { Agora } from 'ecash-agora';
import {
    P2PKHSignatory,
    fromHex,
    Script,
    ALL_BIP143,
    toHex,
    Ecc
} from 'ecash-lib';
import { chronik as defaultChronik } from '../client/chronik-client';
import { initializeWallet } from '../wallet/wallet-utils';
import { getUtxos } from '../utxo/utxo-utils';
import {
    AgoraFetchOptions,
    AgoraOffer,
    AgoraAcceptOptions,
    AgoraBuyResult,
    Utxo
} from '../types';

const ecc = new Ecc();

/**
 * 规范化 UTXO 字段，确保兼容 ecash-agora 的 bigint 要求
 */
function patchUtxoForAgora(utxo: any): any {
    if (!utxo) return utxo;

    const patched = { ...utxo };
    let sats: bigint;
    if (typeof utxo.sats !== 'undefined') {
        sats = typeof utxo.sats === 'bigint' ? utxo.sats : BigInt(utxo.sats);
    } else if (typeof utxo.value !== 'undefined') {
        sats = typeof utxo.value === 'bigint' ? utxo.value : BigInt(utxo.value);
    } else {
        sats = 0n;
    }
    patched.sats = sats;
    patched.value = Number(sats);

    if (utxo.slpToken || utxo.token) {
        const token = utxo.slpToken || utxo.token;
        const patchedToken = { ...token };
        let atoms: bigint;
        if (typeof token.atoms !== 'undefined') {
            atoms = typeof token.atoms === 'bigint' ? token.atoms : BigInt(token.atoms);
        } else if (typeof token.amount !== 'undefined') {
            atoms = typeof token.amount === 'bigint' ? token.amount : BigInt(token.amount);
        } else {
            atoms = 0n;
        }
        patchedToken.atoms = atoms;
        patchedToken.amount = atoms;
        patched.slpToken = patchedToken;
        patched.token = patchedToken;
    }

    return patched;
}

/**
 * 安全地获取代币原子单位数量
 */
function getTokenAtoms(token: any): bigint {
    if (!token) return 0n;
    if (typeof token.atoms !== 'undefined') {
        return typeof token.atoms === 'bigint' ? token.atoms : BigInt(token.atoms);
    }
    if (typeof token.amount !== 'undefined') {
        return typeof token.amount === 'bigint' ? token.amount : BigInt(token.amount);
    }
    return 0n;
}

/**
 * 包装 Chronik 客户端以自动规范化 UTXO 格式
 */
function createAgoraChronik(chronik: any): any {
    return {
        plugin(name: string) {
            const plugin = chronik.plugin(name);
            if (name !== 'agora') return plugin;
            const compatPlugin = Object.create(plugin);
            compatPlugin.utxos = async (groupHex: string) => {
                const res = await plugin.utxos(groupHex);
                if (Array.isArray(res.utxos)) {
                    res.utxos = res.utxos.map(patchUtxoForAgora);
                }
                return res;
            };
            return compatPlugin;
        },
        script(type: string, hash: string) {
            const scriptApi = chronik.script(type, hash);
            const compatScript = Object.create(scriptApi);
            compatScript.utxos = async () => {
                const res = await scriptApi.utxos();
                if (Array.isArray(res.utxos)) {
                    res.utxos = res.utxos.map(patchUtxoForAgora);
                }
                return res;
            };
            return compatScript;
        },
        blockchainInfo: () => chronik.blockchainInfo(),
        broadcastTx: (hex: string) => chronik.broadcastTx(hex),
    };
}

/**
 * 第一步：查询报价
 */
export async function fetchAgoraOffers(options: AgoraFetchOptions): Promise<AgoraOffer[]> {
    const { tokenId, tokenDecimals = 0, maxPrice = 0, chronik = defaultChronik } = options;
    const agora = new Agora(createAgoraChronik(chronik));

    const offers = await agora.activeOffersByTokenId(tokenId);

    const result: AgoraOffer[] = offers.map(offer => {
        let totalAtoms: bigint;
        let totalSats: bigint;
        let offerType: 'PARTIAL' | 'ONE_TO_ONE';

        if (offer.variant.type === 'PARTIAL') {
            const partial = offer.variant.params;
            totalAtoms = partial.offeredAtoms();
            totalSats = partial.askedSats(totalAtoms);
            offerType = 'PARTIAL';
        } else {
            totalAtoms = getTokenAtoms(offer.token);
            totalSats = offer.askedSats();
            offerType = 'ONE_TO_ONE';
        }

        const totalTokensWithDecimals = Number(totalAtoms) / Math.pow(10, tokenDecimals);
        const totalXEC = Number(totalSats) / 100;
        const pricePerToken = totalTokensWithDecimals > 0 ? totalXEC / totalTokensWithDecimals : 0;

        return {
            offer,
            pricePerToken,
            totalTokenAmount: totalTokensWithDecimals,
            totalXEC,
            offerType
        };
    });

    return result
        .filter(o => maxPrice <= 0 || o.pricePerToken <= maxPrice)
        .sort((a, b) => a.pricePerToken - b.pricePerToken);
}

/**
 * 第二步：执行购买
 */
export async function acceptAgoraOffer(
    agoraOffer: AgoraOffer,
    options: AgoraAcceptOptions
): Promise<AgoraBuyResult> {
    try {
        const { amount, tokenDecimals = 0, addressIndex = 0, mnemonic, chronik = defaultChronik } = options;
        if (amount <= 0) {
            return { success: false, reason: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' };
        }

        const scaledAmount = BigInt(Math.floor(amount * Math.pow(10, tokenDecimals)));
        const offer = agoraOffer.offer;
        const availableAtoms = getTokenAtoms(offer.token);

        let acceptedAtoms = scaledAmount;
        if (offer.variant.type === 'PARTIAL') {
            const partial = offer.variant.params;
            const minAccepted = partial.minAcceptedAtoms();

            if (acceptedAtoms < minAccepted) {
                return {
                    success: false,
                    reason: 'AMOUNT_TOO_SMALL',
                    message: `Amount too small. Minimum: ${Number(minAccepted) / Math.pow(10, tokenDecimals)}`,
                    details: { minAccepted: Number(minAccepted) }
                };
            }

            if (acceptedAtoms > availableAtoms) {
                acceptedAtoms = availableAtoms;
            }

            // 调整为符合截断因子的有效数量
            acceptedAtoms = partial.prepareAcceptedAtoms(acceptedAtoms);

            // 如果购买后剩余量太小，则尝试全买（如果总余额允许）
            const remaining = availableAtoms - acceptedAtoms;
            if (remaining > 0n && remaining < minAccepted) {
                // 自动调整为购买全部可用余额
                acceptedAtoms = availableAtoms;
            }
        } else {
            if (acceptedAtoms !== availableAtoms) {
                return {
                    success: false,
                    reason: 'ONE_TO_ONE_REQUIRED',
                    message: 'This offer requires buying the full amount (ONE_TO_ONE)'
                };
            }
        }

        const askedSats = offer.askedSats(acceptedAtoms);
        const wallet = initializeWallet(addressIndex, mnemonic);
        const utxos = await getUtxos(wallet.address, chronik);

        // 获取区块高度以检查 coinbase 成熟度
        let tipHeight = 0;
        try {
            const info = await chronik.blockchainInfo();
            tipHeight = info.tipHeight;
        } catch (e) {}

        const fuelUtxos = utxos.filter(utxo => {
            if (utxo.slpToken) return false;
            if (utxo.isCoinbase && tipHeight > 0 && utxo.blockHeight > 0) {
                return (tipHeight - utxo.blockHeight + 1) >= 100;
            }
            return true;
        }).map(patchUtxoForAgora);

        const totalBalance = fuelUtxos.reduce((s, u) => s + (u.sats as bigint), 0n);
        if (totalBalance < askedSats) {
            return {
                success: false,
                reason: 'INSUFFICIENT_BALANCE',
                message: `Need ${askedSats} sats for price, have ${totalBalance} sats`
            };
        }

        const fuelInputs = fuelUtxos.map(utxo => ({
            input: {
                prevOut: { txid: utxo.txid, outIdx: utxo.vout },
                signData: { sats: utxo.sats, outputScript: wallet.walletP2pkh }
            },
            signatory: P2PKHSignatory(wallet.walletSk, wallet.walletPk, ALL_BIP143)
        }));

        const acceptFeeSats = offer.acceptFeeSats({
            recipientScript: wallet.walletP2pkh,
            feePerKb: 1000n,
            acceptedAtoms
        });

        if (totalBalance < (askedSats + acceptFeeSats)) {
            return {
                success: false,
                reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
                message: `Need ${askedSats + acceptFeeSats} sats total, have ${totalBalance} sats`,
                details: { price: askedSats, fee: acceptFeeSats }
            };
        }

        const covenantSk = randomBytes(32);
        const covenantPk = ecc.derivePubkey(covenantSk);

        const acceptTx = offer.acceptTx({
            ecc,
            covenantSk,
            covenantPk,
            fuelInputs,
            recipientScript: wallet.walletP2pkh,
            acceptedAtoms,
            dustSats: 546n,
            feePerKb: 1000n,
            allowUnspendable: true
        });

        const broadcastRes = await chronik.broadcastTx(toHex(acceptTx.ser()));

        return {
            success: true,
            reason: 'SUCCESS',
            txid: broadcastRes.txid,
            explorerLink: `https://explorer.e.cash/tx/${broadcastRes.txid}`,
            actualAmount: Number(acceptedAtoms) / Math.pow(10, tokenDecimals),
            totalXECPaid: Number(askedSats + acceptFeeSats) / 100,
            pricePerToken: Number(askedSats) / 100 / (Number(acceptedAtoms) / Math.pow(10, tokenDecimals)),
            networkFee: Number(acceptFeeSats) / 100
        };

    } catch (error: any) {
        console.error('Agora accept failed:', error);
        return {
            success: false,
            reason: 'ERROR',
            message: error.message || 'Unknown error during Agora purchase'
        };
    }
}
