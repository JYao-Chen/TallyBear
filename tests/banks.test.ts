import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {banks,bankLogo} from '../src/lib/banks';
test('bank names and aliases resolve without overlapping bank codes',()=>{assert.equal(bankLogo('工资卡 · 中国工商银行 · 尾号1234'),'icbc');assert.equal(bankLogo('招行信用卡'),'cmb');assert.equal(bankLogo('CMBC'),'cmbc');assert.equal(bankLogo('CMB'),'cmb');assert.equal(bankLogo('未知银行'),undefined);assert.equal(bankLogo('微信'),undefined);for(const bank of banks){assert.equal(bankLogo(bank.name),bank.id);assert.match(readFileSync(`public/brands/banks/${bank.id}.svg`,'utf8'),/<svg/);}});
