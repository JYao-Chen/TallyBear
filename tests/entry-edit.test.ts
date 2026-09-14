import test from 'node:test';
import assert from 'node:assert/strict';
import {entry} from '../src/server/model';

const expense={id:'00000000-0000-4000-8000-000000000001',accountId:'00000000-0000-4000-8000-000000000002',kind:'expense',amount:5800,date:'2026-09-10',category:'餐饮'};

test('editing a saved expense accepts a null external ID and keeps the new category',()=>{
 const saved=entry.parse(expense);
 // PostgreSQL stores an absent external ID as NULL; the edit form resubmits that record.
 const updated=entry.parse({...saved,externalId:null,category:'购物'});
 assert.equal(updated.category,'购物');
 assert.equal(updated.externalId,undefined);
 assert.equal(updated.amount,5800);
});

test('editing preserves a real external ID and validates its type and length',()=>{
 assert.equal(entry.parse({...expense,externalId:'PAY-123'}).externalId,'PAY-123');
 assert.equal(entry.safeParse({...expense,externalId:123}).success,false);
 assert.equal(entry.safeParse({...expense,externalId:'x'.repeat(201)}).success,false);
});
