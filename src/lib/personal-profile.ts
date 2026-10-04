import {z} from 'zod';
import {normMemory} from './memory';
import {preferenceFields,preferenceValue,setPreference,type PreferenceEvidence,type PreferenceField,type PreferenceInput,type PreferenceSuggestion} from './preference-learning';

export const timeBands=['overnight','morning','midday','afternoon','evening'] as const;
export const profileContextSchema=z.object({
 recordedAt:z.string().datetime(),timeZone:z.string().max(80),
 location:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().min(0).max(1000000),capturedAt:z.string().datetime()}).optional(),
 placeId:z.string().uuid().optional(),useAsTransactionPlace:z.boolean().default(false),
}).strict();
export type ProfileContext=z.infer<typeof profileContextSchema>;
export const profileConditionSchema=z.object({
 kind:z.enum(['expense','income']).default('expense'),
 fields:z.record(z.enum(preferenceFields),z.string().trim().min(1).max(160)).default({}),
 dayType:z.enum(['weekday','weekend']).optional(),timeBand:z.enum(timeBands).optional(),placeId:z.string().uuid().optional(),
}).strict();
export type ProfileCondition=z.infer<typeof profileConditionSchema>;
export const profileRuleSchema=z.object({
 id:z.string().uuid().optional(),version:z.number().int().nonnegative().optional(),
 condition:profileConditionSchema,field:z.enum(preferenceFields),value:z.string().trim().max(160),
 state:z.enum(['confirmed','rejected','disabled']).default('confirmed'),
}).strict().refine(r=>r.state==='disabled'||!!r.value,{message:'A value is required'}).refine(r=>!r.condition.fields[r.field],{message:'A rule cannot use its result as a condition'});
export type ProfileRule=z.infer<typeof profileRuleSchema>;
export type ProfileEvidence=PreferenceEvidence&{occurredAt?:string;placeId?:string;bookId?:string;version?:number};
export type ProfileChoice={value:string;count:number;independent:number;weight:number;share:number;recentCount:number;previousCount:number;sources:{id:string;title:string;date:string}[]};
export type ProfileInsight={key:string;condition:ProfileCondition;field:PreferenceField;choices:ProfileChoice[];status:'stable'|'tentative'|'changed'|'stale';count:number;lastSeen:string;previousValue?:string};

