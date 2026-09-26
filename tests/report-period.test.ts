import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodRange} from '../src/lib/report-period';
test('月份包含闰年二月末',()=>assert.deepEqual(periodRange('month','2024-02-15'),{from:'2024-02-01',to:'2024-02-29'}));
test('周一到周日可以跨年',()=>assert.deepEqual(periodRange('week','2026-01-01'),{from:'2025-12-29',to:'2026-01-04'}));
test('星期日属于前一个周一开始的周',()=>assert.deepEqual(periodRange('week','2026-01-04'),{from:'2025-12-29',to:'2026-01-04'}));
test('完整年份和指定日',()=>{assert.deepEqual(periodRange('year','2026-09-26'),{from:'2026-01-01',to:'2026-12-31'});assert.deepEqual(periodRange('day','2026-09-26'),{from:'2026-09-26',to:'2026-09-26'});});
test('拒绝不存在日期和相对时间',()=>{assert.throws(()=>periodRange('day','2026-02-30'));assert.throws(()=>periodRange('week','上周'));});
