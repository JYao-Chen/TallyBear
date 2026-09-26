import {z} from 'zod';
const text=z.preprocess(value=>value===null?'':value,z.string().trim().max(80).default(''));
export const sceneSchema=z.object({type:z.enum(['general','transport','dining','shopping','groceries']).default('general'),transport:text,origin:text,destination:text,merchant:text,branch:text,meal:text,summary:text,diningMode:z.preprocess(value=>value===null?'unknown':value,z.enum(['delivery','dine_in','takeaway','unknown'])).optional(),purchaseGroup:z.string().uuid().optional()}).default({});
export type EntryScene=z.infer<typeof sceneSchema>;
export const emptyScene=()=>sceneSchema.parse({});
export function sceneTitle(s:EntryScene,english=false){
 const join=(parts:string[])=>parts.filter(Boolean).join(' · ').slice(0,80);
 if(s.type==='transport')return join([s.transport|| (english?'Transport':'交通'),s.origin&&s.destination?`${s.origin} → ${s.destination}`:s.origin||s.destination]);
 if(s.type==='dining'&&s.diningMode==='delivery')return s.summary|| (english?'Food delivery':'外卖');
 if(s.type==='dining')return join([s.merchant,s.branch,s.meal|| (english?'Dining':'用餐')]);
 if(s.type==='shopping'||s.type==='groceries')return join([s.merchant,s.branch,s.summary|| (s.type==='groceries'?(english?'Groceries':'买菜'):(english?'Shopping':'购物'))]);
 return '';
}
export const sceneInstructions=`Return scene for each entry: {type: general|transport|dining|shopping|groceries, transport: transport mode, origin: departure station, destination: arrival station, merchant: concise visible merchant name, branch: visible branch name, meal: explicitly known meal type, summary: concise product category}. All fields except type are strings; unknown fields must be empty. Extract only current source evidence, never infer route/time/meal from history or price. Do not insert placeholders into titles. Use general for unrelated income/transfers. Preserve original detail in product/lineItems. Write scene text in deployment language, preserve proper names.`;

export const diningInstructions='Identify diningMode from current evidence: delivery for explicit food delivery orders (外卖, delivery address/rider), dine_in for explicit on-site dining, takeaway for pickup, unknown otherwise. A platform such as Meituan alone does not prove delivery. For delivery, title and scene.summary must be the concise actual food/drink names, not the store. Preserve merchant in payee/scene.merchant. For dine-in retain merchant-led titles. Never infer food names when unavailable. Never return purchaseGroup; it is assigned by the server from confirmed purchase history.';
