import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/server/db';
import {callModel,encrypt,withModelScope} from '../src/server/ai';

test('assistant scope uses its own text and vision models for every nested call',async()=>{
 const originalQuery=db.query,originalFetch=globalThis.fetch,oldKey=process.env.ENCRYPTION_KEY;
 process.env.ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 const models:string[]=[],bodies:any[]=[];
 try{
  (db as any).query=async(sql:string)=>({rows:[{base_url:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:sql.includes('assistant_ai_settings')?'assistant-text':'recognition-text',vision_model:sql.includes('assistant_ai_settings')?'qwen3.8-max':'recognition-vision',encrypted_key:encrypt('fixture')}]});
  globalThis.fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));bodies.push(body);models.push(body.model);return new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}]}));};
  await callModel('recognition');
  await withModelScope('assistant',async()=>{await callModel('assistant text');await callModel('assistant image','data:image/png;base64,AA==');});
  await callModel('recognition image','data:image/png;base64,AA==');
  assert.deepEqual(models,['recognition-text','assistant-text','qwen3.8-max','recognition-vision']);
  assert.equal(bodies[0].reasoning_effort,undefined);assert.equal(bodies[2].reasoning_effort,'low');assert.equal(bodies[3].reasoning_effort,undefined);
 }finally{db.query=originalQuery;globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.ENCRYPTION_KEY;else process.env.ENCRYPTION_KEY=oldKey;}
});
