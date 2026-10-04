'use client';
import {FormSelect} from './FormSelect';
import {useI18n} from './LanguageProvider';
import {detailSort,type DetailSort} from '@/lib/detail-sort';
export function DetailSortSelect({value,onChange,valueLabel}:{value:DetailSort;onChange:(value:DetailSort)=>void;valueLabel?:string}){
 const {locale}=useI18n(),en=locale.startsWith('en');
 return <div className="detail-sort" style={{minWidth:0,width:'min(100%, 280px)',marginBlock:12}}><FormSelect aria-label={en?'Sort entries':'明细排序'} value={value} onChange={v=>onChange(detailSort(v))}>
  <option value="date_desc">{en?'Time · newest first':'时间 · 从新到旧'}</option><option value="date_asc">{en?'Time · oldest first':'时间 · 从旧到新'}</option>
  <option value="amount_desc">{valueLabel|| (en?'Amount':'金额')}{en?' · highest first':' · 从高到低'}</option><option value="amount_asc">{valueLabel||(en?'Amount':'金额')}{en?' · lowest first':' · 从低到高'}</option>
 </FormSelect></div>;
}
