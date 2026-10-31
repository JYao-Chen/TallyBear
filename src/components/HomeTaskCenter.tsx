'use client';
import {useCallback,useState} from 'react';
import {SectionTabs} from './SectionTabs';
import {ExpenseClaimsInbox,ExpenseClaimsSent} from './ExpenseClaims';
import {DiscussionInbox} from './DiscussionInbox';
import {useI18n} from './LanguageProvider';
export function HomeTaskCenter({revision,onChanged,onOpenSource}:{revision:number;onChanged:()=>void;onOpenSource:(row:any)=>Promise<void>}){
 const {locale}=useI18n(),en=locale==='en',[tab,setTab]=useState('incoming'),[counts,setCounts]=useState([0,0,0]);
 const incoming=useCallback((n:number)=>setCounts(v=>v[0]===n?v:[n,v[1],v[2]]),[]),sent=useCallback((n:number)=>setCounts(v=>v[1]===n?v:[v[0],n,v[2]]),[]),messages=useCallback((n:number)=>setCounts(v=>v[2]===n?v:[v[0],v[1],n]),[]);
 const label=(i:number,zh:string,english:string)=>(en?english:zh)+(counts[i]>0?` · ${counts[i]}`:counts[i]<0?' !':'');
 return <section className="panel home-task-center" hidden={counts.every(n=>n===0)}><h2>{en?'Family bills and messages':'家庭账单与消息'}</h2><SectionTabs label={en?'Family tasks':'家庭任务'} value={tab} onChange={setTab} items={[
 {key:'incoming',label:label(0,'待认领','Claims'),content:<><ExpenseClaimsInbox revision={revision} onChanged={onChanged} onCount={incoming}/>{!counts[0]&&<p>{en?'No new claims':'暂无待认领动态'}</p>}</>},
 {key:'sent',label:label(1,'为他人购买','Purchases'),content:<ExpenseClaimsSent revision={revision} onChanged={onChanged} onCount={sent} compact/>},
 {key:'discussion',label:label(2,'讨论消息','Messages'),content:<><DiscussionInbox revision={revision} onOpenSource={onOpenSource} onCount={messages}/>{!counts[2]&&<p>{en?'No new messages':'暂无讨论消息'}</p>}</>}
 ]}/></section>;
}
