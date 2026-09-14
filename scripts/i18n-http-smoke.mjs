import assert from 'node:assert/strict';
const base=process.env.APP_ORIGIN,language=process.env.APP_LANGUAGE||'zh-CN',currency=process.env.APP_CURRENCY||'CNY';
for(const requested of ['en','zh-CN']){
 const response=await fetch(base,{headers:{'Accept-Language':requested,Cookie:'bubu_language='+requested}});
 assert.equal(response.status,200);const html=await response.text();
 assert.match(html,new RegExp('<html[^>]*lang="'+language+'"'));
 assert.match(html,new RegExp('data-currency="'+currency+'"'));
 assert.doesNotMatch(html,/class="language-switch"/);
}
const health=await fetch(base+'/api/health');assert.equal(health.status,200);
console.log('PASS: deployment locale/currency, ignored browser preferences and legacy cookies, no language switch, healthy API');
