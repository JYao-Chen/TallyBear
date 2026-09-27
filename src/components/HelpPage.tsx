'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,ArrowLeft,ArrowRight,MessageCircle,ExternalLink,Monitor,Smartphone} from 'lucide-react';
import {helpArticles,helpKeywordScore,helpTerms,type HelpArticle} from '@/lib/help-manual';
import {type HelpTarget} from '@/lib/help-guide';
import {useI18n} from './LanguageProvider';

export function HelpHighlight({text,query}:{text:string;query:string}){
 const words=helpTerms(query).sort((a,b)=>b.length-a.length);if(!words.length)return <>{text}</>;
 const pattern=new RegExp('('+words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
 return <>{text.split(pattern).map((part,i)=>i%2?<mark key={i}>{part}</mark>:part)}</>;
}
type Result=HelpArticle&{snippet:string;match:string};
function HelpFigure({image,caption,en}:{image:string;caption:string;en:boolean}){
 const [device,setDevice]=useState<'desktop'|'mobile'|null>(null);
 useEffect(()=>{setDevice(window.matchMedia('(max-width:600px)').matches?'mobile':'desktop');},[]);
 const selected=device||'desktop',src=`/help/v2/${en?'en':'zh'}-${selected}-${image}.webp`;
 return <figure className={`help-figure help-figure-${selected}`}>
  <div className="help-figure-toolbar"><div role="group" aria-label={en?'Screenshot view':'截图视图'}>{(['desktop','mobile'] as const).map(d=><button key={d} type="button" aria-pressed={selected===d} onClick={()=>setDevice(d)}>{d==='desktop'?<Monitor size={14}/>:<Smartphone size={14}/>}<span>{d==='desktop'?(en?'Desktop':'电脑'):(en?'Mobile':'手机')}</span></button>)}</div><a href={src} target="_blank" rel="noreferrer">{en?'Full screenshot':'完整截图'}<ExternalLink size={14}/></a></div>
  <a className="help-image-link" href={src} target="_blank" rel="noreferrer" aria-label={en?'Open full screenshot':'查看完整截图'}><img loading="lazy" src={src} alt={caption}/></a><figcaption>{caption}</figcaption>
 </figure>;
}
export function HelpPage({onNavigate,onAsk,canAsk=true}:{onNavigate?:(target:HelpTarget)=>void;onAsk?:(question:string)=>void;canAsk?:boolean}){
 const {locale}=useI18n();const en=locale==='en';const articles=useMemo(()=>helpArticles(locale),[locale]);
 const [query,setQuery]=useState(''),[section,setSection]=useState('intro'),[reading,setReading]=useState(true),[results,setResults]=useState<Result[]>([]),[busy,setBusy]=useState(false),[mode,setMode]=useState('keyword'),[error,setError]=useState(false),[page,setPage]=useState(1);
 const content=useRef<HTMLDivElement>(null);
 useEffect(()=>{const id=sessionStorage.getItem('help-article');if(id&&articles.some(a=>a.id===id))setSection(id);fetch('/api/help').catch(()=>{});},[articles]);
 useEffect(()=>{
  if(!query.trim()){setResults([]);setBusy(false);return;}
  const controller=new AbortController();setBusy(true);setError(false);setPage(1);
  const local=articles.filter(a=>helpKeywordScore(a,query)>0).sort((a,b)=>helpKeywordScore(b,query)-helpKeywordScore(a,query)).map(a=>({...a,snippet:[a.intro,...a.steps,...a.notes].find(p=>helpTerms(query).some(w=>p.toLowerCase().includes(w)))||a.intro,match:'keyword'}));setResults(local);setMode('keyword');
  const timer=setTimeout(async()=>{try{const r=await fetch('/api/help?q='+encodeURIComponent(query),{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();setResults(data.items);setMode(data.mode);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setBusy(false);}},350);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,articles]);
 useEffect(()=>{if(reading&&query)content.current?.querySelector('mark')?.scrollIntoView({block:'center'});},[reading,section,query]);
 const article=articles.find(a=>a.id===section)||articles[0];const index=articles.indexOf(article);const groups=[...new Set(articles.map(a=>a.group))];
 const open=(id:string)=>{setSection(id);setReading(true);sessionStorage.setItem('help-article',id);};
 const highlight=(text:string)=><HelpHighlight text={text} query={query}/>;
 const feature=(action:{target:HelpTarget;label:string}|undefined)=>action&&onNavigate?<button type="button" className="help-feature-link" onClick={()=>onNavigate(action.target)}>{action.label}<ArrowRight size={15}/></button>:null;
 const ask=()=>onAsk?.(en?`Please consult the help chapter “${article.title}” and help me with its workflow. My question is: `:`请查阅使用说明中“${article.title}”这一章，帮我解答操作问题。我的问题是：`);
 return <div className="help-page"><div className="page-heading"><div><h1>{en?'Help manual':'使用说明'}</h1><p>{en?'Learn TallyBear, from your first entry to shared finances.':'从第一笔记录开始，了解 TallyBear 的日常记账与家庭协作。'}</p></div></div>
  <label className="help-search"><Search size={18}/><input type="search" maxLength={300} aria-label={en?'Search the manual':'搜索使用说明'} placeholder={en?'Ask a question: how do I record a refund?':'输入关键词或问题：退款怎么记？'} value={query} onChange={e=>{setQuery(e.target.value);setReading(!e.target.value.trim());}}/></label>
  <label className="help-mobile-chapters">{en?'Contents · choose a chapter':'目录 · 选择章节'}<select value={section} onChange={e=>{setQuery('');open(e.target.value);}}>{groups.map(g=><optgroup key={g} label={g}>{articles.filter(a=>a.group===g).map(a=><option key={a.id} value={a.id}>{String(articles.indexOf(a)+1).padStart(2,'0')} · {a.title}</option>)}</optgroup>)}</select></label>
  <div className="help-layout"><nav className="help-topics" aria-label={en?'Manual chapters':'说明章节'}>{groups.map(g=><div className="help-topic-group" key={g}><p>{g}</p>{articles.filter(a=>a.group===g).map(a=><button type="button" key={a.id} aria-current={reading&&section===a.id?'page':undefined} onClick={()=>{setQuery('');open(a.id);content.current?.scrollIntoView({block:'start'});}}><span>{String(articles.indexOf(a)+1).padStart(2,'0')}</span>{a.title}</button>)}</div>)}</nav>
  <div className="help-content" ref={content}>
   {!reading&&query.trim()?<><div className="help-result-status" role="status">{busy?(en?'Searching…':'正在搜索…'):en?`${results.length} chapters · ${mode==='hybrid'?'Keyword + semantic search':'Keyword search'}`:`${results.length} 个章节 · ${mode==='hybrid'?'关键词 + 语义检索':'关键词检索'}`}{error&&<p>{en?'Search service unavailable. Showing local keyword matches.':'检索服务暂不可用，已展示本地关键词结果。'}</p>}</div>
    {results.slice((page-1)*6,page*6).map(a=><button type="button" className="help-result" key={a.id} onClick={()=>open(a.id)}><strong>{highlight(a.title)}</strong><span>{highlight(a.snippet)}</span><small>{a.match==='semantic'?(en?'Related by meaning':'语义相关'):(en?'Matching text':'文字匹配')} · {en?'Read chapter':'阅读本章'} <ArrowRight size={14}/></small></button>)}
    {!busy&&!results.length&&<p>{en?'No matching chapter. Try a shorter phrase or browse the topics.':'未找到相关章节，请缩短问题或从目录浏览。'}</p>}
    {results.length>6&&<div className="help-pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>{en?'Previous':'上一页'}</button><span>{page} / {Math.ceil(results.length/6)}</span><button className="secondary" disabled={page*6>=results.length} onClick={()=>setPage(p=>p+1)}>{en?'Next':'下一页'}</button></div>}
   </>:<article key={article.id}>
    {query&&<button className="text-button" onClick={()=>setReading(false)}><ArrowLeft size={16}/>{en?'Back to results':'返回搜索结果'}</button>}
    <header className="help-chapter-header"><h2>{highlight(article.title)}</h2><p className="help-chapter-position">{article.group} · {index+1} / {articles.length}</p><p className="help-lead">{highlight(article.intro)}</p>{onAsk&&<><button type="button" className="help-ask secondary" disabled={!canAsk} onClick={ask}><MessageCircle size={17}/>{en?'Ask the assistant':'询问助手'}</button>{!canAsk&&<small>{en?'Create or select a book to use the assistant.':'创建或选择账本后即可向助手提问。'}</small>}</>}</header>
    <nav className="help-section-toc" aria-label={en?'On this page':'本章内容'}><strong>{en?'On this page':'本章内容'}</strong>{article.sections.map(s=><a href={`#guide-${article.id}-${s.id}`} key={s.id}>{s.title}</a>)}</nav>
    {article.sections.map(s=><section className="help-section" id={`guide-${article.id}-${s.id}`} key={s.id}>
     <h3>{highlight(s.title)}</h3>{s.paragraphs.map((p,i)=><p key={i}>{highlight(p)}</p>)}
     {!!s.steps.length&&<ol className="help-steps">{s.steps.map((step,i)=><li key={i}><div><h4>{highlight(step.title)}</h4><p>{highlight(step.text)}</p>{feature(step.action)}</div></li>)}</ol>}
     {s.example&&<aside className="help-callout help-example"><strong>{en?'Example':'示例'}</strong><p>{highlight(s.example)}</p></aside>}
     {s.note&&<aside className="help-callout help-note"><strong>{en?'Keep in mind':'注意事项'}</strong><p>{highlight(s.note)}</p></aside>}
     {!!s.questions.length&&<dl className="help-faq">{s.questions.map((q,i)=><div key={i}><dt>{highlight(q.q)}</dt><dd>{highlight(q.a)}</dd></div>)}</dl>}
     {feature(s.action)}{s.figures.map(f=><HelpFigure key={f.key} image={f.key} caption={f.caption} en={en}/>)}
    </section>)}
    {onAsk&&<div className="help-support"><div><strong>{en?'Need help with this chapter?':'这一步还有疑问？'}</strong><p>{en?'Bring this topic to the assistant and describe where you are stuck.':'把本章主题带给助手，再描述你遇到的问题。'}</p></div><button type="button" className="secondary" disabled={!canAsk} onClick={ask}><MessageCircle size={17}/>{en?'Ask the assistant':'询问助手'}</button></div>}
    <div className="help-pagination"><button className="secondary" disabled={!index} onClick={()=>{setQuery('');open(articles[index-1].id);content.current?.scrollIntoView({block:'start'});}}>{en?'Previous chapter':'上一章'}</button><span>{index+1} / {articles.length}</span><button className="secondary" disabled={index===articles.length-1} onClick={()=>{setQuery('');open(articles[index+1].id);content.current?.scrollIntoView({block:'start'});}}>{en?'Next chapter':'下一章'}</button></div>
   </article>}
  </div></div>
 </div>;
}
