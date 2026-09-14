import {test} from 'node:test';import assert from 'node:assert/strict';import {decodeBill,parseBill} from '../src/lib/bill-import';
const head='交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注';
let n=0;const id=()=>String(++n),accounts=[{id:'wechat',name:'微信'},{id:'ali',name:'支付宝'}];
test('原消费已退款仍保留支出，独立退款作为退款，不把商品文案当退款',()=>{const r=parseBill(head+'\n2026-09-13 10:00,购物,商家,衣服,支出,100,零钱,已退款,p1,o1,\n2026-09-14 10:00,退款,商家,衣服,不计收支,100,零钱,退款成功,r1,o1,\n2026-09-15 10:00,收款,商家,退款保险,收入,20,余额,交易成功,p2,o2,',accounts,id);assert.deepEqual(r.entries.map(e=>e.kind),['expense','refund','income']);assert.equal(r.entries[0].accountId,'wechat');assert.equal(r.entries[2].accountId,'ali');});
test('缺少金额日期或未知账户不猜填，待支付不导入',()=>{const r=parseBill(head+'\n2026-99-99,购物,商家,商品,支出,未知,未知卡,支付成功,p1,,\n2026-09-13,购物,商家,商品,支出,10,零钱,待支付,p2,,',accounts,id);assert.equal(r.entries[0].amount,0);assert.equal(r.entries[0].date,'');assert.equal(r.entries[0].accountId,'');assert.equal(r.skipped,1);assert.equal(r.warnings.length,2);});
test('中文GBK字节可正确解码，UTF8优先',()=>{const gbk=Uint8Array.from([0xd6,0xd0,0xce,0xc4]);assert.equal(decodeBill(gbk.buffer).text,'中文');assert.equal(decodeBill(new TextEncoder().encode('中文').buffer).encoding,'UTF-8');});
test('多个同名微信不猜第一个，银行卡用机构及尾号匹配',()=>{
 const duplicated=[{id:'a',name:'微信',type:'wechat' as const},{id:'b',name:'微信',type:'wechat' as const}];
 const row=(method:string)=>head+`\n2026-09-13,购物,商家,商品,支出,10,${method},支付成功,p1,,`;
 assert.equal(parseBill(row('零钱'),duplicated,id).entries[0].accountId,'');
 assert.equal(parseBill(row('微信'),duplicated,id).entries[0].accountId,'');
 const bank=[...duplicated,{id:'c',name:'工资卡',type:'bank' as const,institution:'招商银行',suffix:'1234'},{id:'d',name:'储蓄卡',type:'bank' as const,institution:'招商银行',suffix:'5678'}];
 assert.equal(parseBill(row('微信-招商银行(5678)'),bank,id).entries[0].accountId,'d');
 assert.equal(parseBill(row('招商银行'),bank,id).entries[0].accountId,'');
 assert.equal(parseBill(row('招商银行(9999)'),bank.slice(0,3),id).entries[0].accountId,'');
});
