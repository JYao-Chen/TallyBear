import {transaction} from './db';
import {validSources} from './cost-projects';
import {calculateCostPlan,intersectAmount} from '@/lib/cost-attribution';
import {movementReportSource} from './movement-report';
import {advancePeriod,periodShare} from '@/lib/period';

// Projections only. No synthetic transaction is written and no wallet is charged.
export async function unifiedExpenseSource(books:string[],from:string,to:string,values:unknown[]){
 const payload=await transaction(async c=>{
  const projects=(await c.query(`SELECT p.* FROM cost_projects p WHERE p.active_plan IS NOT NULL AND (
   EXISTS(SELECT 1 FROM cost_source_claims s JOIN transactions t ON COALESCE(t.event_id,t.id)=s.event_id WHERE s.project_id=p.id AND t.book_id=ANY($1::uuid[]))
   OR EXISTS(SELECT 1 FROM cost_project_members m WHERE m.project_id=p.id AND m.display_book_id=ANY($1::uuid[]))
   OR EXISTS(SELECT 1 FROM cost_project_members m JOIN books b ON b.owner_id=m.user_id AND b.kind='private' WHERE m.project_id=p.id AND m.display_book_id IS NULL AND b.id=ANY($1::uuid[]))
  ) ORDER BY p.id`,[books])).rows;
  const claims:{event:string;amount:number}[]=[],rows:any[]=[],excluded:string[]=[],refunds:string[]=[];
  const until=new Date(Date.parse(to)+86400000).toISOString().slice(0,10);
  for(const p of projects){
   if(p.active_stale||!await validSources(c,p)){excluded.push(p.title);continue;}
   const {plan,periods}=calculateCostPlan(p.active_plan);
   const sharedBooks=new Set<string>();
   for(const s of plan.sources){const original=(await c.query('SELECT COALESCE(event_id,id) AS event FROM transactions WHERE id=$1',[s.transactionId])).rows[0];claims.push({event:original.event,amount:s.amount});
    for(const b of (await c.query("SELECT DISTINCT t.book_id FROM transactions t JOIN books b ON b.id=t.book_id WHERE COALESCE(t.event_id,t.id)=$1 AND NOT t.deleted AND b.kind='shared' AND t.book_id=ANY($2::uuid[])",[original.event,books])).rows)sharedBooks.add(b.book_id);
   }
   const members=(await c.query(`SELECT m.user_id,COALESCE(m.display_book_id,(SELECT b.id FROM books b JOIN members bm ON bm.book_id=b.id AND bm.user_id=m.user_id WHERE b.owner_id=m.user_id AND b.kind='private' ORDER BY b.created_at,b.id LIMIT 1)) AS book_id
    FROM cost_project_members m WHERE m.project_id=$1 AND (m.user_id=$2 OR EXISTS(SELECT 1 FROM family_members f WHERE f.family_id=$3 AND f.user_id=m.user_id))`,[p.id,p.owner_id,p.family_id])).rows;
   for(const m of members){const destinations=new Set([...sharedBooks,...(books.includes(m.book_id)?[m.book_id]:[])]);if(!destinations.size)continue;
    for(const period of periods){const start=period.start>from?period.start:from,end=period.end<until?period.end:until;
     if(end<=start)continue;const amount=intersectAmount(period.shares.find(s=>s.userId===m.user_id)?.amount||0,period.start,period.end,start,end);if(!amount)continue;
     for(const bookId of destinations)rows.push({id:p.id,book_id:bookId,created_by:m.user_id,kind:'expense',amount,date:start,title:plan.title,category:plan.category,payee:'',note:'',line_items:[],scene:{},deleted:false,version:p.version,created_at:p.created_at,updated_at:p.updated_at,cost_project_id:p.id,cost_period_end:end,cost_row_key:`${p.id}:${m.user_id}:${period.start}`});
    }
   }
  }
  // Existing single-entry allocations join the same report rather than retaining a second total.
  const legacy=(await c.query(`SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.*,COALESCE(t.event_id,t.id) AS event,
   to_char(COALESCE(a.start_date,a.start_month),'YYYY-MM-DD') AS start,a.period_unit,COALESCE(a.period_count,a.months) AS period_count
   FROM expense_allocations a JOIN transactions t ON t.id=a.transaction_id WHERE NOT t.deleted AND t.kind='expense'
   AND EXISTS(SELECT 1 FROM transactions copy WHERE COALESCE(copy.event_id,copy.id)=COALESCE(t.event_id,t.id) AND NOT copy.deleted AND copy.book_id=ANY($1::uuid[]))
   ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id`,[books])).rows;
  for(const t of legacy){
   if(claims.some(s=>s.event===t.event))continue;
   const returned=(await c.query(`SELECT DISTINCT ON(COALESCE(r.event_id,r.id)) COALESCE(r.event_id,r.id) AS event,r.amount FROM transactions r JOIN transactions original ON original.id=r.refund_of WHERE COALESCE(original.event_id,original.id)=$1 AND NOT r.deleted AND r.kind='refund' ORDER BY COALESCE(r.event_id,r.id),r.created_at,r.id`,[t.event])).rows;
   const net=Number(t.amount)-returned.reduce((n,r)=>n+Number(r.amount),0);
   refunds.push(...returned.map(r=>r.event));claims.push({event:t.event,amount:Number(t.amount)});
   const copies=(await c.query('SELECT id,book_id,created_by FROM transactions WHERE COALESCE(event_id,id)=$1 AND NOT deleted AND book_id=ANY($2::uuid[])',[t.event,books])).rows;
   const finish=advancePeriod(t.start,t.period_unit,t.period_count);
   for(let month=from.slice(0,7)+'-01';month<=to;month=advancePeriod(month,'month',1)){
    const monthEnd=advancePeriod(month,'month',1),start=[month,t.start,from].sort().at(-1)!,end=[monthEnd,finish,until].sort()[0];if(end<=start)continue;
    const monthAmount=periodShare(Math.abs(net),t.start,t.period_unit,t.period_count,month.slice(0,7));
    const periodStart=month>t.start?month:t.start,periodEnd=monthEnd<finish?monthEnd:finish;
    const amount=intersectAmount(monthAmount,periodStart,periodEnd,start,end);if(!amount)continue;
    for(const copy of copies)rows.push({...t,id:copy.id,event_id:null,book_id:copy.book_id,created_by:copy.created_by,account_id:null,target_id:null,amount,kind:net<0?'refund':'expense',date:start,occurred_at:'',line_items:[],cost_period_end:end,cost_row_key:`legacy:${t.event}:${month}`});
   }
  }
  return {claims,rows,excluded,refunds};
 });
 values.push(JSON.stringify(payload));const arg='$'+values.length;
 const source=movementReportSource.replace('ledger_source AS','cash_source AS');
 return {excluded:payload.excluded,source:`${source}, cost_payload AS(SELECT ${arg}::jsonb AS data), cost_claims AS(
 SELECT (j->>'event')::uuid AS event,sum((j->>'amount')::bigint) AS amount FROM cost_payload,jsonb_array_elements(data->'claims') j GROUP BY 1
 ), ledger_source AS (
 SELECT (jsonb_populate_record(NULL::transactions,to_jsonb(t)||jsonb_build_object('amount',CASE WHEN t.kind='expense' THEN GREATEST(0,t.amount-COALESCE(c.amount,0)) ELSE t.amount END))).*,
 t.family_movement_id,t.movement_family_id,t.movement_status,NULL::uuid AS cost_project_id,NULL::date AS cost_period_end,NULL::text AS cost_row_key,t.amount AS actual_amount
 FROM cash_source t LEFT JOIN cost_claims c ON c.event=COALESCE(t.event_id,t.id)
 WHERE (t.kind<>'expense' OR t.amount>COALESCE(c.amount,0)) AND NOT EXISTS(SELECT 1 FROM cost_payload,jsonb_array_elements_text(data->'refunds') r WHERE r::uuid=COALESCE(t.event_id,t.id))
 UNION ALL
 SELECT (jsonb_populate_record(NULL::transactions,j)).*,NULL::uuid,NULL::uuid,NULL::text,(j->>'cost_project_id')::uuid,(j->>'cost_period_end')::date,j->>'cost_row_key',NULL::bigint
 FROM cost_payload,jsonb_array_elements(data->'rows') j
 )`};
}
