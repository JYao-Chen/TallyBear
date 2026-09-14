import {test} from 'node:test';import assert from 'node:assert/strict';import {appendDraftBatch} from '../src/lib/draft-batch';import type {Draft} from '../src/components/DraftReview';
const old:Draft={id:'first',kind:'expense',amount:100,date:'2026-09-13',payee:'咖啡店',category:'已手动分类',note:'用户修改',accountId:'account'};
test('重复识别不覆盖用户草稿，新增项建议跳过',()=>{const result=appendDraftBatch([old],[{...old,id:'second',category:'模型分类',note:''}]);assert.equal(result[0],old);assert.equal(result[1].action,'skip');assert.equal(result[1].matches?.[0].record.id,'first');});
test('追加新消费并重连重复消费对应的退款',()=>{const result=appendDraftBatch([old],[{...old,id:'copy'},{...old,id:'refund',kind:'refund',amount:50,refundOf:'copy'},{...old,id:'new',amount:200}]);assert.equal(result.length,4);assert.equal(result[2].refundOf,'first');assert.equal(result[3].amount,200);});
test('空输出和同ID结果不清空或复制已有草稿',()=>{assert.deepEqual(appendDraftBatch([old],[]),[old]);assert.deepEqual(appendDraftBatch([old],[old]),[old]);});

test('补充已有记录时退款关联实际账目而非补充草稿',()=>{const result=appendDraftBatch([{...old,action:'merge',mergeId:'stored'}],[{...old,id:'copy'},{...old,id:'refund',kind:'refund',refundOf:'copy'}]);assert.equal(result[2].refundOf,'stored');});
