import { Agora } from 'ecash-agora';
import {
    Address,
    P2PKHSignatory,
    DEFAULT_DUST_SATS,
    DEFAULT_FEE_SATS_PER_KB,
    EccDummy,
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
    AgoraBuyOptions,
    AgoraBuyAggregateResult,
    AgoraFeeOutput,
    Utxo,
    normalizeError,
    getErrorMessage
} from '../types';

const ecc = new Ecc();
const AGORA_DUST_SATS = DEFAULT_DUST_SATS;
const AGORA_FEE_PER_KB = DEFAULT_FEE_SATS_PER_KB;

/**
 * Fixed covenant keypair for Agora protocol
 * This keypair does not control funds; used only for protocol script construction
 */
const DUMMY_KEYPAIR = {
    sk: fromHex('33'.repeat(32)),
    pk: fromHex('023c72addb4fdf09af94f0c94d7fe92a386a7e70cf8a1d85916386bb2535c7b1b1'),
};

/**
 * Normalize UTXO fields to ensure compatibility with ecash-agora bigint requirements
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

    if (utxo.token) {
        const token = utxo.token;
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
        patched.token = patchedToken;
    }

    return patched;
}

/**
 * Safely get token atoms amount
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

type AgoraBuilderOutput = { sats: bigint; script: Script } | Script;

interface AgoraTxBuilderLike {
    inputs: Array<{ input: { signData?: { sats: bigint | number } } }>;
    sign: (params?: { ecc?: Ecc | EccDummy; feePerKb?: bigint; dustSats?: bigint }) => {
        outputs: Array<{ sats: bigint | number }>;
        ser: () => Uint8Array;
    };
}

interface AgoraOfferWithPrivateBuilder {
    _acceptTxBuilder?: (params: {
        covenantSk: Uint8Array;
        covenantPk: Uint8Array;
        fuelInputs: any[];
        extraOutputs: AgoraBuilderOutput[];
        acceptedAtoms?: bigint;
        allowUnspendable?: boolean;
    }) => AgoraTxBuilderLike;
}

/**
 * Calculate swap fee sats from a maker payout amount.
 * Uses ceiling division.
 * Pass minSats explicitly if you want to enforce a floor above the exact rate.
 */
export function calculateAgoraFeeSats(
    askedSats: bigint,
    feeBps: number,
    minSats: bigint = 0n
): bigint {
    if (askedSats < 0n) {
        throw new Error('askedSats must be non-negative');
    }
    if (!Number.isInteger(feeBps) || feeBps < 0) {
        throw new Error('feeBps must be a non-negative integer');
    }
    if (minSats < 0n) {
        throw new Error('minSats must be non-negative');
    }
    if (feeBps === 0 || askedSats === 0n) {
        return 0n;
    }

    const feeSats = (askedSats * BigInt(feeBps) + 9999n) / 10000n;
    return feeSats === 0n ? 0n : (feeSats < minSats ? minSats : feeSats);
}

function resolveAgoraFeeOutput(
    feeOutput: AgoraFeeOutput | undefined,
    askedSats: bigint
): { sats: bigint; script: Script } | undefined {
    if (!feeOutput) {
        return undefined;
    }

    if (!feeOutput.address) {
        throw new Error('feeOutput.address is required');
    }

    const minSats = feeOutput.minSats ?? 0n;
    const feeSats = calculateAgoraFeeSats(askedSats, feeOutput.feeBps, minSats);
    if (feeSats === 0n) {
        return undefined;
    }
    if (feeSats < AGORA_DUST_SATS) {
        throw new Error(
            `Calculated Agora fee output ${feeSats} sats is below dust ${AGORA_DUST_SATS} sats. Increase the order size, raise feeBps, or set minSats >= ${AGORA_DUST_SATS}.`
        );
    }

    return {
        sats: feeSats,
        script: Address.parse(feeOutput.address).toScript(),
    };
}

function createAgoraBuyerOutputs(
    recipientScript: Script,
    feeOutput?: { sats: bigint; script: Script }
): AgoraBuilderOutput[] {
    const outputs: AgoraBuilderOutput[] = [
        {
            sats: AGORA_DUST_SATS,
            script: recipientScript,
        },
    ];

    if (feeOutput) {
        outputs.push(feeOutput);
    }

    outputs.push(recipientScript);
    return outputs;
}

function getAgoraAcceptTxBuilder(
    offer: any,
    fuelInputs: any[],
    extraOutputs: AgoraBuilderOutput[],
    acceptedAtoms: bigint
): AgoraTxBuilderLike {
    const privateBuilder = (offer as AgoraOfferWithPrivateBuilder)._acceptTxBuilder;
    if (typeof privateBuilder !== 'function') {
        throw new Error('Installed ecash-agora version does not expose _acceptTxBuilder');
    }

    return privateBuilder.call(offer, {
        covenantSk: DUMMY_KEYPAIR.sk,
        covenantPk: DUMMY_KEYPAIR.pk,
        fuelInputs,
        extraOutputs,
        acceptedAtoms,
        allowUnspendable: true,
    });
}

