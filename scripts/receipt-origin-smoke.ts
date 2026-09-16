import assert from 'node:assert/strict';
import {receiptOriginSchema,receiptPlatform,matchReceiptWallet,mergeReceiptOrigins} from '../src/lib/receipt-origin';
const wallets=[{id:'wechat-1',name:'微信',type:'wechat',owner_id:'me'},{id:'bank-1',name:'工商银行',type:'bank',institution:'工商银行',suffix:'1234',owner_id:'me'},{id:'private-other',name:'微信',type:'wechat',owner_id:'other'},{id:'shared',name:'共同钱包',type:'wechat',owner_id:null}];
const make=(value:unknown)=>receiptOriginSchema.parse(value);
const jd=make({orderPlatform:{name:'京东',basis:'visual',cues:['订单导航布局','京东订单服务图标']},paymentChannel:{name:'微信',basis:'explicit',cues:['支付方式：微信支付']}});
assert.equal(receiptPlatform(jd),'京东');assert.equal(matchReceiptWallet(jd,wallets,'me').accountId,'');
const bank={...jd,funding:{type:'bank' as const,institution:'工商银行',suffix:'1234',evidence:'付款方式 工商银行储蓄卡(1234)'}};
assert.equal(matchReceiptWallet(bank,wallets,'me').accountId,'bank-1');
assert.equal(matchReceiptWallet({...bank,funding:{...bank.funding,suffix:'9999'}},wallets,'me').accountId,'');
const balance=make({paymentChannel:{name:'微信',basis:'visual',cues:['微信支付账单布局','微信支付图标']},funding:{type:'wechat_balance',evidence:'支付方式：零钱'}});
assert.equal(receiptPlatform(balance),'微信');assert.equal(matchReceiptWallet(balance,wallets,'me').accountId,'wechat-1');
assert.equal(matchReceiptWallet(balance,[...wallets,{...wallets[0],id:'wechat-2'}],'me').accountId,'');
assert.deepEqual(matchReceiptWallet(balance,[...wallets,{...wallets[0],id:'wechat-2'}],'me').candidates,['wechat-1','wechat-2']);
assert.equal(matchReceiptWallet({...balance,funding:{...balance.funding,evidence:''}},wallets,'me').accountId,'');
assert.equal(receiptPlatform(make({orderPlatform:{name:'抖音',basis:'unknown',cues:[]}})),'');
assert.equal(matchReceiptWallet(make({funding:{type:'bank',evidence:'银行卡'}}),wallets,'me').accountId,'');
assert.equal(matchReceiptWallet(balance, wallets.map(w=>({...w,archived:true})),'me').accountId,'');
console.log('PASS platform/channel separation, explicit funding, bank suffix, multiple wallets, ownership and archived accounts');

const combined=mergeReceiptOrigins(jd,balance)!;assert.equal(receiptPlatform(combined),'京东');assert.equal(matchReceiptWallet(combined,wallets,'me').accountId,'wechat-1');
assert.equal(matchReceiptWallet(mergeReceiptOrigins(bank,balance),wallets,'me').accountId,'');
console.log('PASS cross-image complementary evidence and conflicting funding remains unassigned');

const {mergeReceipts}=await import('../src/server/receipt-merge');
const row={kind:'expense',amount:2000,date:'2026-09-16',payee:'merchant',accountId:'',orderId:'order-1',platform:'京东',occurredAt:'',source:'原图1',note:'',status:'paid',lineItems:[],receiptOrigin:jd};
const other={...row,platform:'微信',source:'原图2',receiptOrigin:balance};
const result=await mergeReceipts([row,other],raw=>raw as typeof row,{},async()=>({sameOrder:true,entry:{...row,receiptOrigin:bank}}));
assert.equal(result.entries.length,1);assert.equal(result.entries[0].platform,'京东');assert.equal(result.entries[0].receiptOrigin.funding.type,'wechat_balance');
console.log('PASS merged origins retain source evidence rather than invented model wallet');
