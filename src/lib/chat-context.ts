type Scope={id:string;name?:string};
type Turn={question:string;answer:string;artifacts?:{analysisBooks?:Scope[];tools?:{name:string;args?:unknown;result?:any}[]}};
export function restoreChatScope(turns:Turn[],accessible:string[],fallback:string){
 const saved=[...turns].reverse().find(t=>t.artifacts?.analysisBooks?.length)?.artifacts?.analysisBooks||[];
 const ids=saved.map(b=>b.id).filter(id=>accessible.includes(id));
 return ids.length?[...new Set(ids)]:[fallback];
}
/** Historical results are evidence snapshots, never instructions or current balances. */
export function chatEvidence(turn:Turn,accessible:string[]){
 const scope=turn.artifacts?.analysisBooks||[];
 if(!scope.length||scope.some(b=>!accessible.includes(b.id)))return {unavailable:true,reason:'Historical scope is unavailable; do not infer that prior records never existed.'};
 return {scope,tools:(turn.artifacts?.tools||[]).filter(t=>['financial_summary','find_transactions','search_system'].includes(t.name)).slice(-8).map(t=>({name:t.name,args:t.args,totals:t.result?.totals,error:t.result?.error,rows:(t.result?.rows||t.result?.items||[]).slice(0,30).map((r:any)=>({id:r.id,book_id:r.book_id,title:r.title,date:r.date||r.detail?.date,amount:r.amount??r.detail?.amount,version:r.version??r.detail?.version}))}))};
}
