import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {db,transaction} from '../src/server/db';
import {createAccount} from '../src/server/accounts';
import {insertEntry} from '../src/server/ledger';
import {entry} from '../src/server/model';
import {memoryRoute,applyMemory} from '../src/server/memory';
import {runMemoryJob} from '../src/server/memory-worker';
import {ensureMemoryModels} from '../src/server/memory-models';
import {sceneSchema} from '../src/lib/entry-scene';
import {changeMemorySelection,resolveMemoryField} from '../src/lib/memory-fields';

assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_memory_test'),'Isolated database required');
assert.ok(process.env.DASHSCOPE_API_KEY,'Existing DashScope key required');
assert.ok(process.env.TEST_ARTIFACT_DIR,'Artifact directory required');
const user={id:randomUUID(),admin:true} as any;
const output:any={at:new Date().toISOString(),dataset:'five-synthetic-labeled-financial-memory-cases-v1',scope:'真实 API；合成非私人样本；非统计性准确率声明',cases:[]};
const write=(body:any)=>memoryRoute(user,'POST',new URLSearchParams(),body) as Promise<any>;
const products=[{name:'iCloud 200GB',category:'会员订阅'},{name:'ChatGPT Plus',category:'会员订阅'},{name:'维他 原味豆奶 250ml',category:'餐饮'},{name:'桂格 即食燕麦片 1kg',category:'购物'},{name:'伊利 纯牛奶 250ml',category:'购物'}];
const ids:string[]=[];
const base=(product:string)=>({kind:'expense' as const,product,payee:'',category:'其他',categorySource:'model' as const,title:'',scene:sceneSchema.parse({})});
async function test(name:string,fn:()=>Promise<any>){const started=Date.now();try{const result=await fn();output.cases.push({name,pass:true,elapsedMs:Date.now()-started,...result});console.log('PASS',name);}catch(e){output.cases.push({name,pass:false,error:(e as Error).message});console.log('FAIL',name,(e as Error).message);}}
try{
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'真实模型五案例','unused')",[user.id]);
 await ensureMemoryModels();
 output.models=(await db.query('SELECT role,model,base_url,dimensions,version FROM memory_models ORDER BY role')).rows;
 assert.ok(output.models.every((m:any)=>m.model===(m.role==='embedding'?'text-embedding-v4':'qwen3.8-flash')),'Do not silently test another model');
 const book=randomUUID();await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'五案例隔离账本','private',$2)",[book,user.id]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user.id]);const account=(await createAccount(user.id,{name:'测试钱包',type:'cash',opening:0})).id;
 output.extracted=[];
 for(let i=0;i<products.length;i++){
  const p=products[i],t=entry.parse({id:randomUUID(),accountId:account,kind:'expense',amount:500+i,date:'2026-09-20',title:p.name,product:p.name,payee:i>1?'生活超市':'',category:p.category});await transaction(c=>insertEntry(c,book,user.id,t));
  await runMemoryJob(user.id,{operation:'source',sourceType:'transaction',sourceId:t.id},{});
  const learned=(await db.query('SELECT m.* FROM memories m JOIN memory_sources s ON s.memory_id=m.id WHERE s.source_id=$1',[t.id])).rows[0];assert.ok(learned);ids.push(learned.id);output.extracted.push(learned.attributes);
 }
 await runMemoryJob(user.id,{operation:'rebuild'},{});
 await test('1 同义名称：苹果云空间 200GB → iCloud 200GB',async()=>{const r=await applyMemory(user.id,base('苹果云空间 200GB'));assert.equal(r.memorySuggestions?.filter(s=>s.status==='matched')[0]?.id,ids[0]);assert.equal(r.category,'会员订阅');return {suggestions:r.memorySuggestions};});
 await test('2 不同规格：ChatGPT Pro 不关联 Plus',async()=>{const r=await applyMemory(user.id,base('ChatGPT Pro'));assert.equal(r.memorySuggestions?.filter(s=>s.status==='matched').length,0);return {suggestions:r.memorySuggestions};});
 await test('3 同款新价格：填充商家分类，保留支付事实，撤回不覆盖手改',async()=>{const input={...base(products[2].name),amount:220,date:'2026-09-26',orderId:'TEST-NEW-003',quantity:2};const r=await applyMemory(user.id,input);assert.equal(r.memorySuggestions?.find(s=>s.status==='matched')?.id,ids[2]);for(const k of ['amount','date','orderId','quantity'] as const)assert.equal(r[k],input[k]);assert.equal(r.payee,'生活超市');const reverted=changeMemorySelection({...r,payee:'我手动修改的商家'},r.memorySuggestions!,[]);assert.equal(reverted.value.payee,'我手动修改的商家');return {suggestions:r.memorySuggestions,paymentFactsUnchanged:true};});
 await test('4 多商品：明细 ID 分开关联，不继承旧数量及价格',async()=>{const items=products.slice(3).map((p,i)=>({id:randomUUID(),name:p.name,amount:100+i,quantity:i+1,unitPrice:null}));const input={...base('燕麦和牛奶'),lineItems:items,amount:201};const r=await applyMemory(user.id,input);const matched=r.memorySuggestions!.filter(s=>s.status==='matched');assert.equal(matched.length,2);assert.ok(matched.some(s=>s.id===ids[3]&&s.itemId===items[0].id));assert.ok(matched.some(s=>s.id===ids[4]&&s.itemId===items[1].id));assert.deepEqual(r.lineItems,items);return {suggestions:r.memorySuggestions};});
 await test('5 偏好冲突：待确认、明确替代；本次分类优先',async()=>{const attrs={scope:'product',match:products[2].name,category:'餐饮'};await write({operation:'save',kind:'preference',title:'豆奶分类餐饮',attributes:attrs});const pending=await write({operation:'save',kind:'preference',title:'豆奶分类购物',attributes:{...attrs,category:'购物'}});assert.equal(pending.pending,true);const m=(await db.query('SELECT * FROM memories WHERE id=$1',[pending.id])).rows[0];await write({operation:'save',id:m.id,version:m.version,kind:'preference',title:m.title,attributes:m.attributes,replaceConflicts:true});const r=await applyMemory(user.id,{...base(products[2].name),category:'餐饮',categorySource:'explicit'});assert.equal(r.category,'餐饮');const conflict=r.memorySuggestions!.find(s=>s.fieldChanges.some(c=>c.field==='category'&&c.state==='conflict'));assert.ok(conflict);const resolved=resolveMemoryField(r,r.memorySuggestions!,conflict.id,conflict.itemId,'category',true);assert.equal(resolved.value.category,'购物');return {pendingCreated:true,suggestions:r.memorySuggestions};});
 output.passed=output.cases.filter((c:any)=>c.pass).length;output.total=5;
 await mkdir(process.env.TEST_ARTIFACT_DIR!,{recursive:true});await writeFile(process.env.TEST_ARTIFACT_DIR+'/live-five.json',JSON.stringify(output,null,2));
 assert.equal(output.passed,5,'Not all live acceptance cases passed');
}finally{await db.end();}
