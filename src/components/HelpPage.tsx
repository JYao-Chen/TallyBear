'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,ArrowLeft,ArrowRight} from 'lucide-react';
import {helpArticles,helpKeywordScore,helpTerms,type HelpArticle} from '@/lib/help-manual';
import {useI18n} from './LanguageProvider';

export function HelpHighlight({text,query}:{text:string;query:string}){
 const words=helpTerms(query).sort((a,b)=>b.length-a.length);if(!words.length)return <>{text}</>;
 const pattern=new RegExp('('+words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
 return <>{text.split(pattern).map((part,i)=>i%2?<mark key={i}>{part}</mark>:part)}</>;
}
type Result=HelpArticle&{snippet:string;match:string};
export function HelpPage(){
 const {locale}=useI18n();const en=locale==='en';const articles=useMemo(()=>helpArticles(locale),[locale]);
 const [query,setQuery]=useState(''),[section,setSection]=useState('start'),[reading,setReading]=useState(true),[results,setResults]=useState<Result[]>([]),[busy,setBusy]=useState(false),[mode,setMode]=useState('keyword'),[error,setError]=useState(false),[page,setPage]=useState(1);
 const content=useRef<HTMLDivElement>(null);
 useEffect(()=>{const id=sessionStorage.getItem('help-article');if(id&&articles.some(a=>a.id===id)){setSection(id);sessionStorage.removeItem('help-article');}fetch('/api/help').catch(()=>{});},[articles]);
 useEffect(()=>{
  if(!query.trim()){setResults([]);setBusy(false);return;}
  const controller=new AbortController();setBusy(true);setError(false);setPage(1);
  const local=articles.filter(a=>helpKeywordScore(a,query)>0).sort((a,b)=>helpKeywordScore(b,query)-helpKeywordScore(a,query)).map(a=>({...a,snippet:[a.intro,...a.steps,...a.notes].find(p=>helpTerms(query).some(w=>p.toLowerCase().includes(w)))||a.intro,match:'keyword'}));setResults(local);setMode('keyword');
  const timer=setTimeout(async()=>{try{const r=await fetch('/api/help?q='+encodeURIComponent(query),{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();setResults(data.items);setMode(data.mode);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setBusy(false);}},350);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,articles]);
 useEffect(()=>{if(reading&&query)content.current?.querySelector('mark')?.scrollIntoView({block:'center'});},[reading,section,query]);
 const article=articles.find(a=>a.id===section)||articles[0];const index=articles.indexOf(article);const prefix=en?'en':'zh';
 const open=(id:string)=>{setSection(id);setReading(true);};
 const highlight=(text:string)=><HelpHighlight text={text} query={query}/>;
 return <div className="help-page"><div className="page-heading"><div><h1>{en?'Help manual':'使用说明'}</h1><p>{en?'Find a workflow, follow the steps, and check the illustrated example.':'查找操作方法，按步骤完成，结合截图核对。'}</p></div></div>
  <label className="help-search"><Search size={18}/><input type="search" maxLength={300} aria-label={en?'Search the manual':'搜索使用说明'} placeholder={en?'Ask a question: how do I record a refund?':'输入关键词或问题：退款怎么记？'} value={query} onChange={e=>{setQuery(e.target.value);setReading(!e.target.value.trim());}}/></label>
  <label className="help-mobile-chapters">{en?'Browse chapters':'浏览章节'}<select value={section} onChange={e=>{setQuery('');open(e.target.value);}}>{articles.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
  <div className="help-layout"><nav className="help-topics" aria-label={en?'Manual chapters':'说明章节'}>{articles.map(a=><button type="button" key={a.id} aria-current={reading&&section===a.id?'page':undefined} onClick={()=>{setQuery('');open(a.id);}}>{a.title}</button>)}</nav>
  <div className="help-content" ref={content}>
   {!reading&&query.trim()?<><div className="help-result-status" role="status">{busy?(en?'Searching…':'正在搜索…'):en?`${results.length} chapters · ${mode==='hybrid'?'Keyword + semantic search':'Keyword search'}`:`${results.length} 个章节 · ${mode==='hybrid'?'关键词 + 语义检索':'关键词检索'}`}{error&&<p>{en?'Search service unavailable. Showing local keyword matches.':'检索服务暂不可用，已展示本地关键词结果。'}</p>}</div>
    {results.slice((page-1)*6,page*6).map(a=><button type="button" className="help-result" key={a.id} onClick={()=>open(a.id)}><strong>{highlight(a.title)}</strong><span>{highlight(a.snippet)}</span><small>{a.match==='semantic'?(en?'Related by meaning':'语义相关'):(en?'Matching text':'文字匹配')} · {en?'Read chapter':'阅读本章'} <ArrowRight size={14}/></small></button>)}
    {!busy&&!results.length&&<p>{en?'No matching chapter. Try a shorter phrase or browse the topics.':'未找到相关章节，请缩短问题或从目录浏览。'}</p>}
    {results.length>6&&<div className="help-pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>{en?'Previous':'上一页'}</button><span>{page} / {Math.ceil(results.length/6)}</span><button className="secondary" disabled={page*6>=results.length} onClick={()=>setPage(p=>p+1)}>{en?'Next':'下一页'}</button></div>}
   </>:<article key={article.id}>
    {query&&<button className="text-button" onClick={()=>setReading(false)}><ArrowLeft size={16}/>{en?'Back to results':'返回搜索结果'}</button>}
    <h2>{highlight(article.title)}</h2><p>{highlight(article.intro)}</p>
    <h3>{en?'Steps':'操作步骤'}</h3><ol className="help-steps">{article.steps.map((s,i)=><li key={i}>{highlight(s)}</li>)}</ol>
    <figure className="help-figure"><a href={`/help/v2/${prefix}-desktop-${article.image}.webp`} target="_blank" rel="noreferrer" aria-label={en?'Open full screenshot':'查看完整截图'}><picture><source media="(max-width:600px)" srcSet={`/help/v2/${prefix}-mobile-${article.image}.webp`}/><img loading="lazy" src={`/help/v2/${prefix}-desktop-${article.image}.webp`} alt={article.title}/></picture></a><figcaption>{en?'Select the image to view the full desktop screenshot.':'点击图片查看完整电脑端截图。'}</figcaption></figure>
    {!!article.notes.length&&<><h3>{en?'Details and common questions':'细节与常见问题'}</h3>{article.notes.map((n,i)=><p key={i}>{highlight(n)}</p>)}</>}
    <div className="help-pagination"><button className="secondary" disabled={!index} onClick={()=>{setQuery('');open(articles[index-1].id);content.current?.scrollIntoView({block:'start'});}}>{en?'Previous chapter':'上一章'}</button><span>{index+1} / {articles.length}</span><button className="secondary" disabled={index===articles.length-1} onClick={()=>{setQuery('');open(articles[index+1].id);content.current?.scrollIntoView({block:'start'});}}>{en?'Next chapter':'下一章'}</button></div>
   </article>}
  </div></div>
 </div>;
}
