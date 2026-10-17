'use client';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {Avatar} from './ManagementPages';
import {MessageCircle,Reply,X} from 'lucide-react';
import {useI18n} from './LanguageProvider';
import type {DiscussionMessage,DiscussionTarget} from '@/lib/discussions';

export async function discussionRequest(path:string,body?:unknown,signal?:AbortSignal){
 const r=await fetch('/api/discussions'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal});
 const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error||'Request failed'),{status:r.status});return d;
}
export function Discussion({target,hideUnavailable=false}:{target:DiscussionTarget;hideUnavailable?:boolean}){
 const {locale}=useI18n(),en=locale==='en',l=(zh:string,english:string)=>en?english:zh;
 const inputId=useId(),[data,setData]=useState<any>(null),[error,setError]=useState(''),[unavailable,setUnavailable]=useState(false),[text,setText]=useState(''),[reply,setReply]=useState<DiscussionMessage|null>(null),[busy,setBusy]=useState(false),[offset,setOffset]=useState(0),[loading,setLoading]=useState(true);
 const requestId=useRef(''),section=useRef<HTMLElement>(null),lastMarked=useRef('');
 const {kind,id,scope=''}=target;
 const markRead=useCallback(async(d:any,signal?:AbortSignal)=>{
  const rect=section.current?.getBoundingClientRect(),seq=d.rows.at(-1)?.seq;
  if(offset||!seq||seq===lastMarked.current||document.visibilityState!=='visible'||!rect||rect.bottom<=0||rect.top>=innerHeight)return;
  await discussionRequest('/read',{target:{kind,id,scope},upTo:seq},signal);lastMarked.current=seq;window.dispatchEvent(new Event('discussions-changed'));
 },[kind,id,scope,offset]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const d=await discussionRequest('?'+new URLSearchParams({kind,id,scope,offset:String(offset)}),undefined,signal);
  setData(d);setError('');setUnavailable(false);
  await markRead(d,signal);
 },[kind,id,scope,offset,markRead]);
 useEffect(()=>{if(!data||!section.current)return;const controller=new AbortController();const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void markRead(data,controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});});observer.observe(section.current);return()=>{controller.abort();observer.disconnect();};},[data,markRead]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setData(null);setError('');setUnavailable(false);
  load(controller.signal).catch(e=>{if(!controller.signal.aborted){if(e.status===404&&hideUnavailable)setUnavailable(true);else setError(e.message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[load,hideUnavailable]);
 useEffect(()=>{const controller=new AbortController();const refresh=()=>{if(document.visibilityState==='visible')void load(controller.signal).catch(e=>{if(!controller.signal.aborted){setData(null);setError(e.message);}});};
  const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[load]);
 async function send(){setBusy(true);setError('');requestId.current||=crypto.randomUUID();try{
  await discussionRequest('/messages',{target:{kind,id,scope},id:requestId.current,body:text,replyTo:reply?.id||null});
  setText('');setReply(null);requestId.current='';if(offset)setOffset(0);else await load();window.dispatchEvent(new Event('discussions-changed'));
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(unavailable)return null;
 return <section ref={section} className="discussion" aria-label={l('账目讨论','Account discussion')}>
  <div className="panel-title"><h3><MessageCircle size={19}/>{scope?l('本期讨论','Cycle discussion'):l('账目讨论','Discussion')}</h3><button type="button" className="text-button" disabled={loading||busy} onClick={()=>{setLoading(true);void load().catch(e=>setError(e.message)).finally(()=>setLoading(false));}}>{l('刷新','Refresh')}</button></div>
  {data&&<p className="muted discussion-audience">{kind==='movement'?l('仅转账双方可见','Visible only to the sender and recipient'):kind==='transaction'?l('本共享账本有权查看的成员可见','Visible to members with access to this shared book'):l('本项目参与成员可见','Visible to project participants')} · {data.people.map((p:any)=>p.name).join('、')}{scope&&<> · {scope}</>}</p>}
  {data?.context.note&&<div className="discussion-original"><strong>{l('转账留言','Transfer note')}</strong><p>{data.context.note}</p></div>}
  {loading&&<p role="status">{l('正在读取讨论…','Loading discussion…')}</p>}
  {!loading&&data&&!data.rows.length&&<p className="muted">{l('还没有留言，可以在这里核对用途、金额或分担。','No messages yet. Discuss the purpose, amount or allocation here.')}</p>}
  {data?.rows.map((m:DiscussionMessage)=><article className="discussion-message" key={m.id}>
   <div className="discussion-message-meta"><span className="discussion-person"><Avatar value={m.avatar} size={34}/><strong>{m.name}{m.user_id===data.userId?l('（我）',' (me)'):''}</strong></span><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div>
   {m.reply_to&&<blockquote><span className="discussion-person"><Avatar value={m.reply_avatar||undefined} size={24}/><strong>{m.reply_name}</strong></span><p>{m.reply_body}</p></blockquote>}
   <p className="discussion-body">{m.body}</p><button type="button" className="text-button" disabled={busy} aria-label={l('回复','Reply to')+' '+m.name} onClick={()=>{setReply(m);requestId.current='';document.getElementById(inputId)?.focus();}}><Reply size={15}/>{l('回复','Reply')}</button>
  </article>)}
  {data?.total>20&&<nav className="discussion-pagination" aria-label={l('讨论分页','Discussion pages')}><button type="button" className="secondary" disabled={loading||busy||offset+20>=data.total} onClick={()=>setOffset(v=>v+20)}>{l('更早留言','Older')}</button><span>{Math.max(1,data.total-offset-19)}–{data.total-offset} / {data.total}</span><button type="button" className="secondary" disabled={loading||busy||!offset} onClick={()=>setOffset(v=>Math.max(0,v-20))}>{l('更新留言','Newer')}</button></nav>}
  {error&&<p className="error" role="alert">{error}</p>}
  {data&&<form className="discussion-composer" onSubmit={e=>{e.preventDefault();void send();}}>
   {reply&&<div className="discussion-reply-preview"><span><Avatar value={reply.avatar} size={24}/>{l('回复','Reply to')} {reply.name}：{reply.body}</span><button type="button" className="text-button" disabled={busy} aria-label={l('取消回复','Cancel reply')} onClick={()=>{setReply(null);requestId.current='';}}><X size={17}/></button></div>}
   <label className="discussion-person" htmlFor={inputId}><Avatar value={data.people.find((p:any)=>p.id===data.userId)?.avatar} size={30}/>{l('留言给参与成员','Message participants')}</label><textarea id={inputId} rows={3} maxLength={2000} value={text} disabled={busy} onChange={e=>{setText(e.target.value);requestId.current='';}}/>
   <div className="discussion-compose-actions"><small className="muted">{l('留言不会确认收款或修改分摊。','Messages do not confirm receipts or change allocations.')}</small><button type="submit" disabled={busy||!text.trim()}>{busy?l('发送中…','Sending…'):l('发送留言','Send message')}</button></div>
  </form>}
 </section>;
}
