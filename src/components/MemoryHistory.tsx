'use client';
import {useEffect,useState} from 'react';
import {History,ChevronLeft,ChevronRight,Undo2,Pencil,Trash2,GitMerge,Split,Share2,RefreshCw} from 'lucide-react';

type MemoryEvent={id:string;operation:string;title:string|null;kind:string|null;created_at:string;can_undo:boolean};
const operations:Record<string,{label:string;icon:typeof Pencil}>={save:{label:'编辑',icon:Pencil},status:{label:'变更状态',icon:RefreshCw},forget:{label:'遗忘',icon:Trash2},merge:{label:'合并商品',icon:GitMerge},split:{label:'拆分商品',icon:Split},share:{label:'共享',icon:Share2},undo:{label:'撤销',icon:Undo2}};
const kinds:Record<string,string>={product:'商品与服务',preference:'记账偏好',subscription:'订阅',activity:'活动',conversation:'对话记忆',todo:'待办',negative:'排除的关联'};
export function MemoryHistory(){
 const [page,setPage]=useState(1),[revision,setRevision]=useState(0),[data,setData]=useState<{items:MemoryEvent[];total:number}>({items:[],total:0}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');fetch('/api/memories?events&page='+page).then(async r=>{const value=await r.json();if(!r.ok)throw new Error(value.error||'记录加载失败');return value;}).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[page,revision]);
 async function undo(event:MemoryEvent){
  if(!confirm('撤销这次变更？将恢复这条记忆之前的内容，原账单不受影响。'))return;
  setBusy(true);setError('');setMessage('');
  try{const r=await fetch('/api/memories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'undo',eventId:event.id})});const result=await r.json();if(!r.ok)throw new Error(result.error||'撤销失败');setMessage('已撤销，记忆已恢复到此次变更前。');setRevision(v=>v+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="memory-history" aria-labelledby="memory-history-title" aria-busy={loading}>
  <header className="memory-history-heading"><div><h3 id="memory-history-title">变更记录</h3><p>追踪记忆的调整，不影响原始账单。</p></div><span className="memory-history-count">共 {data.total} 条记录</span></header>
  {error&&<div className="error" role="alert">{error}<button type="button" className="text-button" disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>刷新记录</button></div>}
  {message&&<p role="status" className="notice">{message}</p>}
  {loading?<div className="memory-history-empty" role="status"><History size={28} aria-hidden="true"/><p>正在加载变更记录…</p></div>:!data.items.length?<div className="memory-history-empty"><History size={32} aria-hidden="true"/><h4>还没有变更记录</h4><p>编辑、停用或共享记忆后，可在这里查看记录。</p></div>:<>
   <div className="memory-history-columns" aria-hidden="true"><span>操作与记忆</span><span>变更时间</span><span>操作状态</span></div>
   <ol className="memory-history-list">{data.items.map(event=>{const op=operations[event.operation]||{label:event.operation,icon:History};const Icon=op.icon;const date=new Date(event.created_at);return <li key={event.id} className="memory-history-row">
    <div className="memory-history-object"><span className={'memory-event-icon'+(event.operation==='forget'?' is-forgotten':'')}><Icon size={18} aria-hidden="true"/></span><div><span className="memory-event-label">{op.label}{event.kind&&<span> · {kinds[event.kind]||event.kind}</span>}</span><strong>{event.title||'已遗忘或不可访问的记忆'}</strong>{!event.title&&<small>不再展示记忆内容</small>}</div></div>
    <time dateTime={event.created_at}><span>{date.toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'})}</span><small>{date.toLocaleTimeString('zh-CN',{hour12:false})}</small></time>
    <div className="memory-event-action">{event.can_undo?<button type="button" className="secondary" disabled={busy||loading} onClick={()=>undo(event)}><Undo2 size={15} aria-hidden="true"/>撤销变更</button>:<span>{event.operation==='forget'?'已遗忘':event.operation==='undo'?'已撤销':['save','status'].includes(event.operation)?'不可撤销':'已完成'}</span>}</div>
   </li>;})}</ol>
  </>}
  <footer className="memory-history-pagination"><span>{data.total?`${(page-1)*20+1}–${Math.min(page*20,data.total)} / ${data.total} 条`:'0 条记录'}</span><nav aria-label="变更记录分页"><button type="button" className="secondary" aria-label="上一页记录" disabled={loading||busy||page===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/></button><span>{page} / {Math.max(1,Math.ceil(data.total/20))}</span><button type="button" className="secondary" aria-label="下一页记录" disabled={loading||busy||page*20>=data.total} onClick={()=>setPage(p=>p+1)}><ChevronRight size={18}/></button></nav></footer>
 </section>;
}
