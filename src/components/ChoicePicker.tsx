'use client';
import {useI18n} from './LanguageProvider';
import {useState,type ReactNode} from 'react';
import {Check,Search,X} from 'lucide-react';
import {Sheet} from './Sheet';
export type Choice={value:string;label:string;disabled?:boolean;icon?:ReactNode};
export function ChoicePicker({title,options,value,onSelect,onClose}:{title:string;options:Choice[];value:string;onSelect:(value:string)=>void;onClose:()=>void}){const {t:tr,locale}=useI18n();
 const [query,setQuery]=useState('');const filtered=options.filter(o=>o.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <Sheet title={title} onClose={onClose} variant="picker"><div className="choice-picker">{options.length>6&&<div className="choice-search"><Search size={18}/><input type="search" aria-label={(tr("搜索") + title)} placeholder={tr("搜索名称")} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" className="icon-button" aria-label={tr("清空搜索")} onClick={()=>setQuery('')}><X size={16}/></button>}</div>}<div className="choice-list" aria-label={title} onKeyDown={e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const i=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)));if(buttons[next]){e.preventDefault();buttons[next].focus();}}}>{filtered.map(o=><button type="button" className="choice-option" key={o.value} disabled={o.disabled} aria-pressed={o.value===value} onClick={()=>onSelect(o.value)}>{o.icon&&<span className="choice-icon" aria-hidden="true">{o.icon}</span>}<span className="choice-label">{o.label}</span><span className="choice-check">{o.value===value&&<Check size={18}/>}</span></button>)}{!filtered.length&&<p className="choice-empty" role="status">{tr("没有找到，试试其他关键词")}</p>}</div></div></Sheet>;
}
