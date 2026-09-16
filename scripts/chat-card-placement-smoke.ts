import assert from 'node:assert/strict';
import {placeChatCards} from '../src/lib/chat-card-placement';
import type {ChatAction} from '../src/lib/chat-actions';
const card=(id:string,status='pending',title=id)=>({id,status,data:{title}} as ChatAction);
const original=card('bus'),saved=card('bus','confirmed'),newCard=card('income');
let placed=placeChatCards([{id:'first',artifacts:{actions:[original]}},{id:'second',artifacts:{actions:[saved]}},{id:'third',artifacts:{actions:[saved,newCard]}}]);
assert.equal(placed.get('first')?.[0],saved);assert.equal(placed.has('second'),false);assert.deepEqual(placed.get('third'),[newCard]);
placed=placeChatCards([{id:'first',artifacts:{actions:[saved]}},{id:'streaming',artifacts:{}}]);assert.deepEqual(placed.get('first'),[saved]);assert.equal(placed.has('streaming'),false);
console.log('PASS: stable original turn, latest card status, no duplicate inherited cards, streaming preserves placement');
