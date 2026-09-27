import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCostPlan,costReport,distribute,type CostPlan} from '../src/lib/cost-attribution';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',tx='10000000-0000-4000-8000-000000000003';
function rent():CostPlan{return {title:'房租',category:'房租',familyId:null,sources:[{transactionId:tx,amount:1290000}],coverageStart:'2026-10-15',coverageEnd:'2027-01-15',mode:'monthly',startMonth:'2026-10',months:3,periods:[],shares:[{userId:a,amount:870000},{userId:b,amount:420000}],offsets:[10,11,12].map((m,i)=>({id:`20000000-0000-4000-8000-00000000000${i}`,transactionId:tx,userId:a,month:`2026-${m}`,amount:150000,shared:false}))};}
test('quarter payment becomes costs, salary portion only offsets its beneficiary',()=>{
 const p=rent(),before=JSON.stringify(p),r=calculateCostPlan(p);assert.equal(r.total,1290000);assert.deepEqual(r.periods.map(x=>x.amount),[430000,430000,430000]);
 assert.deepEqual(costReport(p,'2026-10-01','2026-12-31',a).map(x=>x.net),[140000,140000,140000]);
 assert.deepEqual(costReport(p,'2026-10-01','2026-12-31',b).map(x=>x.net),[140000,140000,140000]);
 assert.equal(costReport(p,'2026-10-01','2026-12-31',undefined,true)[0].offset,0);assert.equal(JSON.stringify(p),before);
});
test('expected and partial salary receipts never become realized offsets',()=>{
 const p=rent();p.offsets[0].amount=100000;p.offsets.push({...p.offsets[0],id:'30000000-0000-4000-8000-000000000001',transactionId:null,amount:50000});
 const r=costReport(p,'2026-10-01','2026-10-31',a)[0];assert.equal(r.net,190000);assert.equal(r.projected,140000);
});
test('daily coverage spans four calendar months, without losing cents',()=>{
 const p=rent();p.mode='daily';const r=calculateCostPlan(p);assert.equal(r.periods.length,4);assert.equal(r.periods.reduce((n,x)=>n+x.amount,0),1290000);assert.equal(r.periods[0].start,'2026-10-15');assert.equal(r.periods.at(-1)!.end,'2027-01-15');
 for(const s of p.shares)assert.equal(r.periods.reduce((n,x)=>n+x.shares.find(v=>v.userId===s.userId)!.amount,0),s.amount);
});
test('custom amounts preserve both row and member totals',()=>{
 const p=rent();p.mode='custom';p.periods=[{start:'2026-10-01',end:'2026-11-01',amount:1},{start:'2026-11-01',end:'2026-12-01',amount:1289999}];const r=calculateCostPlan(p);
 for(const row of r.periods)assert.equal(row.shares.reduce((n,x)=>n+x.amount,0),row.amount);
 for(const s of p.shares)assert.equal(r.periods.reduce((n,x)=>n+x.shares.find(v=>v.userId===s.userId)!.amount,0),s.amount);
});
test('arbitrary date ranges compose back to monthly results',()=>{
 const p=rent(),month=costReport(p,'2026-10-01','2026-10-31',a)[0],x=costReport(p,'2026-10-01','2026-10-12',a)[0],y=costReport(p,'2026-10-13','2026-10-31',a)[0];assert.equal(x.cost+y.cost,month.cost);assert.equal(x.offset+y.offset,month.offset);
});
test('overcompensation remains negative and never clamps to zero',()=>{const p=rent();p.offsets[0].amount=500000;assert.equal(costReport(p,'2026-10-01','2026-10-31',a)[0].net,-210000);});
test('invalid and overlapping rules rejected',()=>{
 const p=rent();assert.throws(()=>calculateCostPlan({...p,shares:[{userId:a,amount:1}]}));assert.throws(()=>calculateCostPlan({...p,coverageEnd:p.coverageStart}));assert.throws(()=>calculateCostPlan({...p,mode:'custom',periods:[{start:'2026-10-01',end:'2026-12-01',amount:900000},{start:'2026-11-01',end:'2027-01-01',amount:390000}]}));
});
test('integer precision for large weights and penny remainders',()=>{assert.deepEqual(distribute(100,[1,1,1]),[34,33,33]);assert.deepEqual(distribute(100000000000,[50000000000,50000000000]),[50000000000,50000000000]);});
test('partial-day household costs equal the sum of member costs',()=>{const p=rent();p.mode='daily';for(const day of ['2026-10-15','2026-10-16','2026-11-01','2027-01-14']){const total=costReport(p,day,day)[0].cost;assert.equal(total,p.shares.reduce((n,s)=>n+costReport(p,day,day,s.userId)[0].cost,0));}});
