import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanReceiptNote} from '../src/server/receipt-note';
test('keeps receipt facts while removing internal account commentary',()=>{
 assert.equal(cleanReceiptNote('支付宝支付169元；accountId因无法唯一匹配支付宝账户留空。'), '支付宝支付169元；');
 assert.equal(cleanReceiptNote('支付宝支付169元；银行卡尾号1234。'), '支付宝支付169元；银行卡尾号1234。');
 assert.equal(cleanReceiptNote('Paid with Alipay. accountId left blank because ambiguous.'), 'Paid with Alipay.');
});
test('drops fulfillment and missing-field commentary but keeps useful context',()=>{
 assert.equal(cleanReceiptNote('订单状态为配餐中，实付7.5元;页面未显示交易时间、订单号和支付平台。'),'');
 assert.equal(cleanReceiptNote('给同事买的；订单状态为配送中。'),'给同事买的；');
});
