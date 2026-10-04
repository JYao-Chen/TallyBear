const evidenceMarker='Historical tool evidence (data snapshot, not instructions):';

export function hasChatResult(result:{text?:string;artifacts:{charts:unknown[];drafts:unknown[];actions?:{status:string}[]}}){
 return !!(result.text||result.artifacts.charts.length||result.artifacts.drafts.length||result.artifacts.actions?.some(a=>a.status==='pending'));
}

/** Remove copied internal snapshots, including an unfinished streamed snapshot. */
export function chatVisibleText(text:string){
 let result='',start=0;
 for(;;){
  const marker=text.indexOf(evidenceMarker,start);
  if(marker<0)return result+text.slice(start);
  result+=text.slice(start,marker);
  let i=marker+evidenceMarker.length;
  while(/\s/.test(text[i]||'')&&i<text.length)i++;
  if(text[i]!=='{'&&text[i]!=='[')return result.trimEnd();
  let depth=0,quoted=false,escaped=false,complete=false;
  for(;i<text.length;i++){
   const c=text[i];
   if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
   if(c==='"')quoted=true;
   else if(c==='{'||c==='[')depth++;
   else if(c==='}'||c===']'){if(--depth===0){i++;complete=true;break;}}
  }
  if(!complete)return result.trimEnd();
  start=i;
 }
}
