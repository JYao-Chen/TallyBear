import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {encrypt} from '../src/server/ai';
import {recognize} from '../src/server/recognize';
test('nine images batch automatically and complementary orders merge without adding payment twice',async()=>{
 const originalQuery=db.query,originalFetch=globalThis.fetch,oldKey=process.env.ENCRYPTION_KEY;
 process.env.ENCRYPTION_KEY=Buffer.alloc(32,1).toString('base64');
 const account=randomUUID(),batches:number[]=[];let merges=0;
 const sample={kind:'expense',amount:1800,date:'2026-09-13',accountId:account,payee:'测试店',platform:'京东',orderId:'test',product:'咖啡豆',status:'paid',source:'原图1',lineItems:[{name:'咖啡豆',quantity:1,unitPrice:1800,amount:1800}]};
 try{
  (db as any).query=async(sql:string)=>({rows:sql.includes('ai_settings')?[{base_url:'https://fixture.invalid',vision_model:'vision',model:'text',encrypted_key:encrypt('test-key')}]:sql.includes('FROM accounts')?[{id:account,name:'微信'}]:[]});
  globalThis.fetch=async(_url,init)=>{
   const body=JSON.parse(String(init?.body));let output;
   if(body.model==='vision'){
    batches.push(body.messages[1].content.filter((c:any)=>c.type==='image_url').length);
    output={entries:batches.length===1?[sample,{...sample,kind:'refund',amount:500,status:'refund_pending'}]:[{...sample,source:'原图9',note:'另一张付款截图'},{...sample,orderId:'other',amount:0,date:'',accountId:'',status:'unknown',lineItems:[]}]};
   }else{
    merges++;const prompt=body.messages[1].content;const a=JSON.parse(prompt.split('候选A：')[1].split('\n候选B：')[0]);output={sameOrder:true,reason:'相同京东订单号及实付',entry:a};
   }
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]}));
  };
  const image='data:image/png;base64,'+readFileSync(new URL('./fixtures/itemized-receipt.png',import.meta.url)).toString('base64');
  const result=await recognize(randomUUID(),{images:Array(9).fill(image)});
  assert.deepEqual(batches,[6,4]);
  assert.equal(merges,1);
  assert.equal(result.entries.length,2,`duplicate paid order should merge while the unknown order remains: ${JSON.stringify(result.entries.map(entry=>({kind:entry.kind,orderId:entry.orderId,status:entry.status,amount:entry.amount,source:entry.source})))}`);
  assert.equal(result.entries[0].amount,1800);assert.ok(result.entries[0].source.includes('原图9'));assert.equal(result.ignored.length,1);assert.deepEqual(result.entries[1].missing,['金额','日期','账户']);
 }finally{db.query=originalQuery;globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.ENCRYPTION_KEY;else process.env.ENCRYPTION_KEY=oldKey;}
});