/** Only a coarse area leaves the browser; the server repeats this reduction. */
export function coarseLocation(location:NonNullable<ProfileContext['location']>){
 return {...location,latitude:Math.round(location.latitude*100)/100,longitude:Math.round(location.longitude*100)/100,accuracy:Math.max(1500,location.accuracy)};
}
export function distanceMeters(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
 const rad=Math.PI/180,dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;
 const s=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(s),Math.sqrt(Math.max(0,1-s)));
}
export function timeBand(time?:string){
 if(!time||!/^([01]\d|2[0-3]):[0-5]\d/.test(time))return undefined;
 const h=Number(time.slice(0,2));return h<6?'overnight':h<11?'morning':h<14?'midday':h<18?'afternoon':'evening';
}
export function dayType(date?:string){
 if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))return undefined;
 return [0,6].includes(new Date(date+'T12:00:00Z').getUTCDay())?'weekend':'weekday';
}
export function conditionKey(condition:ProfileCondition){
 return JSON.stringify({kind:condition.kind,dayType:condition.dayType,timeBand:condition.timeBand,placeId:condition.placeId,fields:Object.fromEntries(Object.entries(condition.fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normMemory(v)]))});
}
export function matchesProfile(condition:ProfileCondition,input:PreferenceInput&{date?:string;occurredAt?:string;placeId?:string}){
 return condition.kind===input.kind&&Object.entries(condition.fields).every(([key,value])=>normMemory(preferenceValue(input,key as PreferenceField))===normMemory(value))&&
 (!condition.dayType||condition.dayType===dayType(input.date))&&(!condition.timeBand||condition.timeBand===timeBand(input.occurredAt))&&(!condition.placeId||condition.placeId===input.placeId);
}
export function profileSpecificity(c:ProfileCondition){return Object.keys(c.fields).length+Number(!!c.dayType)+Number(!!c.timeBand)+Number(!!c.placeId);}
export function evidenceWeight(row:ProfileEvidence,field:PreferenceField,now:number){
 const value=preferenceValue(row,field),prior=row.preferenceSuggestions?.find(s=>s.field===field&&s.state==='applied');
 const dismissed=row.preferenceSuggestions?.some(s=>s.field===field&&s.state==='dismissed'&&normMemory(s.value)===normMemory(value));
 const corrected=!!prior&&(prior.confirmed||normMemory(prior.value)!==normMemory(value));
 const independent=!prior||corrected;
 // Transaction date, not edit timestamp: editing an old receipt does not make the purchase recent.
 const age=Math.max(0,(now-Date.parse(row.date+'T12:00:00Z'))/86400000);
 return {weight:dismissed?0:Math.pow(.5,age/60)*(corrected?3:independent?1:.35),independent:!dismissed&&independent,age};
}
function conditions(row:ProfileEvidence):ProfileCondition[]{
 const kind=row.kind as 'expense'|'income',all:ProfileCondition[]=[];
 const add=(fields:ProfileCondition['fields'],extra:Partial<ProfileCondition>={})=>{if(Object.keys(fields).length||extra.placeId)all.push({kind,fields,...extra});};
 const type=preferenceValue(row,'scene.type'),merchant=preferenceValue(row,'scene.merchant')||row.payee;
 if(type)add({'scene.type':type});
 if(row.category)add({category:row.category});
 if(merchant)add(row.payee?{payee:row.payee}:{'scene.merchant':merchant});
 const base:ProfileCondition['fields']=type?{'scene.type':type}:row.category?{category:row.category}:{};
 for(const field of ['scene.transport','scene.meal','scene.diningMode','platform'] as PreferenceField[]){const value=preferenceValue(row,field);if(value)add({...base,[field]:value});}
 if(row.scene?.origin&&row.scene.destination)add({...base,'scene.origin':row.scene.origin,'scene.destination':row.scene.destination});
 const band=timeBand(row.occurredAt),day=dayType(row.date);
 if(band&&Object.keys(base).length)add(base,{timeBand:band,...(day?{dayType:day}:{})});
 if(row.placeId)add(base,{placeId:row.placeId,...(band?{timeBand:band}:{})});
 return [...new Map(all.map(c=>[conditionKey(c),c])).values()];
}
export function buildProfile(rows:ProfileEvidence[],now=Date.now()):ProfileInsight[]{
 const seen=new Set<string>(),groups=new Map<string,{condition:ProfileCondition;rows:ProfileEvidence[]}>();
 for(const row of rows){if(!['expense','income'].includes(row.kind)||seen.has(row.eventId||row.id))continue;seen.add(row.eventId||row.id);for(const c of conditions(row)){const key=conditionKey(c),group=groups.get(key)||{condition:c,rows:[]};group.rows.push(row);groups.set(key,group);}}
 const insights:ProfileInsight[]=[];
 for(const [key,group] of groups)for(const field of preferenceFields){
  if(group.condition.fields[field])continue;
  const choices=new Map<string,ProfileChoice>();
  for(const row of group.rows){const value=preferenceValue(row,field);if(!value)continue;const weight=evidenceWeight(row,field,now);if(!weight.weight)continue;const normalized=normMemory(value),choice=choices.get(normalized)||{value,count:0,independent:0,weight:0,share:0,recentCount:0,previousCount:0,sources:[]};choice.count++;choice.weight+=weight.weight;choice.independent+=Number(weight.independent);if(weight.independent){if(weight.age<=30)choice.recentCount++;else choice.previousCount++;}choice.sources.push({id:row.id,title:row.title||row.product||row.payee||row.category,date:row.date});choices.set(normalized,choice);}
  const sorted=[...choices.values()].sort((a,b)=>b.weight-a.weight),total=sorted.reduce((sum,c)=>sum+c.weight,0),top=sorted[0];if(!top||top.count<2)continue;
  for(const choice of sorted){choice.share=total?choice.weight/total:0;choice.sources.sort((a,b)=>b.date.localeCompare(a.date));}
  const lastSeen=sorted.flatMap(c=>c.sources).reduce((date,row)=>row.date>date?row.date:date,''),age=(now-Date.parse(lastSeen+'T12:00:00Z'))/86400000;
  const recent=[...sorted].sort((a,b)=>b.recentCount-a.recentCount)[0],previous=[...sorted].sort((a,b)=>b.previousCount-a.previousCount)[0];
  const recentTotal=sorted.reduce((sum,c)=>sum+c.recentCount,0),previousTotal=sorted.reduce((sum,c)=>sum+c.previousCount,0);
  const changed=recent.value!==previous.value&&recent.recentCount>=3&&previous.previousCount>=3&&recent.recentCount/recentTotal>=.8&&previous.previousCount/previousTotal>=.7;
  const stable=top.independent>=3&&top.share>=.85&&top.weight>=1.5&&top.count/group.rows.length>=.6;
  insights.push({key:key+'|'+field,condition:group.condition,field,choices:sorted,status:age>120?'stale':changed?'changed':stable?'stable':'tentative',count:group.rows.length,lastSeen,...(changed?{previousValue:previous.value}:{})});
 }
 return insights.sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen)||b.count-a.count||a.key.localeCompare(b.key));
}