function sumBuilderInputSats(
    inputs: Array<{ input: { signData?: { sats: bigint | number } } }>
): bigint {
    return inputs.reduce((sum, builderInput) => {
        const sats = builderInput.input.signData?.sats;
        return sum + (typeof sats === 'bigint' ? sats : BigInt(sats ?? 0));
    }, 0n);
}

function sumTxOutputSats(outputs: Array<{ sats: bigint | number }>): bigint {
    return outputs.reduce((sum, output) => {
        return sum + (typeof output.sats === 'bigint' ? output.sats : BigInt(output.sats));
    }, 0n);
}

function parseFeeShortfall(error: unknown): bigint | undefined {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/Can only pay for (\d+) fees, but (\d+) required/);
    if (!match) {
        return undefined;
    }
    return BigInt(match[2]) - BigInt(match[1]);
}

/**
 * Wrap Chronik client to normalize UTXO format automatically
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
 * Step 1: Query offers
 */
export async function fetchAgoraOffers(options: AgoraFetchOptions): Promise<AgoraOffer[]> {
    const { tokenId, maxPrice = 0, chronik = defaultChronik } = options;
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

    return result
        .filter(o => maxPrice <= 0 || o.pricePerToken <= maxPrice)
        .sort((a, b) => a.pricePerToken - b.pricePerToken);
}

/**
 * Step 2: Execute purchase
 */
export async function acceptAgoraOffer(
    agoraOffer: AgoraOffer,
    options: AgoraAcceptOptions
): Promise<AgoraBuyResult> {
    try {
        const { amount, addressIndex = 0, mnemonic, chronik = defaultChronik, feeOutput } = options;
        if (amount <= 0n) {
            return { success: false, reason: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' };
        }

        const scaledAmount = amount;
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
                    message: `Amount too small. Minimum: ${minAccepted} atoms`,
                    details: { minAccepted: Number(minAccepted) }
                };
            }

            if (acceptedAtoms > availableAtoms) {
                acceptedAtoms = availableAtoms;
            }

            // Adjust amount to truncated factor
            acceptedAtoms = partial.prepareAcceptedAtoms(acceptedAtoms);

            // If remainder is too small, try to buy all
            const remaining = availableAtoms - acceptedAtoms;
            if (remaining > 0n && remaining < minAccepted) {
                // Auto-adjust to buy full balance
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
        let resolvedFeeOutput: { sats: bigint; script: Script } | undefined;
        try {
            resolvedFeeOutput = resolveAgoraFeeOutput(feeOutput, askedSats);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const reason = message.includes('below dust') ? 'FEE_BELOW_DUST' : 'INVALID_FEE_OUTPUT';
            return {
                success: false,
                reason,
                message
            };
        }
        const swapFeeSats = resolvedFeeOutput?.sats ?? 0n;
        const wallet = initializeWallet(addressIndex, mnemonic);
        const utxos = await getUtxos(wallet.address, chronik);

        // Get block height to check coinbase maturity
        let tipHeight = 0;
        try {
            const info = await chronik.blockchainInfo();
            tipHeight = info.tipHeight;
        } catch (e) {}

        const fuelUtxos = utxos.filter(utxo => {
            if (utxo.token) return false;
            // Coinbase UTXOs need 100 blocks to mature
            if (utxo.isCoinbase) {
                if (tipHeight <= 0 || typeof utxo.blockHeight !== 'number' || utxo.blockHeight <= 0) {
                    return false;
                }
                return (tipHeight - utxo.blockHeight + 1) >= 100;
            }
            return true;
        }).map(patchUtxoForAgora);

        const totalBalance = fuelUtxos.reduce((s, u) => s + (u.sats as bigint), 0n);
        const requiredWithoutNetworkFee = askedSats + swapFeeSats;
        if (totalBalance < requiredWithoutNetworkFee) {
            return {
                success: false,
                reason: 'INSUFFICIENT_BALANCE',
                message: `Need ${requiredWithoutNetworkFee} sats for price and swap fee, have ${totalBalance} sats`,
                details: { price: askedSats, swapFee: swapFeeSats }
            };
        }

        const fuelInputs = fuelUtxos.map(utxo => ({
            input: {
                prevOut: { txid: utxo.txid, outIdx: utxo.vout },
                signData: { sats: utxo.sats, outputScript: wallet.walletP2pkh }
            },
            signatory: P2PKHSignatory(wallet.walletSk, wallet.walletPk, ALL_BIP143)
        }));

        const acceptTxBuilder = getAgoraAcceptTxBuilder(
            offer,
            fuelInputs as any[],
            createAgoraBuyerOutputs(wallet.walletP2pkh, resolvedFeeOutput),
            acceptedAtoms
        );

        let networkFeeSats: bigint;
        try {
            const measuredTx = acceptTxBuilder.sign({
                ecc: new EccDummy(),
                feePerKb: AGORA_FEE_PER_KB,
                dustSats: AGORA_DUST_SATS
            });
            networkFeeSats = sumBuilderInputSats(acceptTxBuilder.inputs) - sumTxOutputSats(measuredTx.outputs);
        } catch (error) {
            const shortfall = parseFeeShortfall(error);
            if (typeof shortfall === 'bigint' && shortfall > 0n) {
                return {
                    success: false,
                    reason: 'INSUFFICIENT_BALANCE_WITH_FEE',
                    message: `Need at least ${totalBalance + shortfall} sats total including network fee, have ${totalBalance} sats`,
                    details: { price: askedSats, swapFee: swapFeeSats, shortfall }
                };
            }
            throw error;
        }

        const acceptTx = acceptTxBuilder.sign({
            feePerKb: AGORA_FEE_PER_KB,
            dustSats: AGORA_DUST_SATS
        });

        const broadcastRes = await chronik.broadcastTx(toHex(acceptTx.ser()));

        return {
            success: true,
            reason: 'SUCCESS',
            txid: broadcastRes.txid,
            explorerLink: `https://explorer.e.cash/tx/${broadcastRes.txid}`,
            actualAmount: acceptedAtoms,
            totalXECPaid: Number(askedSats + swapFeeSats + networkFeeSats) / 100,
            pricePerToken: Number(askedSats) / 100 / Number(acceptedAtoms),
            networkFee: Number(networkFeeSats) / 100,
            swapFeePaid: Number(swapFeeSats) / 100
        };

    } catch (error: unknown) {
        const txError = normalizeError(error);
        console.error('Agora accept failed:', txError);
        return {
            success: false,
            reason: 'ERROR',
            message: getErrorMessage(txError)
        };
    }
}

