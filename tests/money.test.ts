import {test} from 'node:test';import assert from 'node:assert/strict';import {amountToCents,entry} from '../src/server/model';
test('金额精确转换为分',()=>{assert.equal(amountToCents('86.50'),8650);assert.equal(amountToCents('0.29'),29);assert.throws(()=>amountToCents('1.001'));});
test('转账必须使用不同账户',()=>{assert.equal(entry.safeParse({id:'00000000-0000-4000-8000-000000000001',accountId:'00000000-0000-4000-8000-000000000002',targetId:'00000000-0000-4000-8000-000000000002',kind:'transfer',amount:100,date:'2026-09-13'}).success,false);});
