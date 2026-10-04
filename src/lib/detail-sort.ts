export const detailSorts=['date_desc','date_asc','amount_desc','amount_asc'] as const;
export type DetailSort=typeof detailSorts[number];
export function detailSort(value:string|null|undefined):DetailSort{return detailSorts.includes(value as DetailSort)?value as DetailSort:'date_desc';}
// Expressions are supplied by query builders, never by request parameters.
export function detailOrder(value:string,amount='amount',id='id',time=true,prefix=''){
 const sort=detailSort(value),direction=sort.endsWith('_asc')?'ASC':'DESC';
 const chronological=`${prefix}date ${direction},${time?`COALESCE(NULLIF(${prefix}occurred_at,''),to_char(${prefix}created_at AT TIME ZONE 'Asia/Shanghai','HH24:MI:SS')) ${direction},`:''}${prefix}created_at ${direction},${id} ${direction}`;
 return sort.startsWith('amount')?`abs(${amount}) ${direction} NULLS LAST,${prefix}date DESC,${prefix}created_at DESC,${id} DESC`:chronological;
}
export function sortDetails<T>(rows:T[],value:DetailSort,fields:(row:T)=>{date:string;time?:string|null;created?:string|Date|null;amount:number|null;id:string}){
 return [...rows].sort((a,b)=>{
  const x=fields(a),y=fields(b),direction=value.endsWith('_asc')?1:-1;
  if(value.startsWith('amount')){if(x.amount===null||y.amount===null){if(x.amount!==y.amount)return x.amount===null?1:-1;}else{const n=Math.abs(x.amount)-Math.abs(y.amount);if(n)return n*direction;}}
  const stamp=(v:typeof x)=>v.date+'T'+(v.time|| (v.created?new Date(v.created).toLocaleTimeString('en-GB',{timeZone:'Asia/Shanghai',hour12:false}):''));
  const d=stamp(x).localeCompare(stamp(y))||String(x.created||'').localeCompare(String(y.created||''))||x.id.localeCompare(y.id);
  return d*(value.startsWith('amount')?-1:direction);
 });
}
