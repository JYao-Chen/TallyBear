import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledCostPlan} from '../src/lib/cost-schedule';
import {calculateCostPlan} from '../src/lib/cost-attribution';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
const rule={title:'Rent',category:'Rent',familyId:null,firstDate:'2026-10-15',months:3,shares:[{userId:a,amount:290000},{userId:b,amount:140000}]};
test('quarterly payment remains distinct from calendar-month member costs',()=>{
 const p=scheduledCostPlan(rule,'2026-10-15',a),v=calculateCostPlan(p);
 assert.equal(p.coverageEnd,'2027-01-15');assert.equal(v.total,1290000);
 assert.deepEqual(v.periods.map(p=>p.start),['2026-10-01','2026-11-01','2026-12-01']);
 assert.ok(v.periods.every(p=>p.shares.find(s=>s.userId===a)!.amount===290000&&p.shares.find(s=>s.userId===b)!.amount===140000));
});
test('month end anchor survives short months',()=>{
 const p=scheduledCostPlan({...rule,firstDate:'2027-01-31',months:1},'2027-02-28',a);
 assert.equal(p.coverageEnd,'2027-03-31');
});
test('reject duplicate participants, invalid dates and excessive totals',()=>{
 assert.throws(()=>scheduledCostPlan({...rule,shares:[rule.shares[0],rule.shares[0]]},rule.firstDate,a));
 assert.throws(()=>scheduledCostPlan({...rule,firstDate:'2026-02-30'},rule.firstDate,a));
 assert.throws(()=>scheduledCostPlan({...rule,shares:[{userId:a,amount:100000000000}]},rule.firstDate,a));
});
