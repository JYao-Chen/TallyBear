export function validCalendarValue(value:string,type:'date'|'month'){
 if(!(type==='month'?/^\d{4}-\d{2}$/:/^\d{4}-\d{2}-\d{2}$/).test(value))return false;
 const [year,month,day=1]=value.split('-').map(Number);
 return year>=1&&year<=9999&&month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate();
}
export function calendarDays(year:number,month:number){
 const first=new Date(0);first.setUTCFullYear(year,month,1);first.setUTCHours(0,0,0,0);
 const offset=(first.getUTCDay()+6)%7;
 return Array.from({length:42},(_,i)=>{const d=new Date(first);d.setUTCDate(1-offset+i);return {value:`${String(d.getUTCFullYear()).padStart(4,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`,day:d.getUTCDate(),current:d.getUTCMonth()===month};});
}
