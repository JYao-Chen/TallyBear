import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeWalletFunds,fundRowsPage,type FundEvent} from '../src/lib/wallet-funds';
const accounts=[{id:'a',opening:200000},{id:'b',opening:0}];
const event=(id:string,kind:FundEvent['kind'],amount:number,extra:Partial<FundEvent>={}):FundEvent=>({id,kind,amount,date:'2026-10-04',sourceId:'a',targetId:null,title:'Record',counterparty:'Yier',sourceName:'WeChat',targetName:'',note:'',origin:'transaction',...extra});
const report=(events:FundEvent[])=>summarizeWalletFunds(events,accounts,'2026-10-01','2026-10-31');
test('家庭转账进入资金口径，不混进消费；真实示例净流出1179.53',()=>{
 const r=report([event('expense','expense',109653),event('out','transfer',14000,{targetId:'other',origin:'family'}),event('in','transfer',5700,{sourceId:'other',targetId:'a',origin:'family'})]);
 assert.equal(r.summary.expense,109653);assert.equal(r.summary.transferOut,14000);assert.equal(r.summary.transferIn,5700);assert.equal(r.summary.flowChange,-117953);assert.equal(r.summary.closingBalance,82047);
});
test('本人口袋互转抵消，不重复流入流出；别人的流水排除',()=>{
 const r=report([event('own','transfer',10000,{targetId:'b'}),event('foreign','expense',999999,{sourceId:'other'})]);assert.equal(r.summary.internalTransfer,10000);assert.equal(r.summary.inflow,0);assert.equal(r.summary.outflow,0);assert.equal(r.rows.length,1);
});
test('退款、收入和校准分离，期初期末余额可还原',()=>{
 const r=report([event('before','expense',5000,{date:'2026-09-30'}),event('income','income',10000),event('refund','refund',2000),event('expense','expense',6000),event('adjust','adjustment',-500,{origin:'adjustment'}),event('future','expense',999,{date:'2026-11-01'})]);assert.equal(r.summary.openingBalance,195000);assert.equal(r.summary.flowChange,6000);assert.equal(r.summary.adjustment,-500);assert.equal(r.summary.closingBalance,200500);assert.equal(r.summary.balanceChange,5500);
});
test('单钱包范围的转出转入正确，信用余额可为负',()=>{
 const r=summarizeWalletFunds([event('credit','expense',3000),event('repay','transfer',1000,{sourceId:'outside',targetId:'a'})],[{id:'a',opening:0}],'2026-10-01','2026-10-31');assert.equal(r.summary.closingBalance,-2000);assert.equal(r.summary.transferIn,1000);
});
test('搜索分页保留完整期间汇总，可以按成员、钱包、支付编号和方向筛选',()=>{
 const r=report(Array.from({length:25},(_,i)=>event(String(i),'transfer',100,{targetId:'other',reference:'PAY-'+i,origin:'family'})));const p=fundRowsPage(r.rows,new URLSearchParams({q:'Yier',flow:'out'}));assert.equal(p.count,25);assert.equal(p.rows.length,20);assert.equal(p.hasMore,true);assert.equal(r.summary.outflow,2500);assert.equal(fundRowsPage(r.rows,new URLSearchParams({q:'PAY-24'})).count,1);assert.equal(fundRowsPage(r.rows,new URLSearchParams({flow:'in'})).count,0);
});