export function applyProfile<T extends PreferenceInput>(input:T,context:PreferenceInput&{date?:string;occurredAt?:string;placeId?:string},insights:ProfileInsight[],rules:ProfileRule[],options:{wallets:Map<string,string>;categories:Set<string>;books?:Map<string,string>;protectedFields?:Set<PreferenceField>}){
 let value={...input};const suggestions:PreferenceSuggestion[]=[];
 const matchingRules=rules.filter(r=>matchesProfile(r.condition,context));
 const valid=(field:PreferenceField,v:string)=>field==='bookId'?!!options.books?.has(v):field==='accountId'?options.wallets.has(v):field==='category'?options.categories.has(v):!!v;
 const blockedFields=new Set<PreferenceField>();
 for(const field of preferenceFields){
  const before=preferenceValue(context,field);if(before&&(field!=='category'||context.categorySource==='explicit'))continue;
  const fieldRules=matchingRules.filter(r=>r.field===field),disabled=fieldRules.some(r=>r.state==='disabled'&&!r.value);
  const rejected=new Set(fieldRules.filter(r=>r.state==='rejected').map(r=>normMemory(r.value)));
  if(disabled){value=setPreference(value,field,before);blockedFields.add(field);continue;}
  const explicit=fieldRules.filter(r=>r.state==='confirmed'&&valid(field,r.value)).sort((a,b)=>profileSpecificity(b.condition)-profileSpecificity(a.condition));
  if(explicit.length){
   const strongest=explicit.filter(r=>profileSpecificity(r.condition)===profileSpecificity(explicit[0].condition));
   const choices=[...new Map(strongest.map(r=>[normMemory(r.value),r])).values()];
   for(const rule of choices.slice(0,3)){const applied=choices.length===1&&!rejected.has(normMemory(rule.value));suggestions.push({field,value:rule.value,label:field==='bookId'?options.books!.get(rule.value)!:field==='accountId'?options.wallets.get(rule.value)!:rule.value,before,state:applied?'applied':'candidate',count:0,basis:'rule',ruleId:rule.id,sources:[]});if(applied)value=setPreference(value,field,rule.value);}
   blockedFields.add(field);continue;
  }
  if(rejected.has(normMemory(preferenceValue(value,field))))value=setPreference(value,field,before);
  if(options.protectedFields?.has(field)&&!rejected.size)continue;
  const relevant=insights.filter(i=>i.field===field&&i.status!=='stale'&&matchesProfile(i.condition,context)).sort((a,b)=>profileSpecificity(b.condition)-profileSpecificity(a.condition));
  const best=relevant.filter(i=>profileSpecificity(i.condition)===profileSpecificity(relevant[0]?.condition||{kind:'expense',fields:{}}));
  if(!best.length){if(rejected.size)blockedFields.add(field);continue;}
  const winners=new Set(best.map(i=>normMemory(i.choices[0].value))),certain=best.every(i=>i.status==='stable')&&winners.size===1;
  const candidates=new Map<string,{insight:ProfileInsight;choice:ProfileChoice}>();
  for(const insight of best)for(const choice of insight.choices){const key=normMemory(choice.value);if(!rejected.has(key)&&valid(field,choice.value)&&!candidates.has(key))candidates.set(key,{insight,choice});}
  for(const [index,{insight,choice}] of [...candidates.values()].slice(0,3).entries()){
   const applied=certain&&index===0&&normMemory(choice.value)===normMemory(best[0].choices[0].value);
   suggestions.push({field,value:choice.value,label:field==='bookId'?options.books!.get(choice.value)!:field==='accountId'?options.wallets.get(choice.value)!:choice.value,before,state:applied?'applied':'candidate',count:choice.count,basis:'profile',insightKey:insight.key,sources:choice.sources.slice(0,3)});
   if(applied)value=setPreference(value,field,choice.value);
  }
  if(candidates.size||rejected.size)blockedFields.add(field);
 }
 return {value,suggestions,blockedFields};
}
