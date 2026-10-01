'use client';
import {useState} from 'react';
import {MapPin,LocateFixed} from 'lucide-react';
import {coarseLocation,type ProfileContext} from '@/lib/personal-profile';
import {profileApi} from './profile-client';
import {useI18n} from './LanguageProvider';

export async function locateArea(){
 if(!window.isSecureContext||!navigator.geolocation)throw new Error('Location is unavailable');
 return new Promise<NonNullable<ProfileContext['location']>>((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve(coarseLocation({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()})),reject,{enableHighAccuracy:false,timeout:10000,maximumAge:0}));
}
export function ProfileLocation({value,onChange,disabled=false}:{value?:ProfileContext;onChange:(v:ProfileContext|undefined)=>void;disabled?:boolean}){
 const {locale}=useI18n(),en=locale==='en',t=(zh:string,english:string)=>en?english:zh;
 const [open,setOpen]=useState(false),[data,setData]=useState<any>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const update=(extra:Partial<ProfileContext>)=>onChange({recordedAt:new Date().toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,useAsTransactionPlace:false,...value,...extra});
 return <div className="profile-location">
  <button type="button" className="text-button" disabled={disabled} aria-expanded={open} onClick={async()=>{setOpen(!open);if(!open){try{setData(await profileApi('?section=settings'));}catch{setError(t('地点设置暂时无法加载；不影响记账。','Location settings are unavailable. You can still record entries.'));}}}}><MapPin size={15}/>{value?.placeId?t('已选消费区域','Area selected'):t('添加消费区域','Add purchase area')}</button>
  {open&&<div className="profile-location-body">
   <p>{t('仅用于本次场景匹配。不会持续定位，也不会把现在的位置当成历史订单的地点。','Used only for this context. No background tracking, and never applied to an old receipt automatically.')}</p>
   {data&&!data.locationEnabled?<p>{t('请先在个人资料 → 个人画像 → 学习与隐私中开启位置辅助。','Enable location assistance in Profile → Personal profile → Learning & privacy first.')}</p>:data&&<>
    <label>{t('消费发生的区域','Purchase area')}<select disabled={disabled||busy} value={value?.placeId||''} onChange={e=>update({placeId:e.target.value||undefined,useAsTransactionPlace:false})}><option value="">{t('不使用地点','No area')}</option>{data.places.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <button type="button" className="secondary" disabled={disabled||busy} onClick={async()=>{setBusy(true);setError('');try{const location=await locateArea();const result=await profileApi('',{operation:'resolve_place',context:{recordedAt:new Date().toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,location,useAsTransactionPlace:false}});update({placeId:result.placeId,useAsTransactionPlace:false});if(!result.placeId)setError(t('未匹配到常用区域，请手动选择，或到画像设置添加。','No saved area matched. Select one, or add an area in profile settings.'));}catch{setError(t('未能获取位置。可以手动选择，不影响记账。','Location was not available. Select an area manually or continue without it.'));}finally{setBusy(false);}}}><LocateFixed size={15}/>{busy?t('正在定位…','Locating…'):t('定位并匹配常用区域','Locate a saved area')}</button>
    {!!value?.placeId&&<label className="check"><input type="checkbox" disabled={disabled} checked={value.useAsTransactionPlace} onChange={e=>update({useAsTransactionPlace:e.target.checked})}/>{t('确认本次消费发生在此区域','This purchase took place in this area')}</label>}
   </>}
   {error&&<p className="muted" role="status">{error}</p>}
  </div>}
 </div>;
}
