import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountLabel} from '../src/lib/accounts';
test('wallet labels show institution and suffix without repetitive owner/type prefixes',()=>{
 assert.equal(accountLabel({name:'微信',type:'wechat',owner_name:'布布',ownership:'personal'},'zh-CN'),'微信');
 assert.equal(accountLabel({name:'银行卡',institution:'中国银行',suffix:'1931',type:'bank',holder:'布布',owner_name:'布布'},'zh-CN'),'中国银行 · 尾号1931');
 assert.equal(accountLabel({name:'工资卡',institution:'工商银行',suffix:'9939',type:'bank'},'zh-CN'),'工资卡 · 工商银行 · 尾号9939');
 assert.equal(accountLabel({name:'Daily',institution:'HSBC',suffix:'1234',ownership:'personal'},'en'),'Daily · HSBC · ending 1234');
});
