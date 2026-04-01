import quick from './index';

// Mnemonic configuration
const mnemonic = 'valve vast enrich divorce mandate load risk miracle remind people play maid';

/**
 * Original local tests (XEC and tokens)
 */
async function testOriginal() {
    const RECIPIENT = 'ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv';
    const TOKEN_SLP = '54dc2ecd5251f8dfda4c4f15ce05272116b01326076240e2b9cc0104d33b1484'; // ALITA (SLP)
    const TOKEN_ALP = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb'; // SS (ALP)

    console.log('\n=== [Original Tests] Starting ===');

    try {
        console.log('Sending 10000 sats (100 XEC) via sendXec...');
        const xecResult = await quick.sendXec(
            [{ address: RECIPIENT, amount: 10000n }],
            { mnemonic }
        );
        console.log('XEC txid:', xecResult.txid);

        console.log('\nSending SLP atoms via unified send (Auto-detect)...');
        const slpResult = await quick.send(
            'slp', // type is optional now, but testing backward compatibility
            [{ address: RECIPIENT, amount: 1000n }],
            { tokenId: TOKEN_SLP, mnemonic }
        );
        console.log('SLP txid:', slpResult.txid);

        console.log('\nSending ALP atoms via sendToken (Auto-detect)...');
        const alpResult = await quick.sendToken(
            [{ address: RECIPIENT, amount: 100n }],
            { tokenId: TOKEN_ALP, mnemonic }
        );
        console.log('ALP txid:', alpResult.txid);
    } catch (error) {
        console.error('Original test failed:', error);
    }
}

/**
 * Agora buy test (single mode)
 */
async function testAgoraBuy() {
    const tokenId = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb';
    const maxPrice = 2.8;
    const amountToBuy = 1000n;

    console.log(`\n=== [Agora Buy Test] Fetching offers for: ${tokenId}... ===`);

    try {
        const offers = await quick.fetchAgoraOffers({
            tokenId,
            maxPrice
        });

        if (offers.length === 0) {
            console.log(`No offers found below ${maxPrice} XEC.`);
            return;
        }

        console.log(`Found ${offers.length} matching offers.`);
        const bestOffer = offers[0];
        console.log(`Best offer: Price ${bestOffer.pricePerToken} XEC, Type: ${bestOffer.offerType}`);

        console.log(`Attempting to buy ${amountToBuy} tokens...`);

        const result = await quick.acceptAgoraOffer(bestOffer, {
            amount: amountToBuy,
            mnemonic
        });

        if (result.success) {
            console.log(`✓ Buy success! txid: ${result.txid}`);
            console.log(`  Total paid: ${result.totalXECPaid} XEC`);
        } else {
            console.error('✗ Buy failed:', result.message);
        }
    } catch (error) {
        console.error('Agora test exception:', error);
    }
}

/**
 * Aggregate buy test (automatic multi-order fill)
 */
async function testAgoraAggregateBuy() {
    const tokenId = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb';
    const maxPrice = 2.8;
    const amountToBuy = 5000n;

    console.log(`\n=== [Agora Aggregate Buy Test] Target: ${amountToBuy} tokens, Max Price: ${maxPrice} XEC ===`);

    try {
        const result = await quick.buyAgoraTokens({
            tokenId,
            amount: amountToBuy,
            maxPrice,
            mnemonic
        });

        if (result.success) {
            console.log(`✓ Aggregate buy success!`);
            console.log(`  Actual bought: ${result.totalBought}`);
            console.log(`  Total paid: ${result.totalXECPaid.toFixed(2)} XEC`);
            console.log(`  Avg price: ${result.avgPrice.toFixed(4)} XEC`);
            console.log(`  Orders filled: ${result.transactions.length}`);
            console.log(`  Orders skipped: ${result.skippedOffers}`);
            result.transactions.forEach((tx, i) => {
                console.log(`  [${i + 1}] ${tx.txid.slice(0, 16)}... bought ${tx.amount}`);
            });
        } else {
            console.error('✗ Aggregate buy failed:', result.message);
        }
    } catch (error) {
        console.error('Aggregate buy test exception:', error);
    }
}

/**
 * Agora Sell and Cancel Test (Auto-detect protocol)
 */
async function testAgoraSellAndCancel() {
    const TOKEN_SLP = '54dc2ecd5251f8dfda4c4f15ce05272116b01326076240e2b9cc0104d33b1484';
    const TOKEN_ALP = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb';

    const testTokens = [
        { id: TOKEN_SLP, name: 'SLP (ALITA)', amount: 100n },
        { id: TOKEN_ALP, name: 'ALP (SS)', amount: 10n }
    ];

    for (const token of testTokens) {
        console.log(`\n=== [Agora Sell/Cancel Test] Token: ${token.name} ===`);

        try {
            // 1. Create Offer
            console.log(`Listing ${token.amount} atoms...`);
            const sellResult = await quick.createAgoraOffer({
                tokenId: token.id,
                tokenAmount: token.amount,
                pricePerToken: 10, // Increased price to avoid dust error
                mnemonic
            });

            if (!sellResult.success) {
                console.error(`✗ Listing failed:`, sellResult.message);
                continue;
            }
            console.log(`✓ Listing success! txid: ${sellResult.txid}`);

            // 2. Fetch My Offers to find the one to cancel
            console.log(`Fetching my offers to verify...`);
            const myOffers = await quick.fetchMyAgoraOffers({
                mnemonic
            });

            // Use type-safe check for tokenId
            const createdOffer = myOffers.find(o => {
                const params = (o.offer.variant as any).params;
                return params && params.tokenId === token.id;
            });
            if (!createdOffer) {
                console.error(`✗ Could not find the created offer in my offers list`);
                continue;
            }
            console.log(`✓ Found offer in my list. Protocol: ${(createdOffer.offer.token as any).protocol}`);

            // 3. Cancel Offer
            console.log(`Canceling offer...`);
            const cancelResult = await quick.cancelAgoraOffer(createdOffer, {
                mnemonic
            });

            if (cancelResult.success) {
                console.log(`✓ Cancel success! txid: ${cancelResult.txid}`);
            } else {
                console.error(`✗ Cancel failed:`, cancelResult.message);
            }

        } catch (error) {
            console.error(`Sell/Cancel test failed for ${token.name}:`, error);
        }
    }
}

async function runAllTests() {
    await testOriginal();
    await testAgoraBuy();
    await testAgoraAggregateBuy();
    await testAgoraSellAndCancel();
}

runAllTests();
