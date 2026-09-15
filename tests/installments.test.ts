import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installmentSchedule,remainingPrincipal,dueProgress} from '../src/lib/installments';
import {periodShare} from '../src/lib/period';
test('principal and fee pennies conserved, anchored month ends',()=>{const rows=installmentSchedule(10001,3,'2026-01-31',101);assert.deepEqual(rows.map(r=>r.date),['2026-01-31','2026-02-28','2026-03-31']);assert.equal(rows.reduce((n,r)=>n+r.principal,0),10001);assert.equal(rows.reduce((n,r)=>n+r.fee,0),101);});
test('partial and early repayments apply principal once, cost allocation unchanged',()=>{const rows=installmentSchedule(600000,12,'2026-09-15');assert.equal(dueProgress(rows,25000)[0].remaining,25000);assert.equal(remainingPrincipal(600000,50000,10000),540000);assert.equal(remainingPrincipal(600000,590000,10000),0);assert.equal(periodShare(600000,'2026-09-01','month',24,'2026-09'),25000);assert.ok(dueProgress(rows,600000).every(r=>r.remaining===0));});
