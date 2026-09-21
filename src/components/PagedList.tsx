'use client';
import {Fragment,useState,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {useI18n} from './LanguageProvider';
import {LIST_PAGE_SIZE} from '@/lib/pagination';

/** Paginate display collections without changing the data used for totals. */
export function PagedList<T>({items,children,pageSize=LIST_PAGE_SIZE,label,resetKey='',container}:{items:readonly T[];children:(item:T,index:number)=>ReactNode;pageSize?:number;label?:string;resetKey?:string;container?:(rows:ReactNode)=>ReactNode}) {
 const {locale}=useI18n();
 const [position,setPosition]=useState({key:resetKey,page:0});
 const pages=Math.max(1,Math.ceil(items.length/pageSize));
 const page=position.key===resetKey?Math.min(position.page,pages-1):0;
 if(position.key!==resetKey||position.page!==page)setPosition({key:resetKey,page});
 const start=page*pageSize;
 const controls=<nav className="list-pagination" aria-label={label||(locale==='en'?'Pagination':'列表分页')}><span aria-live="polite">{start+1}–{Math.min(start+pageSize,items.length)} / {items.length}</span><div><button type="button" className="secondary" aria-label={locale==='en'?'Previous page':'上一页'} disabled={page===0} onClick={()=>setPosition({key:resetKey,page:page-1})}><ChevronLeft size={16}/></button><span>{page+1} / {pages}</span><button type="button" className="secondary" aria-label={locale==='en'?'Next page':'下一页'} disabled={page===pages-1} onClick={()=>setPosition({key:resetKey,page:page+1})}><ChevronRight size={16}/></button></div></nav>;
 const rows=items.slice(start,start+pageSize).map((item,index)=><Fragment key={start+index}>{children(item,start+index)}</Fragment>);
 return <>{container?container(rows):rows}{items.length>pageSize&&controls}</>;
}
