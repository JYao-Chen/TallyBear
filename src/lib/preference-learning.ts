import {z} from 'zod';
import {sceneSchema,sceneTitle,type EntryScene} from './entry-scene';
import {normMemory,specConflict} from './memory';

// Identity/context only. Prices, dates, quantities and payment references are never learned defaults.
export const preferenceFields=['category','accountId','payee','platform','scene.type','scene.transport','scene.origin','scene.destination','scene.merchant','scene.branch','scene.meal','scene.diningMode'] as const;
export type PreferenceField=typeof preferenceFields[number];
export const preferenceSuggestion=z.object({
 field:z.enum(preferenceFields),value:z.string().max(160),label:z.string().max(160),before:z.string().default(''),
 state:z.enum(['applied','candidate','dismissed']),confirmed:z.boolean().optional(),count:z.number().int().nonnegative(),
 basis:z.enum(['context','semantic']),sources:z.array(z.object({id:z.string(),title:z.string(),date:z.string()})).max(3),
});
export type PreferenceSuggestion=z.infer<typeof preferenceSuggestion>;
export type PreferenceInput={kind:string;category:string;categorySource?:'explicit'|'model';accountId?:string;payee:string;platform?:string;title?:string;product?:string;note?:string;scene?:EntryScene;preferenceSuggestions?:PreferenceSuggestion[]};
export type PreferenceEvidence=PreferenceInput&{id:string;eventId?:string;at:string|Date;date:string;preferenceSuggestions?:PreferenceSuggestion[]};
export function preferenceValue(input:PreferenceInput,field:PreferenceField):string{
 const value=field.startsWith('scene.')?input.scene?.[field.slice(6) as keyof EntryScene]:input[field as keyof PreferenceInput];
 return typeof value==='string'&&!['unknown','general'].includes(value)?value:'';
}
export function setPreference<T extends PreferenceInput>(input:T,field:PreferenceField,value:string):T{
 return field.startsWith('scene.')?{...input,scene:sceneSchema.parse({...input.scene,[field.slice(6)]:value})}:{...input,[field]:value};
}
export function resolvePreference<T extends PreferenceInput>(input:T,target:PreferenceSuggestion,adopt:boolean,english=false){
 let value=input;
 const previous=input.preferenceSuggestions?.find(s=>s.field===target.field&&s.state==='applied');
 if(adopt)value=setPreference(input,target.field,target.value);
 else if(previous&&preferenceValue(input,target.field)===target.value)value=setPreference(input,target.field,target.before);
 if(target.field==='category'&&adopt)value={...value,categorySource:'explicit'};
 if(target.field.startsWith('scene.')&&(!input.title||input.title===sceneTitle(sceneSchema.parse(input.scene||{}),english)))value={...value,title:sceneTitle(sceneSchema.parse(value.scene||{}),english)};
 return {...value,preferenceSuggestions:input.preferenceSuggestions?.map(s=>s.field!==target.field?s:{...s,confirmed:s.value===target.value?adopt:s.confirmed,state:s.value===target.value?(adopt?'applied':'dismissed'):s.state==='applied'?'candidate':s.state}) as PreferenceSuggestion[]};
}
const tokens=(value:string)=>new Set([...value.toLowerCase().matchAll(/[a-z]+|[\p{Script=Han}]+/gu)].flatMap(m=>/^[a-z]+$/.test(m[0])?[m[0]]:Array.from({length:Math.max(0,m[0].length-1)},(_,i)=>m[0].slice(i,i+2))).filter(t=>!['记账','一笔','今天','帮我','记录','支出','消费','please','record','today','expense'].includes(t)));
export const hasPreferenceContext=(value:string)=>tokens(value.replace(/帮我记一笔|记一笔|帮我记账|请记账/g,'')).size>0;
export const preferenceText=(e:PreferenceInput)=>[e.title,e.product,e.payee,e.note,...Object.entries(e.scene||{}).filter(([k])=>!['type','diningMode','purchaseGroup'].includes(k)).map(([,v])=>v)].filter(Boolean).join(' ');
const anchors:PreferenceField[]=['payee','platform','scene.transport','scene.origin','scene.destination','scene.merchant','scene.branch','scene.meal','scene.diningMode'];
export function compatiblePreference(input:PreferenceInput,row:PreferenceInput){
 if(input.kind!==row.kind)return false;
 if(input.categorySource==='explicit'&&normMemory(input.category)!==normMemory(row.category))return false;
 const type=preferenceValue(input,'scene.type'),other=preferenceValue(row,'scene.type');
 if(type&&other&&type!==other)return false;
 if(input.product&&row.product&&specConflict(input.product,row.product))return false;
 return !anchors.some(f=>{const a=preferenceValue(input,f),b=preferenceValue(row,f);return a&&b&&normMemory(a)!==normMemory(b);});
}
export function rankPreferenceEvidence(input:PreferenceInput,rows:PreferenceEvidence[],query=''){
 const words=tokens([query,preferenceText({...input,note:''})].join(' '));
 return rows.filter(r=>compatiblePreference(input,r)).map(row=>{
  const known=anchors.filter(f=>preferenceValue(input,f));
  const matches=known.filter(f=>normMemory(preferenceValue(input,f))===normMemory(preferenceValue(row,f)));
  const text=tokens(preferenceText(row));
  const common=[...words].filter(t=>text.has(t));
  const lexical=common.length/Math.max(1,words.size);
  // A type/category or payment platform alone is not a purchase identity.
  const strong=matches.some(f=>f!=='platform'&&f!=='scene.diningMode'&&f!=='scene.meal');
  const productWords=tokens(input.product||''),historicalProduct=tokens(row.product||'');
  const productMatch=[...productWords].filter(t=>historicalProduct.has(t)).length/Math.max(1,productWords.size);
  return {row,score:matches.length*2+lexical+productMatch*3,basis:'context' as const,eligible:(strong&&(!productWords.size||productMatch>=.5))||lexical>=.55&&common.length>=2};
 }).sort((a,b)=>b.score-a.score||new Date(b.row.at).getTime()-new Date(a.row.at).getTime());
}
export function inferPreferences<T extends PreferenceInput>(input:T,ranked:ReturnType<typeof rankPreferenceEvidence>,options:{wallets:Map<string,string>;categories:Set<string>;semanticIds?:Set<string>;now?:number;protectedFields?:Set<PreferenceField>}){
 const lexical=ranked.filter(r=>r.eligible),best=lexical[0]?.score||0;
 const selected=lexical.length?lexical.filter(r=>r.score>=best-.75):ranked.filter(r=>options.semanticIds?.has(r.row.id));
 const seen=new Set<string>();const evidence=selected.filter(({row})=>{const id=row.eventId||row.id;if(seen.has(id))return false;seen.add(id);return true;}).slice(0,60);
 const suggestions:PreferenceSuggestion[]=[];let value={...input};
 for(const field of preferenceFields){
  if(options.protectedFields?.has(field))continue;
  const before=preferenceValue(input,field);
  if(before&&(field!=='category'||input.categorySource==='explicit'))continue;
  const groups=new Map<string,{value:string;weight:number;independent:number;corrections:number;rows:PreferenceEvidence[]}>();
  for(const {row} of evidence){
   const candidate=preferenceValue(row,field);if(!candidate)continue;
   if(field==='accountId'&&!options.wallets.has(candidate)||field==='category'&&!options.categories.has(candidate))continue;
   const prior=row.preferenceSuggestions?.find(s=>s.field===field&&s.state==='applied');
   if(row.preferenceSuggestions?.some(s=>s.field===field&&s.state==='dismissed'&&normMemory(s.value)===normMemory(candidate)))continue;
   const corrected=!!prior&&(prior.confirmed||normMemory(prior.value)!==normMemory(candidate)),inferred=!!prior&&!corrected;
   const age=Math.max(0,((options.now??Date.now())-new Date(row.at).getTime())/86400000);
   const weight=Math.pow(.5,age/60)*(corrected?3:inferred?.35:1);
   const key=normMemory(candidate),group=groups.get(key)||{value:candidate,weight:0,independent:0,corrections:0,rows:[]};
   group.weight+=weight;group.independent+=Number(!inferred);group.corrections+=Number(corrected);group.rows.push(row);groups.set(key,group);
  }
  const sorted=[...groups.values()].sort((a,b)=>b.weight-a.weight),total=sorted.reduce((n,g)=>n+g.weight,0),first=sorted[0];if(!first||total<=0)continue;
  const certain=(first.independent>=3||first.corrections>=2)&&first.weight/total>=.85&&first.weight>=1.5&&(first.rows.length/evidence.length>=.6||first.corrections>=2);
  for(const [index,g] of sorted.slice(0,3).entries()){
   const applied=certain&&index===0;
   suggestions.push({field,value:g.value,label:field==='accountId'?options.wallets.get(g.value)!:g.value,before,state:applied?'applied':'candidate',count:g.rows.length,basis:lexical.length?'context':'semantic',sources:g.rows.slice(0,3).map(r=>({id:r.id,title:r.title||r.product||r.payee||r.category,date:r.date}))});
   if(applied)value=setPreference(value,field,g.value);
  }
 }
 return {value,suggestions};
}
