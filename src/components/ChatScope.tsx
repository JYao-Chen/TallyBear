'use client';
import {useState} from 'react';
import {BookOpen,Check} from 'lucide-react';
import {Sheet} from './Sheet';
import {useI18n} from './LanguageProvider';
export function ChatScope({books,current,selected,onChange}:{books:{id:string;name:string}[];current:string;selected:string[];onChange:(ids:string[])=>void}){
 const {t}=useI18n(),[open,setOpen]=useState(false);const label=selected.length===1&&selected[0]===current?t('当前账本'):selected.length===books.length?t('全部账本'):t('已选账本')+` · ${selected.length}`;
 return <><button className="composer-scope" title={t('分析范围')} onClick={()=>setOpen(true)} type="button"><BookOpen size={17}/><span>{label}</span></button>{open&&<Sheet title={t('分析范围')} onClose={()=>setOpen(false)}><div className="scope-shortcuts"><button type="button" className="secondary" onClick={()=>onChange([current])}>{t('当前账本')}</button><button type="button" className="secondary" onClick={()=>onChange(books.map(b=>b.id))}>{t('全部账本')}</button></div><div className="scope-books">{books.map(b=><button type="button" key={b.id} aria-pressed={selected.includes(b.id)} onClick={()=>onChange(selected.includes(b.id)?selected.length>1?selected.filter(id=>id!==b.id):selected:[...selected,b.id])}><BookOpen size={18}/><span>{b.name}</span>{selected.includes(b.id)&&<Check size={18}/>}</button>)}</div><button type="button" onClick={()=>setOpen(false)}>{t('完成')}</button></Sheet>}</>;
}
