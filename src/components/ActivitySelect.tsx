'use client';
import {useEffect,useState} from 'react';
import {useI18n} from './LanguageProvider';
import {FormSelect} from './FormSelect';

export type Activity={id:string;name:string;category:string;familyId:string|null;familyName:string|null;ownerId:string;editable:boolean;description:string;startsOn:string|null;endsOn:string|null;budget:number|null;archived:boolean;entryCount:number};
let activityOptions:Promise<Activity[]>|null=null;
export function invalidateActivityOptions(){activityOptions=null;window.dispatchEvent(new Event('tallybear-activities-changed'));}
export function ActivitySelect({activities,value,onChange,disabled=false}:{activities?:Activity[];value:string;onChange:(value:string)=>void;disabled?:boolean}){const {t:tr}=useI18n(),[options,setOptions]=useState<Activity[]>(activities||[]),[error,setError]=useState('');
 useEffect(()=>{if(activities){setOptions(activities);return;}let active=true;const load=()=>{activityOptions??=fetch('/api/activities').then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error);return value;});activityOptions.then(value=>{if(active)setOptions(value);}).catch(e=>{activityOptions=null;if(active)setError(e.message);});};load();window.addEventListener('tallybear-activities-changed',load);return()=>{active=false;window.removeEventListener('tallybear-activities-changed',load);};},[activities]);
 return <label>{tr('所属活动（选填）')}<FormSelect value={value} onChange={onChange} disabled={disabled} aria-label={tr('所属活动')}><option value="">{tr('不归入活动')}</option>{options.filter(a=>!a.archived||a.id===value).map(a=><option key={a.id} value={a.id}>{a.familyName?`${a.familyName} · `:''}{a.name}{a.archived?` · ${tr('已归档')}`:''}</option>)}</FormSelect>{error&&<small role="alert" className="expense">{tr(error)}</small>}</label>;
}
