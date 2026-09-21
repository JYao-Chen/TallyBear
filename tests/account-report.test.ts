import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectPersonalAssets} from '../src/server/accounts';

test('asset reports include only wallets owned by the current user',()=>{
 const current='user-a';
 const accounts=[
  {id:'personal',owner_id:current,family_id:null},
  {id:'family',owner_id:null,family_id:'family-a'},
  {id:'other-person',owner_id:'user-b',family_id:null}
 ];
 assert.deepEqual(selectPersonalAssets(accounts,current).map(a=>a.id),['personal']);
});
