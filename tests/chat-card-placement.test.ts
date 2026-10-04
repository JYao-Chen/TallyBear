import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeChatCards} from '../src/lib/chat-card-placement';
import type {ChatAction} from '../src/lib/chat-actions';
test('改变卡片类型也显示在修订轮次，确认状态仍反映在同一张卡片',()=>{
 const a:ChatAction={id:'a',kind:'entry',bookId:'b',title:'entry',status:'pending',data:{amount:10},missing:[],warnings:[],summary:[]};
 const revised={...a,kind:'budget' as const},saved={...revised,status:'confirmed' as const};
 const placed=placeChatCards([{id:'first',artifacts:{actions:[a]}},{id:'revision',artifacts:{actions:[revised]}},{id:'saved',artifacts:{actions:[saved]}}]);
 assert.equal(placed.size,1);assert.equal(placed.get('revision')?.[0].status,'confirmed');
});
test('edited card moves to revision while unchanged snapshots do not duplicate it',()=>{
 const a:ChatAction={id:'a',kind:'entry',bookId:'b',title:'entry',status:'pending',data:{amount:10},missing:[],warnings:[],summary:[]};
 const updated={...a,data:{amount:20}};
 const placed=placeChatCards([{id:'first',artifacts:{actions:[a]}},{id:'edit',artifacts:{actions:[updated]}},{id:'followup',artifacts:{actions:[updated]}}]);
 assert.equal(placed.has('first'),false);assert.equal(placed.has('followup'),false);assert.deepEqual(placed.get('edit'),[updated]);
});
test('cancellation is reflected at original card without another actionable copy',()=>{
 const a:ChatAction={id:'a',kind:'entry',bookId:'b',title:'entry',status:'pending',data:{},missing:[],warnings:[],summary:[]};
 const placed=placeChatCards([{id:'first',artifacts:{actions:[a]}},{id:'merge',artifacts:{actions:[{...a,status:'cancelled'}]}}]);
 assert.equal(placed.get('first')?.[0].status,'cancelled');assert.equal(placed.size,1);
});
