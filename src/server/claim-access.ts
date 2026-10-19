import type {PoolClient} from 'pg';
import {Failure} from './access';
export async function assertClaimEditable(c:Pick<PoolClient,'query'>,id:string,user:string){
 const target=(await c.query(`SELECT 1 FROM expense_claim_links l JOIN expense_claims c ON c.id=l.claim_id WHERE l.target_id=$1 AND l.managed LIMIT 1`,[id])).rows[0];
 if(target)throw new Failure('这笔账来自认领，请在认领设置中调整账本或取消认领',403);
 const source=(await c.query(`SELECT 1 FROM transactions t JOIN expense_claims c ON c.event_id=COALESCE(t.event_id,t.id) AND c.status IN ('pending','accepted') WHERE t.id=$1 AND c.sender_id<>$2`,[id,user])).rows[0];
 if(source)throw new Failure('这笔认领账单请由原付款人修改',403);
}
