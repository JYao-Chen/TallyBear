import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {allocations} from '../src/server/allocations';
import {periodLastDay,periodShare} from '../src/lib/period';
const id='11111111-1111-4111-8111-111111111111';
function connection(version=3){const inserts:unknown[][]=[];const client={query:async(sql:string,args:unknown[])=>{if(sql.startsWith('SELECT version'))return {rows:[{version,kind:'expense'}]};if(sql.startsWith('INSERT INTO expense_allocations'))inserts.push(args);return {rows:[]};}} as unknown as PoolClient;return {client,inserts};}
test('saving an inclusive range retains exact dates and stores the existing daily allocation format',async()=>{
 const {client,inserts}=connection();await allocations('book','PUT',{id,version:3,startDate:'2026-10-23',endDate:'2027-10-29'},new URLSearchParams(),client);
 assert.equal(inserts.length,1);const [,month,months,start,unit,count]=inserts[0] as [string,string,number,string,'day',number];
 assert.equal(month,'2026-10-01');assert.equal(months,1);assert.equal(start,'2026-10-23');assert.equal(unit,'day');assert.equal(count,372);assert.equal(periodLastDay(start,unit,count),'2027-10-29');assert.equal(periodShare(37200,start,unit,count,'2026-10'),900);
});
test('invalid ranges and stale records never write allocation changes',async()=>{
 for(const body of [{startDate:'2026-10-23',endDate:'2026-10-22'},{startDate:'2026-02-30',endDate:'2027-01-01'},{startDate:'2026-10-23',endDate:'2027-10-29',version:2}]){
  const {client,inserts}=connection();await assert.rejects(allocations('book','PUT',{id,version:3,...body},new URLSearchParams(),client));assert.equal(inserts.length,0);
 }
});
test('existing equal monthly allocations and cancellation keep their original protocol',async()=>{
 const {client,inserts}=connection();await allocations('book','PUT',{id,version:3,startDate:'2026-10-01',periodUnit:'month',periodCount:12},new URLSearchParams(),client);assert.deepEqual(inserts[0],[id,'2026-10-01',12,'2026-10-01','month',12]);
 await allocations('book','PUT',{id,version:3,remove:true},new URLSearchParams(),client);assert.equal(inserts.length,1);
});
