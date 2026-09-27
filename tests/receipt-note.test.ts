import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanReceiptNote,separateReceiptNote} from '../src/server/receipt-note';
test('processing explanations become hints rather than ledger notes',()=>{
 const result=separateReceiptNote('给同事买的。 同一笔七鲜订单的长图被拆成两段，已合并为一张卡片，金额按结算区实付73.87元，不叠加另一段。可见商品行合计59.97元，与实付相差13.90元，截图中未显示对应商品行或费用，未自行补记。');
 assert.equal(result.note,'给同事买的。');assert.equal(result.hints.length,2);
});
test('keeps receipt facts while removing internal account commentary',()=>{
 assert.equal(cleanReceiptNote('支付宝支付169元；accountId因无法唯一匹配支付宝账户留空。'), '支付宝支付169元；');
 assert.equal(cleanReceiptNote('支付宝支付169元；银行卡尾号1234。'), '支付宝支付169元；银行卡尾号1234。');
 assert.equal(cleanReceiptNote('Paid with Alipay. accountId left blank because ambiguous.'), 'Paid with Alipay.');
});
test('drops fulfillment and missing-field commentary but keeps useful context',()=>{
 assert.equal(cleanReceiptNote('订单状态为配餐中，实付7.5元;页面未显示交易时间、订单号和支付平台。'),'');
 assert.equal(cleanReceiptNote('给同事买的；订单状态为配送中。'),'给同事买的；');
});
