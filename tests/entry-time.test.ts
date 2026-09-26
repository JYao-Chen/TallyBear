import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deviceDateTime,withDeviceTime} from '../src/lib/entry-time';
import {entry} from '../src/server/model';
test('capture device local wall time',()=>{assert.equal(deviceDateTime(new Date(2026,8,15,7,5)),'2026-09-15T07:05');});
test('receipt date and time take priority',()=>{assert.deepEqual(withDeviceTime({date:'2026-08-01',occurredAt:'12:30'},'2026-09-15T07:05'),{date:'2026-08-01',occurredAt:'12:30'});});

test('only missing or invalid dates use submission date; unknown time stays blank',()=>{
 assert.deepEqual(withDeviceTime({date:'2026-08-01',occurredAt:''},'2026-09-15T07:05'),{date:'2026-08-01',occurredAt:''});
 for(const date of ['', '上周', '最近','2026-02-30'])assert.deepEqual(withDeviceTime({date,occurredAt:'最近'},'2026-09-15T07:05'),{date:'2026-09-15',occurredAt:''});
});
test('timestamp is split into time only, preserving actual precision',()=>{
 assert.equal(withDeviceTime({date:'',occurredAt:'2026-09-15T07:05:12'},'2026-09-15T09:30').occurredAt,'07:05:12');
 assert.equal(withDeviceTime({date:'',occurredAt:'7:05'},'2026-09-15T09:30').occurredAt,'07:05');
 for(const occurredAt of ['25:12','12:61','12:30:80','昨天上午','2026-09-15'])assert.equal(withDeviceTime({date:'',occurredAt},'2026-09-15T09:30').occurredAt,'');
});
test('missing device time still provides a valid recording date without invented time',()=>{
 const result=withDeviceTime({date:'',occurredAt:''},undefined);assert.match(result.date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(result.occurredAt,'');
});
test('saving accepts blank date and optional time, but never stores free-form time',()=>{
 const value={id:'00000000-0000-4000-8000-000000000001',accountId:'00000000-0000-4000-8000-000000000002',kind:'expense',amount:100,date:''};
 const result=entry.parse({...value,occurredAt:'上周'});
 assert.match(result.date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(result.occurredAt,'');
 assert.equal(entry.parse({...value,occurredAt:'12:34:56'}).occurredAt,'12:34:56');
 assert.equal(entry.parse({...value,occurredAt:'12:34'}).occurredAt,'12:34');
 assert.equal(entry.safeParse({...value,date:'2026-02-30'}).success,false);
});
