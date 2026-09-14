import {deployment} from './deployment';
import type {AccountIdentity} from './accounts';
import Papa from 'papaparse';
import {amountToCents} from '../server/model';
import type {Draft} from '../components/DraftReview';
export function decodeBill(bytes:ArrayBuffer){try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),encoding:'UTF-8'};}catch{try{return {text:new TextDecoder('gb18030',{fatal:true}).decode(bytes),encoding:'GB18030 / GBK'};}catch{throw new Error('无法读取文件编码，请重新导出CSV账单');}}}
export function parseBill(text:string,accounts:(AccountIdentity&{id:string})[],newId:()=>string){
 if(deployment().currency!=='CNY')throw new Error('WeChat and Alipay bill imports require CNY. No currency conversion is performed.');
 const parsed=Papa.parse<string[]>(text,{skipEmptyLines:true});const rows=parsed.data;
 const header=rows.findIndex(r=>r.some(c=>/^(交易时间|交易创建时间|交易日期)$/.test(c.trim()))&&r.some(c=>/金额/.test(c)));
 if(header<0)throw new Error('未找到微信或支付宝的日期、金额表头，请选择导出的CSV账单');
 const headings=rows[header].map(s=>s.trim()),get=(row:string[],pattern:RegExp)=>row[headings.findIndex(h=>pattern.test(h))]?.trim()||'';
 const entries:Draft[]=[],warnings:string[]=[];let skipped=0;
 if(parsed.errors.some(e=>e.type==='Quotes'))throw new Error('CSV引号格式不完整，请重新导出，避免误读金额');
 for(let n=header+1;n<rows.length;n++){
  const r=rows[n],direction=get(r,/^(收\/支|收支|收支类型)$/),status=get(r,/^(交易状态|当前状态)$/),type=get(r,/^交易类型$/),time=get(r,/^(交易时间|交易创建时间|交易日期)$/);
  if(!direction&&!time)continue;
  if(/关闭|失败|未支付|待支付|退款中|退款申请|处理中/.test(status)){skipped++;continue;}
  const refunded=/退款|退回/.test(status+' '+type)&&direction!=='支出';
  if(!['收入','支出'].includes(direction)&&!refunded){skipped++;if(!/不计收支|不计收入支出|其他|中性/.test(direction))warnings.push(`第${n+1}行收支类型不明确，未自动导入`);continue;}
  let amount=0;try{amount=amountToCents(get(r,/金额/).replace(/[¥￥,\s]/g,''));}catch{warnings.push(`第${n+1}行金额需补充`);}
  let date=time.slice(0,10).replace(/\//g,'-');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date){date='';warnings.push(`第${n+1}行日期需补充`);}
  const method=get(r,/^(支付方式|收\/付款方式|收付款方式)$/);const account=matchBillAccount(method,accounts);
  const product=get(r,/^(商品|商品名称|商品说明)$/),note=get(r,/^备注$/);
  entries.push({id:newId(),kind:refunded?'refund':direction==='收入'?'income':'expense',date,amount,accountId:account?.id||'',payee:get(r,/^(交易对方|对方名称)$/).slice(0,120),category:'其他',product:product.slice(0,160),note:[product.length>160?'商品原文：'+product:'',note,!account?'原支付方式：'+(method||'未提供'):''].filter(Boolean).join('；').slice(0,2000),externalId:get(r,/^(交易单号|交易号)$/)||undefined,orderId:get(r,/^(商户单号|商家订单号)$/),source:`CSV 第${n+1}行`,status:'paid'});
 }
 if(!entries.length)throw new Error('没有可导入的已完成收支；未支付或不计收支的记录不会自动记账');
 if(entries.length>1000)throw new Error('本文件超过1000笔，请按月份分批导出后导入');
 return {entries,skipped,warnings};
}

export function matchBillAccount(method:string,accounts:(AccountIdentity&{id:string})[]){
 if(!method)return undefined;
 const bank=/银行|储蓄卡|信用卡/.test(method);
 const eligible=bank?accounts.filter(a=>a.type==='bank'||a.type==='credit'||/银行|储蓄卡|信用卡/.test(a.name)||!!a.institution):accounts;
 const explicitTail=method.match(/(?:尾号\s*|[（(])(\d{4})(?:[）)]|$)/)?.[1];
 if(explicitTail){const matches=eligible.filter(a=>a.suffix===explicitTail);return matches.length===1?matches[0]:undefined;}
 const tails=eligible.filter(a=>a.suffix&&new RegExp('(^|[^0-9])'+a.suffix+'([^0-9]|$)').test(method));
 if(tails.length)return tails.length===1?tails[0]:undefined;
 let matches=eligible.filter(a=>!!a.name&&method.includes(a.name)||!!a.institution&&method.includes(a.institution));
 if(!matches.length&&!bank){
  if(/零钱|微信/.test(method))matches=accounts.filter(a=>a.type==='wechat'||a.name==='微信');
  else if(/^余额$|余额宝|支付宝/.test(method))matches=accounts.filter(a=>a.type==='alipay'||a.name==='支付宝');
 }
 return matches.length===1?matches[0]:undefined;
}
