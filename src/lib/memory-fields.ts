import type {MemorySuggestion} from './memory';
type Values={category?:string;categorySource?:string;payee?:string;platform?:string;product?:string;title?:string};
export const memoryFieldLabels={category:'分类',payee:'商家',platform:'平台',product:'商品摘要',title:'标题'};
// A fixed allowlist prevents historical prices, quantities, dates, wallets and payment IDs from becoming new facts.
export function planMemoryFill<T extends Values>(input:T,suggestions:MemorySuggestion[]){
 const value={...input},next=suggestions.map(s=>({...s,fieldChanges:[] as MemorySuggestion['fieldChanges']}));
 for(const field of Object.keys(memoryFieldLabels) as (keyof typeof memoryFieldLabels)[]){
  const matches=next.filter(s=>s.status==='matched'&&s.fields[field]&&(!s.itemId||field==='category'));
  if(!matches.length)continue;
  const choices=new Set(matches.map(s=>s.fields[field]));const before=String(input[field]||'');
  for(const s of matches){
   const after=s.fields[field];let state:MemorySuggestion['fieldChanges'][number]['state']='suggested';
   if(choices.size>1||(s.conflicts||[]).length)state='conflict';
   else if(before===after)state='kept';
   else if(!before||(field==='category'&&input.categorySource!=='explicit')){state='applied';(value as Values)[field]=after;}
   else state='conflict';
   s.fieldChanges.push({field,before,after,state});
  }
 }
 return {value,suggestions:next};
}
export function changeMemorySelection<T extends Values>(input:T,old:MemorySuggestion[],next:MemorySuggestion[]){
 const value={...input};
 for(const s of old)for(const change of s.fieldChanges||[]){if(change.state==='applied'&&value[change.field]===change.after)(value as Values)[change.field]=change.before;}
 return planMemoryFill(value,next);
}
export function resolveMemoryField<T extends Values>(input:T,suggestions:MemorySuggestion[],id:string,itemId:string|undefined,field:keyof typeof memoryFieldLabels,useMemory:boolean){
 const value:T&Values={...input};const next=suggestions.map(s=>({...s,fieldChanges:(s.fieldChanges||[]).map(c=>({...c}))}));
 const chosen=next.find(s=>s.id===id&&s.itemId===itemId)?.fieldChanges.find(c=>c.field===field);if(!chosen)return {value,suggestions:next};
 if(useMemory){(value as Values)[field]=chosen.after;chosen.state='applied';}
 else{if(value[field]===chosen.after)(value as Values)[field]=chosen.before;chosen.state='kept';}
 if(field==='category')value.categorySource='explicit';
 return {value,suggestions:next};
}
