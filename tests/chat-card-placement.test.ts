import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeChatCards} from '../src/lib/chat-card-placement';
import type {ChatAction} from '../src/lib/chat-actions';
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
