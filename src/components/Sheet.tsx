'use client';
import {useI18n} from './LanguageProvider';
import {useEffect,useRef,useId,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
export function Sheet({title,onClose,children,variant='detail'}:{title:string;onClose:()=>void;children:ReactNode;variant?:'detail'|'picker'|'wide'}){const {t:tr,locale}=useI18n();
 const titleId=useId(),dialog=useRef<HTMLDialogElement>(null),close=useRef(onClose),[mounted,setMounted]=useState(false);close.current=onClose;
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{if(!mounted)return;const d=dialog.current!,previous=document.activeElement as HTMLElement|null;const previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';d.showModal();if(variant==='picker')d.querySelector<HTMLElement>('.choice-search input, .choice-option[aria-pressed="true"], .calendar-days button[aria-pressed="true"], .calendar-months button[aria-pressed="true"]')?.focus({preventScroll:true});return()=>{document.documentElement.style.overflow=previousOverflow;d.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[mounted,variant]);
 if(!mounted)return null;
 return createPortal(<dialog ref={dialog} className={('detail-sheet ' + (variant==='picker'?'picker-sheet':variant==='wide'?'wide-sheet':''))} aria-labelledby={titleId} onCancel={e=>{e.preventDefault();e.stopPropagation();close.current();}} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close.current();}}}><div className="sheet-grip"/><div className="sheet-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label={tr("关闭弹窗")} autoFocus><X size={22}/></button></div><div className="sheet-content">{children}</div></dialog>,document.body);
}
