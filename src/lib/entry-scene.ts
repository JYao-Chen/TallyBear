import {z} from 'zod';
const text=z.preprocess(value=>value===null?'':value,z.string().trim().max(80).default(''));
export const sceneSchema=z.object({type:z.enum(['general','transport','dining','shopping','groceries']).default('general'),transport:text,origin:text,destination:text,merchant:text,branch:text,meal:text,summary:text}).default({});
export type EntryScene=z.infer<typeof sceneSchema>;
export const emptyScene=()=>sceneSchema.parse({});
export function sceneTitle(s:EntryScene,english=false){
 const join=(parts:string[])=>parts.filter(Boolean).join(' · ').slice(0,80);
 if(s.type==='transport')return join([s.transport|| (english?'Transport':'交通'),s.origin&&s.destination?`${s.origin} → ${s.destination}`:s.origin||s.destination]);
 if(s.type==='dining')return join([s.merchant,s.branch,s.meal|| (english?'Dining':'用餐')]);
 if(s.type==='shopping'||s.type==='groceries')return join([s.merchant,s.branch,s.summary|| (s.type==='groceries'?(english?'Groceries':'买菜'):(english?'Shopping':'购物'))]);
 return '';
}
export const sceneInstructions=`Return scene for each entry: {type: general|transport|dining|shopping|groceries, transport: transport mode, origin: departure station, destination: arrival station, merchant: concise visible merchant name, branch: visible branch name, meal: explicitly known meal type, summary: concise product category}. All fields except type are strings; unknown fields must be empty. Extract only current source evidence, never infer route/time/meal from history or price. Do not insert placeholders into titles. Use general for unrelated income/transfers. Preserve original detail in product/lineItems. Write scene text in deployment language, preserve proper names.`;
