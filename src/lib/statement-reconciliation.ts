export type StatementRecord={id:string;kind:string;amount:number;date:string;payee?:string;title?:string;product?:string;platform?:string;orderId?:string;externalId?:string;occurredAt?:string;version?:number;[key:string]:unknown};
export type ReconciliationPair={statement:StatementRecord;ledger:StatementRecord;reason:string;confidence:'certain'|'sequence'|'likely'};
export type ReconciliationAmbiguity={statement:StatementRecord;ledger?:StatementRecord;reason:string};
export type StatementReconciliation={orientation:'as_shown'|'reversed';summary:{statement:number;ledger:number;matched:number;missing:number;ambiguous:number;ledgerOnly:number};matched:ReconciliationPair[];missing:StatementRecord[];ambiguous:ReconciliationAmbiguity[];ledgerOnly:StatementRecord[]};

const clean=(value?:string)=>String(value||'').toLowerCase().replace(/[\s·_\-—–()（）]/g,'');
const time=(value?:string)=>String(value||'').match(/(?:^|T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/)?.slice(1).join(':')||'';
const signature=(r:StatementRecord)=>[r.kind,r.date,r.amount,clean(r.payee||r.title)].join('|');
function evidence(a:StatementRecord,b:StatementRecord){
 const sameAmount=a.amount===b.amount,sameDate=!!a.date&&a.date===b.date,sameKind=a.kind===b.kind;
 const merchant=clean(a.payee||a.title),other=clean(b.payee||b.title),sameMerchant=!!merchant&&!!other&&(merchant===other||merchant.includes(other)||other.includes(merchant));
 if(a.externalId&&b.externalId&&a.externalId===b.externalId)return sameAmount&&sameKind?{score:22,reason:'交易流水号一致',strength:'id' as const}:{score:18,reason:'交易流水号一致，但金额或类型不同',strength:'conflict' as const};
 if(a.orderId&&b.orderId&&a.orderId===b.orderId&&(!a.platform||!b.platform||clean(a.platform)===clean(b.platform)))return sameAmount&&sameKind?{score:20,reason:'订单号一致',strength:'id' as const}:{score:16,reason:'订单号一致，但金额或类型不同',strength:'conflict' as const};
 if(!sameKind||!sameAmount||!sameDate)return {score:-8,reason:'',strength:'none' as const};
 const exactTime=time(a.occurredAt),otherTime=time(b.occurredAt);
 if(exactTime&&otherTime&&exactTime===otherTime)return {score:sameMerchant?16:14,reason:sameMerchant?'日期、金额、商家和时间一致':'日期、金额和时间一致',strength:'time' as const};
 if(sameMerchant)return {score:9,reason:'日期、金额和商家一致',strength:'signature' as const};
 return {score:4,reason:'日期和金额一致，但缺少唯一证据',strength:'weak' as const};
}
function align(statement:StatementRecord[],ledger:StatementRecord[]){
 const gap=-3,n=statement.length,m=ledger.length,score=Array.from({length:n+1},()=>new Int32Array(m+1)),trace=Array.from({length:n+1},()=>new Uint8Array(m+1));
 for(let i=1;i<=n;i++){score[i][0]=i*gap;trace[i][0]=1;}for(let j=1;j<=m;j++){score[0][j]=j*gap;trace[0][j]=2;}
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){const diagonal=score[i-1][j-1]+evidence(statement[i-1],ledger[j-1]).score,up=score[i-1][j]+gap,left=score[i][j-1]+gap;if(diagonal>=up&&diagonal>=left){score[i][j]=diagonal;trace[i][j]=3;}else if(up>=left){score[i][j]=up;trace[i][j]=1;}else{score[i][j]=left;trace[i][j]=2;}}
 const pairs:{si:number;li:number}[]=[],missing:number[]=[],ledgerOnly:number[]=[];let i=n,j=m;
 while(i||j){const move=trace[i][j];if(move===3){const e=evidence(statement[i-1],ledger[j-1]);if(e.score>=4)pairs.push({si:i-1,li:j-1});else{missing.push(i-1);ledgerOnly.push(j-1);}i--;j--;}else if(move===1){missing.push(i-1);i--;}else{ledgerOnly.push(j-1);j--;}}
 return {score:score[n][m],pairs:pairs.reverse(),missing:missing.reverse(),ledgerOnly:ledgerOnly.reverse()};
}
export function reconcileStatement(statement:StatementRecord[],ledgerInput:StatementRecord[]):StatementReconciliation{
 if(!statement.length)return {orientation:'as_shown',summary:{statement:0,ledger:0,matched:0,missing:0,ambiguous:0,ledgerOnly:ledgerInput.length},matched:[],missing:[],ambiguous:[],ledgerOnly:ledgerInput};
 const dates=statement.map(r=>r.date).filter(Boolean).sort(),ledger=dates.length?ledgerInput.filter(r=>r.date>=dates[0]&&r.date<=dates.at(-1)!):ledgerInput;
 const forward=align(statement,ledger),reversedLedger=[...ledger].reverse(),reverse=align(statement,reversedLedger),selected=reverse.score>forward.score?reverse:forward,orderedLedger=reverse.score>forward.score?reversedLedger:ledger;
 const statementCounts=new Map<string,number>(),ledgerCounts=new Map<string,number>();for(const r of statement)statementCounts.set(signature(r),(statementCounts.get(signature(r))||0)+1);for(const r of ledger)ledgerCounts.set(signature(r),(ledgerCounts.get(signature(r))||0)+1);
 const matched:ReconciliationPair[]=[],ambiguous:ReconciliationAmbiguity[]=[],accepted=new Set<number>();
 for(let p=0;p<selected.pairs.length;p++){
  const pair=selected.pairs[p],a=statement[pair.si],b=orderedLedger[pair.li],ev=evidence(a,b),duplicate=(statementCounts.get(signature(a))||0)>1||(ledgerCounts.get(signature(b))||0)>1;
  if(ev.strength==='id'||ev.strength==='time'){matched.push({statement:a,ledger:b,reason:ev.reason,confidence:'certain'});accepted.add(pair.si);continue;}
  if(ev.strength==='conflict'){ambiguous.push({statement:a,ledger:b,reason:ev.reason});continue;}
  if(ev.strength==='signature'&&!duplicate){matched.push({statement:a,ledger:b,reason:ev.reason,confidence:'likely'});accepted.add(pair.si);continue;}
  const before=selected.pairs.slice(Math.max(0,p-2),p).some(v=>['id','time'].includes(evidence(statement[v.si],orderedLedger[v.li]).strength)),after=selected.pairs.slice(p+1,p+3).some(v=>['id','time'].includes(evidence(statement[v.si],orderedLedger[v.li]).strength));
  if(ev.strength==='signature'&&before&&after){matched.push({statement:a,ledger:b,reason:'前后交易顺序吻合；'+ev.reason,confidence:'sequence'});accepted.add(pair.si);}else ambiguous.push({statement:a,ledger:b,reason:duplicate?'存在同日同额同商家记录，但前后缺少足够锚点':'只有日期和金额相同，不能认定为同一笔'});
 }
 const missing=selected.missing.map(i=>statement[i]).concat(selected.pairs.filter(p=>!accepted.has(p.si)&&!ambiguous.some(a=>a.statement===statement[p.si])).map(p=>statement[p.si]));
 const result={orientation:reverse.score>forward.score?'reversed' as const:'as_shown' as const,matched,missing,ambiguous,ledgerOnly:selected.ledgerOnly.map(i=>orderedLedger[i])};
 return {...result,summary:{statement:statement.length,ledger:ledger.length,matched:matched.length,missing:missing.length,ambiguous:ambiguous.length,ledgerOnly:result.ledgerOnly.length}};
}
