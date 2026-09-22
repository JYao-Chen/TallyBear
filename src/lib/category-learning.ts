import {z} from 'zod';
import type {EntryScene} from './entry-scene';

export const categorySuggestionSchema=z.object({
 originalCategory:z.string().max(60),
 category:z.string().max(60),
 confidence:z.number().min(0).max(1),
 basis:z.enum(['template','route','merchant_context','merchant','context']),
 evidenceCount:z.number().int().nonnegative()
});
export type CategorySuggestion=z.infer<typeof categorySuggestionSchema>;
export type CategoryInput={kind:string;payee:string;category:string;scene:EntryScene;title?:string;product?:string;platform?:string;lineItems?:{name:string}[];categorySource?:'explicit'|'model'};
export type CategoryEvidence={id:string;category:string;kind:string;payee:string;scene:EntryScene;title?:string;product?:string;lineItems?:{name:string}[];source:'template'|'correction'|'manual'|'accepted'|'legacy';at?:string|Date|null};

const paymentPlatforms=new Set(['微信','微信支付','支付宝','alipay','wechat','wechatpay']);
export const normalizeMerchant=(value:string)=>(value||'').toLowerCase().replace(/[\s·・,，.。()（）\[\]【】_-]/g,'');
function merchants(value:{payee:string;scene:EntryScene}){
 const values=[value.payee,value.scene?.merchant].map(normalizeMerchant).filter(v=>v&&!paymentPlatforms.has(v));
 return new Set(values);
}
function route(value:{scene:EntryScene}){
 const s=value.scene;if(s?.type!=='transport'||!s.origin||!s.destination)return '';
 return [s.transport,s.origin,s.destination].map(normalizeMerchant).join('|');
}
function tokens(value:{title?:string;product?:string;lineItems?:{name:string}[];scene:EntryScene}){
 const text=[value.title,value.product,...(value.lineItems||[]).map(v=>v.name),value.scene?.meal,value.scene?.transport].filter(Boolean).join(' ').toLowerCase();
 const result=new Set<string>();
 for(const word of text.match(/[a-z0-9]+|[\u3400-\u9fff]+/g)||[]){
  if(word.length<=1)continue;
  if(/^[\u3400-\u9fff]+$/.test(word)){if(word.length<=8)result.add(word);for(let i=0;i<word.length-1;i++)result.add(word.slice(i,i+2));}
  else result.add(word);
 }
 return result;
}
function similarity(a:Set<string>,b:Set<string>){if(!a.size||!b.size)return 0;let shared=0;for(const value of a)if(b.has(value))shared++;return shared/Math.max(1,Math.min(a.size,b.size));}
function intersects(a:Set<string>,b:Set<string>){for(const value of a)if(b.has(value))return true;return false;}
const sourceWeight={template:6,correction:4,manual:2.5,accepted:1.5,legacy:1} as const;
function recency(at:CategoryEvidence['at']){if(!at)return .6;const time=new Date(at).getTime();if(!Number.isFinite(time))return .6;const days=Math.max(0,(Date.now()-time)/86400000);return Math.max(.35,Math.pow(.5,days/365));}

export function recommendCategory(input:CategoryInput,evidence:CategoryEvidence[],validCategories:Set<string>):CategorySuggestion|null{
 if(input.categorySource==='explicit'||input.kind==='transfer'||input.kind==='refund')return null;
 const ownMerchants=merchants(input),ownRoute=route(input),ownTokens=tokens(input);
 const valid=evidence.filter(row=>row.kind===input.kind&&validCategories.has(row.category));
 const enriched=valid.map(row=>({row,merchant:intersects(ownMerchants,merchants(row)),route:!!ownRoute&&route(row)===ownRoute,similarity:similarity(ownTokens,tokens(row))}));
 const routeMatches=enriched.filter(v=>v.route);
 const merchantMatches=enriched.filter(v=>v.merchant);
 const merchantContext=merchantMatches.filter(v=>v.similarity>=.35);
 const pool=routeMatches.length?routeMatches:merchantContext.length>=2?merchantContext:merchantMatches.length?merchantMatches:enriched.filter(v=>v.similarity>=.35&&v.row.scene?.type===input.scene?.type);
 if(!pool.length)return null;
 let basis:CategorySuggestion['basis']=routeMatches.length?'route':merchantContext.length>=2?'merchant_context':merchantMatches.length?'merchant':'context';
 const totals=new Map<string,{weight:number;count:number;strong:boolean}>();
 for(const item of pool){const semantic=1+Math.min(1,item.similarity);const weight=sourceWeight[item.row.source]*recency(item.row.at)*semantic;const current=totals.get(item.row.category)||{weight:0,count:0,strong:false};current.weight+=weight;current.count++;current.strong||=item.row.source==='template'||item.row.source==='correction';totals.set(item.row.category,current);}
 const ranked=[...totals].sort((a,b)=>b[1].weight-a[1].weight);const total=ranked.reduce((sum,v)=>sum+v[1].weight,0);const [category,top]=ranked[0];if(pool.some(v=>v.row.source==='template'&&v.row.category===category))basis='template';const share=top.weight/total;const second=ranked[1]?.[1].weight/total||0;let confidence=share*(.65+.35*(1-Math.exp(-top.count/3)));
 if(top.strong&&share>=.67)confidence=Math.max(confidence,basis==='template'?.97:.9);
 const margin=share-second;const enough=top.strong&&share>=.67||top.count>=3&&share>=.72&&margin>=.3||top.count>=2&&share>=.85&&margin>=.5;
 if(!enough)return null;
 return {originalCategory:input.category,category,confidence:Math.round(confidence*100)/100,basis,evidenceCount:top.count};
}
