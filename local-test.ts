import quick from './index';

// 助记词配置
const mnemonic = 'upgrade rocket air motion pull scorpion element confirm cross despair uphold olympic';

/**
 * 原有的本地测试（发送 XEC 和代币）
 */
async function testOriginal() {
    const RECIPIENT = 'ecash:qr6lws9uwmjkkaau4w956lugs9nlg9hudqs26lyxkv';
    const TOKEN_MIST = '54dc2ecd5251f8dfda4c4f15ce05272116b01326076240e2b9cc0104d33b1484';
    const TOKEN_GRAIL = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb';

    console.log('\n=== [原有测试] 开始运行 ===');

    try {
        console.log('发送 100 XEC...');
        const xecResult = await quick.sendXec(
            [{ address: RECIPIENT, amount: 10000 }],
            { mnemonic }
        );
        console.log('XEC txid:', xecResult.txid);

        console.log('\n发送 1000 MIST (SLP)...');
        const mistResult = await quick.sendSlp(
            [{ address: RECIPIENT, amount: 1000 }],
            { tokenId: TOKEN_MIST, tokenDecimals: 4, mnemonic }
        );
        console.log('MIST txid:', mistResult.txid);

        console.log('\n发送 100 GRAIL (ALP)...');
        const grailResult = await quick.sendAlp(
            [{ address: RECIPIENT, amount: 100 }],
            { tokenId: TOKEN_GRAIL, tokenDecimals: 0, mnemonic }
        );
        console.log('GRAIL txid:', grailResult.txid);
    } catch (error) {
        console.error('原有测试失败:', error);
    }
}

/**
 * 新增的 Agora 购买测试（单笔模式）
 */
async function testAgoraBuy() {
    const tokenId = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb';
    const maxPrice = 5;
    const amountToBuy = 100;
    const tokenDecimals = 0;

    console.log(`\n=== [Agora 购买测试] 正在查询代币报价: ${tokenId}... ===`);

    try {
        const offers = await quick.fetchAgoraOffers({
            tokenId,
            tokenDecimals,
            maxPrice
        });

        if (offers.length === 0) {
            console.log(`未找到单价低于 ${maxPrice} XEC 的报价。`);
            return;
        }

        console.log(`找到 ${offers.length} 个符合条件的报价。`);
        const bestOffer = offers[0];
        console.log(`选中最优惠报价: 单价 ${bestOffer.pricePerToken} XEC, 类型: ${bestOffer.offerType}`);

        console.log(`尝试购买 ${amountToBuy} 个代币...`);

        const result = await quick.acceptAgoraOffer(bestOffer, {
            amount: amountToBuy,
            tokenDecimals,
            mnemonic
        });

        if (result.success) {
            console.log('Agora 购买成功！');
            console.log('交易 ID:', result.txid);
            console.log('实际购买数量:', result.actualAmount);
            console.log('总共支付 XEC (含手续费):', result.totalXECPaid);
        } else {
            console.error('Agora 购买失败:', result.reason);
            console.error('详细信息:', result.message);
        }
    } catch (error) {
        console.error('Agora 测试发生异常:', error);
    }
}

/**
 * 聚合购买测试（模式2：自动循环多个订单）
 */
async function testAgoraAggregateBuy() {
    const tokenId = 'd1131675cb62b65909fb45ba53b022da0bd0f34aaa71fc61770115472b186ffb';
    const maxPrice = 2.8;
    const amountToBuy = 100000; // 买大量，测试跨订单
    const tokenDecimals = 0;

    console.log(`\n=== [Agora 聚合购买测试] 目标: ${amountToBuy} 个代币，最高价 ${maxPrice} XEC ===`);

    try {
        const result = await quick.buyAgoraTokens({
            tokenId,
            amount: amountToBuy,
            maxPrice,
            tokenDecimals,
            mnemonic
        });

        if (result.success) {
            console.log(`✓ 聚合购买成功！`);
            console.log(`  实际买到: ${result.totalBought} 个`);
            console.log(`  总花费: ${result.totalXECPaid.toFixed(2)} XEC`);
            console.log(`  平均单价: ${result.avgPrice.toFixed(4)} XEC`);
            console.log(`  成交订单数: ${result.transactions.length}`);
            console.log(`  跳过订单数: ${result.skippedOffers}`);
            result.transactions.forEach((tx, i) => {
                console.log(`  [${i + 1}] ${tx.txid.slice(0, 16)}... 买入 ${tx.amount} 个`);
            });
        } else {
            console.error('✗ 聚合购买失败:', result.message);
        }
    } catch (error) {
        console.error('聚合购买测试异常:', error);
    }
}

async function runAllTests() {
    // 你可以根据需要注释掉其中一个
    // await testOriginal();
    // await testAgoraBuy();
    await testAgoraAggregateBuy();
}

runAllTests();
