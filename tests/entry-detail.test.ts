import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveEntryDetail} from '../src/lib/entry-detail';
import type {LedgerRow} from '../src/lib/ledger-types';
const row={id:'entry',book_id:'source-book',amount:100,version:1,title:'统计投影'} as LedgerRow;
test('all entry points resolve the current original amount, fields and mutation version',async()=>{
 const result=await resolveEntryDetail(row,'current-book',async(book,id)=>{
  assert.equal(book,'source-book');assert.equal(id,'entry');
  return [{...row,amount:5000,version:4,title:'完整账单',note:'原始备注'}];
 });
 assert.equal(result.amount,5000);assert.equal(result.version,4);assert.equal(result.title,'完整账单');assert.equal(result.note,'原始备注');
});
test('missing source fails instead of editing a stale report row',async()=>{
 await assert.rejects(resolveEntryDetail(row,'book',async()=>[]),/记录不存在或已删除/);
});
test('movements and allocated cost summaries retain their own source operations',async()=>{
 for(const special of [{...row,family_movement_id:'movement'},{...row,cost_row_key:'legacy:event:month'}]){
  assert.equal(await resolveEntryDetail(special,'book',async()=>{throw Error('invalid transaction lookup');}),special);
 }
});
