import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {helpArticles,helpKeywordScore,cosineSimilarity} from '../src/lib/help-manual';
import {HelpHighlight} from '../src/components/HelpPage';

test('manual chapters have bilingual steps and matching desktop/mobile screenshots',()=>{
 const zh=helpArticles('zh-CN'),en=helpArticles('en');assert.equal(zh.length,18);assert.equal(zh[0].id,'intro');assert.deepEqual(zh.map(a=>a.id),en.map(a=>a.id));
 assert.equal(new Set(zh.map(a=>a.group)).size,4);
 for(const [language,articles] of [['zh',zh],['en',en]] as const)for(const a of articles){
  assert.ok(a.sections.length>=2,a.id);assert.equal(new Set(a.sections.map(s=>s.id)).size,a.sections.length);
  if(language==='en')assert.doesNotMatch(JSON.stringify(a),/[\u3400-\u9fff]/);
  for(const f of a.sections.flatMap(s=>s.figures))for(const device of ['desktop','mobile'])assert.ok(existsSync(`docs/screenshots/v2/${language}-${device}-${f.key}.webp`),`${language}/${device}/${f.key}`);
 }
 assert.equal(zh.find(a=>a.id==='refund')!.image,'refund');assert.equal(en.find(a=>a.id==='record')!.image,'manual');
 assert.ok(zh[0].intro.includes('2.0'));assert.match(en.find(a=>a.id==='wallets')!.notes.join(' '),/principal/);
 const actions=zh.flatMap(a=>a.sections.flatMap(s=>[s.action,...s.steps.map(p=>p.action)]).filter(Boolean));assert.ok(actions.length>=20);assert.ok(actions.some(a=>a!.target==='profile:memory'));
});
test('keyword ranking finds refund chapter and marks literal text safely',()=>{
 const ranked=helpArticles('zh-CN').sort((a,b)=>helpKeywordScore(b,'退款')-helpKeywordScore(a,'退款'));assert.equal(ranked[0].id,'refund');
 assert.ok(helpKeywordScore(ranked[0],'退款怎么记')>0);
 const html=renderToStaticMarkup(createElement(HelpHighlight,{text:'退款 <script> 退款 (Plus)',query:'退款 (Plus)'}));assert.match(html,/<mark>退款<\/mark>/);assert.match(html,/<mark>\(Plus\)<\/mark>/);assert.ok(html.includes('&lt;script&gt;'));
});
test('cosine matching excludes different dimensions and invalid zero vectors',()=>{
 assert.equal(cosineSimilarity([1,0],[1,0]),1);assert.equal(cosineSimilarity([1,0],[0,1]),0);assert.equal(cosineSimilarity([1,0],[1]),0);assert.equal(cosineSimilarity([0,0],[1,1]),0);
});
