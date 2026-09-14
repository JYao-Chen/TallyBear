import {readEvents} from './events';
export function partialMessage(text:string){const match=text.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)/);if(!match)return '';try{return JSON.parse('"'+match[1]+'"') as string;}catch{return '';}}
export async function askAssistant(path:string,body:unknown,signal:AbortSignal,onProgress:(text:string,characters:number)=>void){
 const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body as object,stream:true}),signal});
 if(!response.ok){const data=await response.json();throw new Error(data.error||'连接未完成，请重试');}
 if(!response.body)throw new Error('连接未返回内容');let received='',result:unknown,complete=false;
 await readEvents(response.body,data=>{const event=JSON.parse(data);if(event.event==='status')onProgress(event.data,0);if(event.event==='delta'){received+=event.data;onProgress(partialMessage(received)||'正在整理订单与账目…',received.length);}if(event.event==='error')throw new Error(event.data);if(event.event==='complete'){result=event.data;complete=true;}});
 if(!complete)throw new Error('进度连接已中断，任务仍在后台；请到后台任务查看结果');return result as {message:string;entries:import('../components/DraftReview').Draft[]};
}
