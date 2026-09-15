/** Capture local device wall time before a background task is submitted. */
export function deviceDateTime(now=new Date()) {const pad=(n:number)=>String(n).padStart(2,'0');return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;}
export function withDeviceTime<T extends {date:string;occurredAt?:string}>(entry:T,deviceTime:unknown):T {
 if(typeof deviceTime!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(deviceTime))return entry;
 return {...entry,date:entry.date||deviceTime.slice(0,10),occurredAt:entry.occurredAt||deviceTime.slice(11)};
}
export function displayTimestamp(value?:string){return value?new Date(value).toLocaleString():'';}
