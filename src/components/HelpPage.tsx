'use client';
import {useState} from 'react';
import {Search,BookOpen} from 'lucide-react';
import {helpSections} from '@/lib/help-content';
import {useI18n} from './LanguageProvider';
export function HelpPage(){
 const {t:tr}=useI18n();const [query,setQuery]=useState(''),[section,setSection]=useState(helpSections[0].title);
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const results=helpSections.filter(s=>words.length?words.every(w=>(s.title+' '+s.paragraphs.join(' ')).toLowerCase().includes(w)):s.title===section);
 return <div className="help-page"><div className="page-heading"><div><h1>{tr('使用说明')}</h1><p>{tr('按功能查找操作方法与统计口径。')}</p></div><BookOpen size={28}/></div>
  <label className="help-search"><Search size={18}/><input type="search" aria-label={tr('搜索使用说明')} placeholder={tr('搜索：退款、钱包、活动、记忆…')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="help-layout"><nav className="help-topics" aria-label={tr('说明主题')}>{helpSections.map(s=><button type="button" key={s.title} aria-current={!query&&section===s.title?'page':undefined} onClick={()=>{setQuery('');setSection(s.title);}}>{tr(s.title)}</button>)}</nav>
  <div className="help-content" aria-live="polite">{results.length?results.map(s=><article key={s.title}><h2>{tr(s.title)}</h2>{s.paragraphs.map(p=><p key={p}>{tr(p)}</p>)}</article>):<div className="empty">{tr('没有匹配的说明，请试试其他关键词。')}</div>}</div></div>
 </div>;
}
