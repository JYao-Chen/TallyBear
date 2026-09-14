export function nextOccurrence(date:string,frequency:'weekly'|'monthly'|'yearly',anchorDay:number,intervalMonths=0){
 const [y,m,d]=date.split('-').map(Number);let next:Date;
 if(frequency==='weekly')next=new Date(Date.UTC(y,m-1,d+7));else{const year=y,month=m-1+(intervalMonths||(frequency==='yearly'?12:1));const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();next=new Date(Date.UTC(year,month,Math.min(anchorDay,last)));}
 return next.toISOString().slice(0,10);
}
