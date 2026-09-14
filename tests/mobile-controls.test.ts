import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FormSelect} from '../src/components/FormSelect';
import {chartAmount,shortChartLabel} from '../src/lib/chart-labels';
const options=[h('option',{key:'private',value:'private'},'私人：仅自己可见'),h('option',{key:'shared',value:'shared'},'共享：授权成员可见')];
test('custom selector preserves native form value and does not submit on open',()=>{
 const html=renderToStaticMarkup(h(FormSelect,{name:'kind',defaultValue:'shared',children:options}));
 assert.match(html,/<select[^>]*name="kind"/);assert.match(html,/<option value="shared" selected=""/);assert.match(html,/<button[^>]*type="button"/);assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/class="select-form-value"/);
});
test('controlled selection wins over defaults; required and disabled reach form control',()=>{
 const html=renderToStaticMarkup(h(FormSelect,{name:'kind',value:'private',defaultValue:'shared',required:true,disabled:true,children:options}));
 assert.match(html,/<option value="private" selected=""/);assert.match(html,/<select[^>]*required=""[^>]*disabled=""/);assert.match(html,/<button[^>]*disabled=""/);
});
test('selector keeps first option as the default for membership forms',()=>{
 const html=renderToStaticMarkup(h(FormSelect,{name:'role',children:[h('option',{value:'editor',key:'editor'},'可记账'),h('option',{value:'viewer',key:'viewer'},'只读')]}));assert.match(html,/<option value="editor" selected=""/);
});
test('mobile axes shorten long labels and large amounts without changing data',()=>{assert.equal(shortChartLabel('2026-09-13'),'09-13');assert.equal(shortChartLabel('特别长的商家和商品名称'),'特别长的商家…');assert.equal(chartAmount(-12000),'-1.2万');assert.equal(chartAmount(120000000),'1.2亿');assert.equal(chartAmount(95),'95');});
