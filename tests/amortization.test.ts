import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyShare,coverageEnd,monthIndex} from '../src/lib/amortization';
import {nextOccurrence} from '../src/lib/recurrence';
test('年付、多年、多月和一分钱分摊，所有月份合计严格等于原额',()=>{for(const total of [1,2,10000,19999,100000000000])for(const months of [1,3,12,18,36,1200]){const values=Array.from({length:months},(_,i)=>monthlyShare(total,months,i));assert.equal(values.reduce((a,b)=>a+b,0),total);assert.ok(Math.max(...values)-Math.min(...values)<=1);}assert.deepEqual([0,1,2].map(i=>monthlyShare(10000,3,i)),[3334,3333,3333]);});
test('跨年覆盖范围和首尾月份准确，不在覆盖期不计费',()=>{assert.equal(coverageEnd('2026-11',3),'2027-01');assert.equal(coverageEnd('2026-09',36),'2029-08');assert.equal(monthIndex('2027-01')-monthIndex('2026-11'),2);assert.equal(monthlyShare(100,3,-1),0);assert.equal(monthlyShare(100,3,3),0);assert.throws(()=>monthlyShare(100,0,0));});
test('季度、多年续费保留月末锚点',()=>{assert.equal(nextOccurrence('2026-11-30','monthly',31,3),'2027-02-28');assert.equal(nextOccurrence('2027-02-28','monthly',31,3),'2027-05-31');assert.equal(nextOccurrence('2024-02-29','yearly',29,36),'2027-02-28');});
