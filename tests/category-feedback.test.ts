import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordCategoryFeedback} from '../src/server/receipt-preferences';

function client(){const calls:{sql:string;params:unknown[]}[]=[];return {calls,value:{query:async(sql:string,params:unknown[])=>{calls.push({sql,params});return {rows:[],rowCount:1};}} as any};}

test('manual, model-confirmed and corrected categories persist distinct learning strength',async()=>{
 const manual=client();await recordCategoryFeedback(manual.value,'book','user',{id:'manual',category:'餐饮'});assert.equal(manual.calls[0].params[6],'manual');assert.equal(manual.calls[0].params[7],false);
 const model=client();await recordCategoryFeedback(model.value,'book','user',{id:'model',category:'购物',categorySource:'model'});assert.equal(model.calls[0].params[6],'confirmed');assert.equal(model.calls[0].params[7],false);
 const corrected=client();await recordCategoryFeedback(corrected.value,'book','user',{id:'corrected',category:'宠物'},'购物');assert.equal(corrected.calls[0].params[3],'购物');assert.equal(corrected.calls[0].params[5],'宠物');assert.equal(corrected.calls[0].params[7],true);
});
