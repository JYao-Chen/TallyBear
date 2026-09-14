import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readEvents} from '../src/lib/events';
import {streamAnswer} from '../src/server/stream';
import {partialMessage} from '../src/lib/assistant-client';
test('流式中文和事件跨任意字节分段仍完整解码',async()=>{
 const bytes=new TextEncoder().encode('data: {"text":"一二买菜"}\r\n\r\ndata: [DONE]\r\n\r\n');const values:string[]=[];
 await readEvents(new ReadableStream({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close();}}),d=>values.push(d));assert.deepEqual(values,['{"text":"一二买菜"}','[DONE]']);
});
test('中途输出与最终草稿分开，错误不会伪装成完成',async()=>{
 const response=streamAnswer(async delta=>{delta('第一段');delta('第二段');return {entries:[]};},new AbortController().signal);const events:{event:string;data:unknown}[]=[];await readEvents(response.body!,d=>events.push(JSON.parse(d)));assert.deepEqual(events.map(e=>e.event),['status','delta','delta','complete']);
 const failed=streamAnswer(async()=>{throw new Error('模型不可用');},new AbortController().signal);const errors:{event:string}[]=[];await readEvents(failed.body!,d=>errors.push(JSON.parse(d)));assert.deepEqual(errors.map(e=>e.event),['status','error']);
});
test('停止读取将取消上游模型调用',async()=>{
 let stopped=false;const response=streamAnswer(async(_,signal)=>new Promise(resolve=>{signal.addEventListener('abort',()=>{stopped=true;resolve({entries:[]});},{once:true});}),new AbortController().signal);await response.body!.cancel();assert.equal(stopped,true);
});
test('界面只呈现渐进中文说明，不展示未完成的JSON字段',()=>{assert.equal(partialMessage('{"message":"今天支出18元'), '今天支出18元');assert.equal(partialMessage('{"message":"第一行\\n第二行","entries":['),'第一行\n第二行');assert.equal(partialMessage('{"entries":['),'');});
