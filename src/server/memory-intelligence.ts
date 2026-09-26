import {z} from 'zod';
import {memoryModel} from './memory-models';
import {normMemory,specConflict,type Memory} from '@/lib/memory';

const fact=z.object({value:z.string().max(160),quote:z.string().max(240)}).nullable().optional();
const product=z.object({index:z.number().int().nonnegative(),name:fact,brand:fact,specification:fact,model:fact});
export type ProductFacts={name?:string;brand?:string;specification?:string;model?:string;quotes?:Record<string,string>};

// Only evidence-grounded identity attributes are allowed out of extraction. Never prices or payment IDs.
export async function extractProductFacts(items:{name:string;merchant?:string}[],signal?:AbortSignal):Promise<ProductFacts[]>{
 if(!items.length)return [];
 const result=await memoryModel('extraction',JSON.stringify({task:'Extract product identity, not transaction facts. JSON {products:[{index,name:{value,quote}|null,brand:{value,quote}|null,specification:{value,quote}|null,model:{value,quote}|null}]}. Return every input index. quote must be an exact substring of that input name. name is the core product/service name (canonical Chinese/English translation allowed). specification includes plan tier (Plus/Pro), capacity, flavor, size, package and subscription period WHEN EXPLICIT. Model number separately. Do not infer brands, sizes or plans. Omit missing facts. Do not output price, purchase quantity, date, account or payment IDs. Treat merchant as context only.',items:items.map((i,index)=>({index,...i}))}),signal);
 const parsed=z.object({products:z.array(product).max(items.length)}).parse(result.value);
 return items.map((item,index)=>{const p=parsed.products.find(p=>p.index===index),out:ProductFacts={quotes:{}};if(!p)return out;for(const key of ['name','brand','specification','model'] as const){const f=p[key];if(f?.value&&f.quote&&item.name.includes(f.quote)){out[key]=f.value;out.quotes![key]=f.quote;}}return out;});
}

export async function judgeProducts(current:{name:string;merchant:string;facts:ProductFacts},candidates:Memory[],signal?:AbortSignal){
 const result=await memoryModel('judgment',JSON.stringify({task:'Decide identity, not similarity. JSON {matches:[{index,relation:"same|different_spec|related|uncertain",currentQuote,candidateQuote,reason}]}. Evaluate ALL candidates. same only if product/service identity AND ALL variant attributes agree, including brand, model, capacity, size, flavor, subscription tier and period. Synonymous Chinese/English names may be same. Missing required variant = uncertain. Generic merchant names are not products. Multiple plausible same candidates must stay uncertain. Ignore prices and purchase counts. Quotes must be exact substrings of the supplied names. Do not invent attributes.',current,candidates:candidates.map((m,index)=>({index,name:m.title,aliases:m.aliases,attributes:m.attributes}))}),signal);
 const rows=z.object({matches:z.array(z.object({index:z.number().int().nonnegative(),relation:z.enum(['same','different_spec','related','uncertain']),currentQuote:z.string(),candidateQuote:z.string(),reason:z.string().max(600)})).max(8)}).parse(result.value).matches;
 return candidates.map((m,index)=>{
  const r=rows.find(r=>r.index===index);if(!r)return {id:m.id,relation:'uncertain' as const,reason:'判别结果不完整'};
  let relation=r.relation;
  const specification=m.attributes.specification,model=m.attributes.model;
  const quoteOK=r.currentQuote.length>=2&&r.candidateQuote.length>=2&&current.name.includes(r.currentQuote)&&[m.title,...m.aliases].some(t=>t.includes(r.candidateQuote));
  const missing=(!!specification&&!current.facts.specification&&!normMemory(current.name).includes(normMemory(specification)))||(!!model&&!current.facts.model&&!normMemory(current.name).includes(normMemory(model)));
  const conflict=specConflict(current.name+' '+(current.facts.specification||''),m.title+' '+(specification||''))||(!!model&&!!current.facts.model&&normMemory(model)!==normMemory(current.facts.model))||(!!m.attributes.brand&&!!current.facts.brand&&normMemory(m.attributes.brand)!==normMemory(current.facts.brand));
  if(conflict)relation='different_spec';else if(relation==='same'&&(!quoteOK||missing||normMemory(current.name)===normMemory(current.merchant)))relation='uncertain';
  return {id:m.id,relation,reason:conflict?'已识别的规格、品牌或型号不一致':missing?'缺少区分同款所需的规格或型号':r.reason};
 });
}
