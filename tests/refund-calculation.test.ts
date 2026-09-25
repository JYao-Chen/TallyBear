import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refundFromNet} from '../src/lib/refund-calculation';

test('net expense input calculates only the next refund after earlier partial refunds',()=>{
 assert.equal(refundFromNet(7000,2500),4500);
 assert.equal(refundFromNet(7000,0),7000);
 assert.equal(refundFromNet(7000,7000),null);
 assert.equal(refundFromNet(7000,-1),null);
 assert.equal(refundFromNet(7000,8000),null);
});
