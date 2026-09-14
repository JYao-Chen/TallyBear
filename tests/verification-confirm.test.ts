import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkVerification} from '../src/lib/verification';
test('unbalanced or missing item totals require a reason while transactions without items remain valid',()=>{const row={name:'餐费',quantity:1,unitPrice:100,amount:100};assert.doesNotThrow(()=>checkVerification([],500,''));assert.doesNotThrow(()=>checkVerification([row],100,''));assert.throws(()=>checkVerification([row],101,''));assert.throws(()=>checkVerification([{...row,amount:null}],100,''));assert.doesNotThrow(()=>checkVerification([row],101,'收据漏了包装费'));});
