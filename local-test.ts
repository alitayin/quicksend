import quick from './index';

// Mnemonic configuration
const mnemonic = 'valve vast enrich divorce mandate load risk miracle remind people play maid';

/**
 * Original local tests (XEC and tokens)
 */
async function testOriginal() {
    const RECIPIENT = 'ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv';
    const TOKEN_MIST = '54dc2ecd5251f8dfda4c4f15ce05272116b01326076240e2b9cc0104d33b1484';
    const TOKEN_GRAIL = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb';

    console.log('\n=== [Original Tests] Starting ===');

    try {
        console.log('Sending 10000 sats (100 XEC)...');
        const xecResult = await quick.sendXec(
            [{ address: RECIPIENT, amount: 10000n }],
            { mnemonic }
        );
        console.log('XEC txid:', xecResult.txid);

        console.log('\nSending 1000 MIST atoms (SLP)...');
        const mistResult = await quick.sendSlp(
            [{ address: RECIPIENT, amount: 1000n }],
            { tokenId: TOKEN_MIST, mnemonic }
        );
        console.log('MIST txid:', mistResult.txid);

        console.log('\nSending 100 GRAIL atoms (ALP)...');
        const grailResult = await quick.sendAlp(
            [{ address: RECIPIENT, amount: 100n }],
            { tokenId: TOKEN_GRAIL, mnemonic }
        );
        console.log('GRAIL txid:', grailResult.txid);
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

async function runAllTests() {
    await testOriginal();
    await testAgoraBuy();
    await testAgoraAggregateBuy();
}

runAllTests();
