import {deployment,type Currency} from './deployment';
import en from './locales/en.json';
export type Language='zh-CN'|'en';
export function language(value:unknown):Language{return typeof value==='string'&&value.toLowerCase().startsWith('en')?'en':'zh-CN';}
export function getLocale():Language{return deployment().language;}
export function translate(value:string,locale:Language,values:unknown[]=[],currency:Currency=deployment().currency):string{
 const key=Object.hasOwn(en,value)?value:Object.hasOwn(en,value.trim())?value.trim():null;
 const translated=locale==='en'&&key!==null?(en as Record<string,string>)[key]:value;
 const units=key!==null&&currency!=='CNY'?translated.replace(/CNY/g,currency).replace(/人民币/g,currency).replace(/元/g,currency).replace(/[¥￥]/g,currency+' '):translated;
 return units.replace(/\{(\d+)\}/g,(_,n)=>String(values[Number(n)]??''));
}
