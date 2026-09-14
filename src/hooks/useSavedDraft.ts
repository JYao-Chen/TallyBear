'use client';
import {useEffect,useRef,useState,type SetStateAction} from 'react';
type Session<T>={key:string;value:T;version:number;restoreKey:number;ready:boolean;reloading:boolean;dirty:boolean;seq:number;saving:boolean;error:string;disposed:boolean;timer?:ReturnType<typeof setTimeout>;pending?:Promise<void>;flush:()=>Promise<void>};
export function useSavedDraft<T>(book:string,user:string,section:'intake'|'images'|'manual',initial:T){
 const [,render]=useState(0),ref=useRef<Session<T>|null>(null),defaults=useRef(initial);const key=user+'/'+book+'/'+section;
 useEffect(()=>{if(!book||!user){ref.current=null;return;}const s:Session<T>={key,value:defaults.current,version:0,restoreKey:0,ready:false,reloading:false,dirty:false,seq:0,saving:false,error:'',disposed:false,flush:async()=>{}};ref.current=s;
 const notify=()=>{if(!s.disposed)render(n=>n+1);};
 s.flush=async()=>{if(s.pending)return s.pending;if(!s.ready||!s.dirty)return;s.pending=(async()=>{s.saving=true;s.error='';notify();try{while(s.dirty){const seq=s.seq,value=s.value;const response=await fetch('/api/books/'+book+'/drafts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({section,version:s.version,value})});const result=await response.json();if(!response.ok)throw new Error(result.error||'草稿未保存，请重试');s.version=result.version;if(seq===s.seq)s.dirty=false;}}catch(e){s.error=e instanceof Error?e.message:'草稿未保存';}finally{s.saving=false;notify();}})();try{await s.pending;}finally{s.pending=undefined;}};

 async function load(){try{const response=await fetch('/api/books/'+book+'/drafts?section='+section);const result=await response.json();if(!response.ok)throw new Error(result.error||'草稿读取失败');if(s.disposed)return;s.value=result.value??defaults.current;s.version=result.version;s.ready=true;}catch(e){s.error=(e as Error).message;}notify();}
 load();notify();const beforeUnload=(e:BeforeUnloadEvent)=>{if(s.dirty){s.flush();e.preventDefault();e.returnValue='';}};const hidden=()=>{if(document.visibilityState==='hidden')s.flush();};const online=()=>{if(!s.ready)load();else s.flush();};window.addEventListener('beforeunload',beforeUnload);document.addEventListener('visibilitychange',hidden);window.addEventListener('online',online);
 return()=>{clearTimeout(s.timer);s.flush();s.disposed=true;window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('online',online);};
 },[key,book,user,section]);
 const current=ref.current?.key===key?ref.current:null;
 function setValue(value:SetStateAction<T>){const s=ref.current;if(!s||s.key!==key||!s.ready)return;s.value=typeof value==='function'?(value as (old:T)=>T)(s.value):value;s.dirty=true;s.seq++;render(n=>n+1);clearTimeout(s.timer);s.timer=setTimeout(()=>s.flush(),600);}
 async function reload(){const s=ref.current;if(!s||s.key!==key||s.saving||s.reloading)return;clearTimeout(s.timer);const wasReady=s.ready;s.reloading=true;s.ready=false;render(n=>n+1);try{const r=await fetch('/api/books/'+book+'/drafts?section='+section);const data=await r.json();if(!r.ok)throw new Error(data.error);if(s.disposed)return;s.value=data.value??defaults.current;s.version=data.version;s.restoreKey++;s.ready=true;s.dirty=false;s.error='';}catch(e){s.ready=wasReady;s.error=(e as Error).message;}finally{s.reloading=false;if(!s.disposed)render(n=>n+1);}}

 return {restoreKey:current?.restoreKey||0,value:current?.ready?current.value:initial,setValue,ready:!!current?.ready,error:current?.error||'',saving:!!current?.saving,dirty:!!current?.dirty,flush:async()=>{await current?.flush();if(current?.dirty)throw new Error(current.error||'草稿尚未保存，请重试');},reload};
}
