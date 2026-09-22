import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectFamilyAssets,selectPersonalAssets} from '../src/server/accounts';

test('asset reports include only wallets owned by the current user',()=>{
 const current='user-a';
 const accounts=[
  {id:'personal',owner_id:current,family_id:null},
  {id:'family',owner_id:null,family_id:'family-a'},
  {id:'other-person',owner_id:'user-b',family_id:null}
 ];
 assert.deepEqual(selectPersonalAssets(accounts,current).map(a=>a.id),['personal']);
});

test('family asset reports include only the selected family shared wallets',()=>{
 const accounts=[
  {id:'personal',owner_id:'user-a',family_id:null},
  {id:'family-a',owner_id:null,family_id:'family-a'},
  {id:'family-b',owner_id:null,family_id:'family-b'}
 ];
 assert.deepEqual(selectFamilyAssets(accounts,'family-a').map(a=>a.id),['family-a']);
});
