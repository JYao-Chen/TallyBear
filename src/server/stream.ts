export {readEvents} from '../lib/events';
export function streamAnswer(run:(onDelta:(text:string)=>void,signal:AbortSignal)=>Promise<unknown>,requestSignal:AbortSignal){
 const abort=new AbortController(),encoder=new TextEncoder();let closed=false;
 const onAbort=()=>abort.abort();requestSignal.addEventListener('abort',onAbort,{once:true});if(requestSignal.aborted)onAbort();
 const body=new ReadableStream<Uint8Array>({async start(controller){
  const send=(event:string,data:unknown)=>{if(!closed)controller.enqueue(encoder.encode(`data: ${JSON.stringify({event,data})}\n\n`));};
  try{send('status','正在连接模型…');const result=await run(text=>send('delta',text),abort.signal);if(!abort.signal.aborted)send('complete',result);}catch(e){if(!abort.signal.aborted)send('error',e instanceof Error?(e.name==='ZodError'?'识别信息不完整，请补充后重试':e.message):'识别未完成，请重试');}finally{requestSignal.removeEventListener('abort',onAbort);if(!closed){closed=true;controller.close();}}},cancel(){closed=true;abort.abort();requestSignal.removeEventListener('abort',onAbort);}});
 return new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
}
