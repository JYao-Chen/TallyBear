import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportFilter} from '../src/server/reports';
import {monthRange} from '../src/lib/ledger-types';
test('月份边界包含闰年二月最后一天',()=>{assert.deepEqual(monthRange('2024-02'),{from:'2024-02-01',to:'2024-02-29'});assert.equal(monthRange('2026-02').to,'2026-02-28');});
test('查账日期与页大小校验，关键词只作为查询参数',()=>{assert.throws(()=>reportFilter('book',new URLSearchParams({from:'2026-02-30',to:'2026-03-01'})));assert.throws(()=>reportFilter('book',new URLSearchParams({from:'2026-03-02',to:'2026-03-01'})));const query=reportFilter('book',new URLSearchParams({from:'2026-01-01',to:'2026-12-31',q:"O'Reilly",limit:'50'}));assert.ok(query.values.includes("O'Reilly"));assert.ok(!query.where.includes("O'Reilly"));});
