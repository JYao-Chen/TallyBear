import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deviceDateTime,withDeviceTime} from '../src/lib/entry-time';
test('capture device local wall time',()=>{assert.equal(deviceDateTime(new Date(2026,8,15,7,5)),'2026-09-15T07:05');});
test('receipt date and time take priority',()=>{assert.deepEqual(withDeviceTime({date:'2026-08-01',occurredAt:'12:30'},'2026-09-15T07:05'),{date:'2026-08-01',occurredAt:'12:30'});});
test('only missing fields use submission time, never processing time',()=>{assert.deepEqual(withDeviceTime({date:'2026-08-01',occurredAt:''},'2026-09-15T07:05'),{date:'2026-08-01',occurredAt:'07:05'});assert.deepEqual(withDeviceTime({date:'',occurredAt:''},'2026-09-15T07:05'),{date:'2026-09-15',occurredAt:'07:05'});});
test('older clients without device time do not invent it',()=>{assert.deepEqual(withDeviceTime({date:''},undefined),{date:''});});
