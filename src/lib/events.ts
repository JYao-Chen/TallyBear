/** Decode SSE across arbitrary network chunk boundaries (including UTF-8). */
export async function readEvents(body:ReadableStream<Uint8Array>,onData:(data:string)=>void){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
 const drain=(last=false)=>{buffer=buffer.replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data)onData(data);}if(last&&buffer.trim()){const data=buffer.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data)onData(data);buffer='';}};
 try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});drain();}buffer+=decoder.decode();drain(true);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