/**
 * Aggregate buy: loop purchase multiple offers until target amount reached
 * Mode 2: target amount + max price, auto-select offers
 */
export async function buyAgoraTokens(options: AgoraBuyOptions): Promise<AgoraBuyAggregateResult> {
    const { tokenId, amount, maxPrice, addressIndex, mnemonic, chronik, feeOutput } = options;

    const transactions: Array<{ txid: string; amount: bigint; price: number; fee: number; swapFee: number }> = [];
    let totalBought = 0n;
    let totalXECPaid = 0;
    let totalSwapFeePaid = 0;
    let skippedOffers = 0;

    try {
        // Get all offers matching price criteria
        const offers = await fetchAgoraOffers({ tokenId, maxPrice, chronik });

        if (offers.length === 0) {
            return {
                success: false,
                totalBought: 0n,
                totalXECPaid: 0,
                totalSwapFeePaid: 0,
                avgPrice: 0,
                transactions: [],
                skippedOffers: 0,
                message: `No offers found below ${maxPrice} XEC`
            };
        }

        // Loop purchase offers
        for (const offer of offers) {
            if (totalBought >= amount) break;

            const remaining = amount - totalBought;
            const buyAmount = remaining < offer.totalTokenAmount ? remaining : offer.totalTokenAmount;

            const result = await acceptAgoraOffer(offer, {
                amount: buyAmount,
                addressIndex,
                mnemonic,
                chronik,
                feeOutput
            });

            if (result.success && result.txid) {
                const actualAmount = result.actualAmount || buyAmount;
                transactions.push({
                    txid: result.txid,
                    amount: actualAmount,
                    price: result.pricePerToken || offer.pricePerToken,
                    fee: result.networkFee || 0,
                    swapFee: result.swapFeePaid || 0
                });
                totalBought += actualAmount;
                totalXECPaid += result.totalXECPaid || 0;
                totalSwapFeePaid += result.swapFeePaid || 0;
            } else {
                skippedOffers++;
            }
        }

        const avgPrice = totalBought > 0n ? totalXECPaid / Number(totalBought) : 0;

        return {
            success: totalBought > 0n,
            totalBought,
            totalXECPaid,
            totalSwapFeePaid,
            avgPrice,
            transactions,
            skippedOffers,
            message: totalBought >= amount
                ? `Successfully bought ${totalBought} tokens`
                : `Partially filled: bought ${totalBought} of ${amount} tokens`
        };

    } catch (error: unknown) {
        const txError = normalizeError(error);
        return {
            success: false,
            totalBought,
            totalXECPaid,
            totalSwapFeePaid,
            avgPrice: totalBought > 0n ? totalXECPaid / Number(totalBought) : 0,
            transactions,
            skippedOffers,
            message: getErrorMessage(txError)
        };
    }
}
