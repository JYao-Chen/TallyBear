export type ThinkingBlock={id:string;label:string;text:string;status:'running'|'complete'|'stopped'};
export type ThinkingEvent={id:string;label:string;delta?:string;status:ThinkingBlock['status']};
export function updateThinking(blocks:ThinkingBlock[]=[],event:ThinkingEvent):ThinkingBlock[]{const existing=blocks.find(b=>b.id===event.id);const next={id:event.id,label:event.label,text:(existing?.text||'')+(event.delta||''),status:event.status};return existing?blocks.map(b=>b.id===event.id?next:b):[...blocks,next];}
