import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDeployment,formatMoney,currencySymbol,currencies} from '../src/lib/deployment';
import {translate} from '../src/lib/i18n';
test('deployment defaults and invalid settings',()=>{assert.deepEqual(parseDeployment({}),{language:'zh-CN',currency:'CNY'});assert.throws(()=>parseDeployment({APP_LANGUAGE:'fr'}));assert.throws(()=>parseDeployment({APP_CURRENCY:'JPY'}));});
test('all supported currencies preserve minor units and render correct symbols',()=>{for(const currency of currencies){const config=parseDeployment({APP_LANGUAGE:'en',APP_CURRENCY:currency});assert.match(formatMoney(12345,config),/123\.45/);assert.match(formatMoney(-1,config),/-.*0\.01/);assert.equal(currencySymbol(config),{CNY:'¥',USD:'$',EUR:'€',GBP:'£'}[currency]);}});
test('deployment currency updates known units without rewriting user content',()=>{assert.match(translate('实际总余额（元）','en',[],'USD'),/USD/);assert.equal(translate('我的人民币账本','en',[],'USD'),'我的人民币账本');});
