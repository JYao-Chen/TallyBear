import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {helpArticles,helpKeywordScore,cosineSimilarity} from '../src/lib/help-manual';
import {HelpHighlight} from '../src/components/HelpPage';

test('manual chapters have bilingual steps and matching desktop/mobile screenshots',()=>{
 const zh=helpArticles('zh-CN'),en=helpArticles('en');assert.equal(zh.length,15);assert.deepEqual(zh.map(a=>a.id),en.map(a=>a.id));
 for(const [language,articles] of [['zh',zh],['en',en]] as const)for(const a of articles){assert.ok(a.steps.length>=4);if(language==='en')assert.doesNotMatch([a.title,a.intro,...a.steps,...a.notes].join(' '),/[\u3400-\u9fff]/);for(const device of ['desktop','mobile'])assert.ok(existsSync(`docs/screenshots/v2/${language}-${device}-${a.image}.webp`));}
});
test('keyword ranking finds refund chapter and marks literal text safely',()=>{
 const ranked=helpArticles('zh-CN').sort((a,b)=>helpKeywordScore(b,'退款')-helpKeywordScore(a,'退款'));assert.equal(ranked[0].id,'refund');
 assert.ok(helpKeywordScore(ranked[0],'退款怎么记')>0);
 const html=renderToStaticMarkup(createElement(HelpHighlight,{text:'退款 <script> 退款 (Plus)',query:'退款 (Plus)'}));assert.match(html,/<mark>退款<\/mark>/);assert.match(html,/<mark>\(Plus\)<\/mark>/);assert.ok(html.includes('&lt;script&gt;'));
});
test('cosine matching excludes different dimensions and invalid zero vectors',()=>{
 assert.equal(cosineSimilarity([1,0],[1,0]),1);assert.equal(cosineSimilarity([1,0],[0,1]),0);assert.equal(cosineSimilarity([1,0],[1]),0);assert.equal(cosineSimilarity([0,0],[1,1]),0);
});
