 'use client';
import {emptyScene,sceneTitle,type EntryScene} from '@/lib/entry-scene';
import {VisualSelect} from './VisualSelect';
import {useI18n} from './LanguageProvider';
export function SceneFields({value,onChange}:{value?:EntryScene;onChange:(value:EntryScene,title:string)=>void}){
 const {t:tr,locale}=useI18n();const s={...emptyScene(),...value};
 const update=(patch:Partial<EntryScene>)=>{const next={...s,...patch};onChange(next,sceneTitle(next,locale==='en'));};
 const fields=s.type==='transport'?[['transport','交通方式'],['origin','始发站'],['destination','终点站']]:s.type==='dining'?[['merchant','商家简称'],['branch','门店'],['meal','用餐类型']]:s.type==='shopping'||s.type==='groceries'?[['merchant','商家简称'],['branch','门店'],['summary','商品概括']]:[];
 return <div className="scene-fields"><label>{tr('消费场景')}<VisualSelect label={tr('消费场景')} value={s.type} onChange={type=>update({...emptyScene(),type:type as EntryScene['type']})} options={[['general','通用'],['transport','交通出行'],['dining','餐饮'],['shopping','购物'],['groceries','买菜']].map(([value,label])=>({value,label:tr(label)}))}/></label>{fields.length>0&&<div className="form-grid">{fields.map(([key,label])=><label key={key}>{tr(label)}<input maxLength={80} value={s[key as keyof EntryScene]} placeholder={tr('未识别可留空')} onChange={e=>update({[key]:e.target.value})}/></label>)}</div>}</div>;
}
