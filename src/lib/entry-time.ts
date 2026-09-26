/** Capture local device wall time before a background task is submitted. */
export function deviceDateTime(now=new Date()) {const pad=(n:number)=>String(n).padStart(2,'0');return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;}
export function validEntryDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function recordingDate(){return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});}
/** Keep the precision actually present in the source; never invent seconds. */
export function normalizeTransactionTime(value:unknown):string {
 if(typeof value!=='string')return '';
 const text=value.trim();
 const match=text.match(/^(?:(\d{4}-\d{2}-\d{2})[T ])?([01]?\d|2[0-3])[:：]([0-5]\d)(?:[:：]([0-5]\d))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/);
 if(!match||match[1]&&!validEntryDate(match[1]))return '';
 return match[2].padStart(2,'0')+':'+match[3]+(match[4]!==undefined?':'+match[4]:'');
}
export function withDeviceTime<T extends {date:string;occurredAt?:string}>(entry:T,deviceTime:unknown):T {
 const submitted=typeof deviceTime==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(deviceTime)?deviceTime.slice(0,10):'';
 return {...entry,date:validEntryDate(entry.date)?entry.date:validEntryDate(submitted)?submitted:recordingDate(),occurredAt:normalizeTransactionTime(entry.occurredAt)};
}
export const transactionTimeInstructions='交易日期 date 只能是有效的 YYYY-MM-DD；无法确定完整年月日则留空，由系统使用记账日期。交易时间 occurredAt 与日期严格分开，只能是 HH:mm:ss；仅有时分则保留 HH:mm，不补造秒；无法识别则空字符串。禁止上周、最近、上午等自由文本，不要把年月日写入 occurredAt，不要用当前时间替代未知的交易时间。';
export function displayTimestamp(value?:string){return value?new Date(value).toLocaleString():'';}
