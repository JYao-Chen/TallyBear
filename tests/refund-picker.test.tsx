import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {LanguageProvider} from '../src/components/LanguageProvider';
import {RefundPicker} from '../src/components/RefundPicker';

test('refund entry shows a visible, labeled order search in Chinese and English',()=>{
 for(const [locale,label] of [['zh-CN','关联原消费 · 搜索已入账订单'],['en','Link original purchase · search posted orders']] as const){
  const html=renderToStaticMarkup(<LanguageProvider initial={locale}><RefundPicker book="book" value="" onChange={()=>{}}/></LanguageProvider>);
  assert.ok(html.includes(label));
  assert.match(html,/type="button"/);
 }
});
