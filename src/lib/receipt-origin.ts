import {z} from 'zod';
const clue=z.object({name:z.string().max(60).default(''),basis:z.enum(['explicit','visual','unknown']).default('unknown'),cues:z.array(z.string().max(160)).max(6).default([])});
export const receiptOriginSchema=z.object({orderPlatform:clue.default({name:'',basis:'unknown',cues:[]}),paymentChannel:clue.default({name:'',basis:'unknown',cues:[]}),funding:z.object({type:z.enum(['wechat_balance','alipay_balance','bank','credit','unknown']).default('unknown'),institution:z.string().max(60).default(''),suffix:z.string().max(8).default(''),evidence:z.string().max(200).default('')}).default({type:'unknown',institution:'',suffix:'',evidence:''})});
export type ReceiptOrigin=z.infer<typeof receiptOriginSchema>;
export const receiptOriginInstructions=`Identify the screenshot origin visually, even without a written app name. Return receiptOrigin: {orderPlatform:{name:"",basis:"explicit|visual|unknown",cues:[]},paymentChannel:{name:"",basis:"explicit|visual|unknown",cues:[]},funding:{type:"wechat_balance|alipay_balance|bank|credit|unknown",institution:"",suffix:"",evidence:""}} with each entry. Use app logos, distinctive transaction-detail layout, navigation, icons and field patterns together. Supported examples include WeChat/微信, Alipay/支付宝, Douyin/抖音, JD/京东, Pinduoduo/拼多多, Taobao/淘宝, Meituan/美团, Ele.me/饿了么; this is not an exhaustive list. Colour alone, phone status-bar notifications, advertisements, a product logo or a merchant accepting a payment method are NOT source evidence. Visual classification requires at least two independent distinctive cues, or one unambiguous app logo in the actual transaction UI. Ambiguous/cropped evidence remains unknown; do not guess from merchant or history. The order platform is where an order was placed, the payment channel processes the payment, and the funding wallet is where money was actually debited. A JD/Douyin order does not imply Baitiao/Douyin Pay; a WeChat/Alipay payment page does not prove wallet balance. Only set funding when the actual payment-method line or the user's explicit statement identifies it (零钱=wechat_balance, 余额=alipay_balance, bank/last digits=bank, 花呗/白条/credit card=credit). When funding is unknown, the application may preselect a single matching personal WeChat or Alipay wallet as a reviewable default; never describe that default as proof of the final funding source. A bank logo in an ad is not payment evidence. For refunds distinguish actual refund destination from original payment method; if not explicit funding stays unknown. For split payments funding stays unknown, never assign the entire amount to one source. Preserve a visible bank suffix exactly. Use platform for the known orderPlatform, otherwise the known paymentChannel. Complementary screenshots of the same verified order may supply platform and payment details separately. Put recognition cues only in receiptOrigin, not note/message. Leave accountId empty and targetId null; the application matches authorized wallets separately. Use the configured response language for cues and preserve recognizable platform/bank names.`;
const norm=(s:string)=>(s||'').toLowerCase().replace(/[\s·（）()_-]/g,'');
export function usableClue(c?:ReceiptOrigin['orderPlatform']){return !!c?.name&&c.basis!=='unknown'&&c.cues.some(s=>s.trim());}
export function receiptPlatform(origin?:ReceiptOrigin){return usableClue(origin?.orderPlatform)?origin!.orderPlatform.name:usableClue(origin?.paymentChannel)?origin!.paymentChannel.name:'';}
type Wallet={id:string;name:string;type?:string;institution?:string;suffix?:string;owner_id?:string|null;archived?:boolean};
export function matchReceiptWallet(origin:ReceiptOrigin|undefined,wallets:Wallet[],user:string){
 let candidates=wallets.filter(a=>!a.archived&&a.owner_id===user);
 const f=origin?.funding;
 if(f?.type==='unknown'&&f.evidence.trim())return {accountId:'',candidates:[] as string[],basis:'' as const};
 if(!f||f.type==='unknown'||!f.evidence.trim()){
  const channel=usableClue(origin?.paymentChannel)?norm(origin!.paymentChannel.name):'';
  const type=channel.includes('微信')||channel.includes('wechat')?'wechat':channel.includes('支付宝')||channel.includes('alipay')?'alipay':'';
  if(!type)return {accountId:'',candidates:[] as string[],basis:'' as const};
  candidates=candidates.filter(a=>a.type===type);
  return {accountId:candidates.length===1?candidates[0].id:'',candidates:candidates.map(a=>a.id),basis:'channel' as const};
 }
 if(f.type==='wechat_balance')candidates=candidates.filter(a=>a.type==='wechat');
 else if(f.type==='alipay_balance')candidates=candidates.filter(a=>a.type==='alipay');
 else candidates=candidates.filter(a=>f.type==='bank'?a.type==='bank':a.type==='credit');
 if(f.institution)candidates=candidates.filter(a=>norm(a.institution||a.name).includes(norm(f.institution)));
 if(f.suffix)candidates=candidates.filter(a=>a.suffix===f.suffix);
 // A generic card reference does not identify a particular bank account, even if only one exists.
 if(['bank','credit'].includes(f.type)&&!f.suffix&&!f.institution)return {accountId:'',candidates:candidates.map(a=>a.id),basis:'funding' as const};
 return {accountId:candidates.length===1?candidates[0].id:'',candidates:candidates.map(a=>a.id),basis:'funding' as const};
}
export function mergeReceiptOrigins(a?:ReceiptOrigin,b?:ReceiptOrigin):ReceiptOrigin|undefined{
 if(!a)return b;if(!b)return a;
 const mergeClue=(x:ReceiptOrigin['orderPlatform'],y:ReceiptOrigin['orderPlatform'])=>{if(!usableClue(x))return y;if(!usableClue(y))return x;if(norm(x.name)===norm(y.name))return {...(x.basis==='explicit'?x:y),cues:[...new Set([...x.cues,...y.cues])].slice(0,6)};if(x.basis!==y.basis)return x.basis==='explicit'?x:y;return {name:'',basis:'unknown' as const,cues:[]};};
 const x=a.funding,y=b.funding;let funding=x;
 if(x.type==='unknown'||!x.evidence)funding=y;
 else if(y.type!=='unknown'&&y.evidence){if(x.type!==y.type||x.suffix&&y.suffix&&x.suffix!==y.suffix||x.institution&&y.institution&&norm(x.institution)!==norm(y.institution))funding={type:'unknown',institution:'',suffix:'',evidence:'扣款证据冲突'};else funding={type:x.type,institution:x.institution||y.institution,suffix:x.suffix||y.suffix,evidence:[x.evidence,y.evidence].join('；').slice(0,200)};}
 return {orderPlatform:mergeClue(a.orderPlatform,b.orderPlatform),paymentChannel:mergeClue(a.paymentChannel,b.paymentChannel),funding};
}
