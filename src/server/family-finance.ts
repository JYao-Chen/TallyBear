import {z} from 'zod';
import {transaction} from './db';
import {Failure} from './access';
import type {PoolClient} from 'pg';
const uuid=z.string().uuid(),money=z.number().int().positive().max(100000000000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
async function wallet(c:PoolClient,id:string,user:string,family:string){const a=(await c.query('SELECT id,owner_id,family_id,archived FROM accounts WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!a||a.archived||!(a.owner_id===user||a.family_id===family))throw new Failure('请选择自己的钱包或本家庭共同钱包',403);return a;}
async function expense(c:PoolClient,id:string,family:string,user:string){const t=(await c.query(`SELECT t.*,a.owner_id FROM transactions t JOIN books b ON b.id=t.book_id JOIN members m ON m.book_id=b.id AND m.user_id=$3 JOIN accounts a ON a.id=t.account_id WHERE t.id=$1 AND b.family_id=$2 AND t.kind='expense' AND NOT t.deleted FOR UPDATE OF t`,[id,family,user])).rows[0];if(!t)throw new Failure('请选择有权查看的家庭账本消费');return t;}
export async function familyFinance(user:string,familyId:string,method:string,body:unknown){const family=uuid.parse(familyId);return transaction(async c=>{
 // Serialize related confirmations and allocations, including repeat requests.
 const f=await c.query('SELECT f.id FROM families f JOIN family_members m ON m.family_id=f.id WHERE f.id=$1 AND m.user_id=$2 FOR UPDATE OF f',[family,user]);if(!f.rowCount)throw new Failure('无权访问此家庭',403);
 if(method==='GET'){
 const people=(await c.query('SELECT u.id,u.name,u.avatar FROM users u JOIN family_members m ON m.user_id=u.id WHERE m.family_id=$1 AND NOT u.disabled',[family])).rows;
 const wallets=(await c.query('SELECT id,name,institution,suffix,type,owner_id,family_id FROM accounts WHERE NOT archived AND (owner_id=$1 OR family_id=$2) ORDER BY name',[user,family])).rows;
 const movements=(await c.query(`SELECT v.*,v.amount::float8 AS amount,to_char(v.date,'YYYY-MM-DD') AS date,s.name AS sender_name,r.name AS recipient_name,CASE WHEN a.owner_id=$2 OR a.family_id=$1 THEN a.name ELSE NULL END AS source_name,CASE WHEN t.owner_id=$2 OR t.family_id=$1 THEN t.name ELSE NULL END AS target_name FROM family_movements v JOIN users s ON s.id=v.sender_id LEFT JOIN users r ON r.id=v.recipient_id JOIN accounts a ON a.id=v.source_id LEFT JOIN accounts t ON t.id=v.target_id WHERE v.family_id=$1 AND (v.sender_id=$2 OR v.recipient_id=$2 OR a.family_id=$1 OR t.family_id=$1) ORDER BY v.created_at DESC`,[family,user])).rows;
 const expenses=(await c.query(`SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.id,t.title,t.payee,t.amount::float8 AS amount,a.owner_id,u.name AS payer_name,fs.shares FROM transactions t JOIN books b ON b.id=t.book_id JOIN members m ON m.book_id=b.id AND m.user_id=$2 JOIN accounts a ON a.id=t.account_id LEFT JOIN users u ON u.id=a.owner_id LEFT JOIN family_expense_shares fs ON fs.transaction_id=t.id WHERE b.family_id=$1 AND t.kind='expense' AND NOT t.deleted ORDER BY COALESCE(t.event_id,t.id),t.created_at`,[family,user])).rows;
 for(const e of expenses){if(e.shares){const paid=(await c.query("SELECT sender_id,sum(amount)::float8 AS paid FROM family_movements WHERE expense_id=$1 AND status='confirmed' GROUP BY sender_id",[e.id])).rows;e.shares=e.shares.map((s:any)=>({...s,paid:paid.find(p=>p.sender_id===s.userId)?.paid||0}));}}
 return {people,wallets,movements,expenses};
 }
 const op=z.object({operation:z.enum(['create','confirm','cancel','shares'])}).parse(body).operation;
 if(op==='shares'){
 const b=z.object({transactionId:uuid,shares:z.array(z.object({userId:uuid,amount:z.number().int().nonnegative()})).min(1)}).parse(body),t=await expense(c,b.transactionId,family,user);
 if(t.owner_id!==user)throw new Failure('由实际付款人设置费用承担份额',403);
 if(new Set(b.shares.map(s=>s.userId)).size!==b.shares.length||b.shares.reduce((n,s)=>n+s.amount,0)!==Number(t.amount))throw new Failure('各人承担金额之和必须等于原消费金额');
 for(const s of b.shares)if(!(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[family,s.userId])).rowCount)throw new Failure('承担人必须是家庭成员');
 if((await c.query("SELECT 1 FROM family_movements WHERE expense_id=$1 AND status<>'cancelled'",[t.id])).rowCount)throw new Failure('已有结算记录，请先完成或取消当前结算，暂不支持修改份额');
 await c.query('INSERT INTO family_expense_shares(transaction_id,family_id,shares,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(transaction_id) DO UPDATE SET shares=EXCLUDED.shares,updated_at=now()',[t.id,family,JSON.stringify(b.shares),user]);return {ok:true};
 }
 if(op==='create'){
 const b=z.object({id:uuid,sourceId:uuid,targetId:uuid.optional(),recipientId:uuid.optional(),kind:z.enum(['transfer','gift','aa','loan','repayment','contribution']),amount:money,date,note:z.string().max(500).default(''),expenseId:uuid.optional(),loanId:uuid.optional()}).parse(body);
 const existing=(await c.query('SELECT sender_id FROM family_movements WHERE id=$1',[b.id])).rows[0];if(existing){if(existing.sender_id!==user)throw new Failure('记录不可用',403);return {ok:true};}
 const source=await wallet(c,b.sourceId,user,family);const target=b.targetId?await wallet(c,b.targetId,user,family):null;
 if(target?.id===source.id)throw new Failure('转入与转出钱包不能相同');
 if(!target&&!b.recipientId)throw new Failure('请选择收款人或共同钱包');
 if(b.recipientId&&(b.recipientId===user||!(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[family,b.recipientId])).rowCount))throw new Failure('请选择其他家庭成员');
 if(b.kind==='contribution'&&(!target?.family_id||source.owner_id!==user))throw new Failure('共同入金应从个人钱包转入家庭钱包');
 if(['aa','loan','repayment','gift'].includes(b.kind)&&(source.owner_id!==user||target||!b.recipientId))throw new Failure('此用途需要个人钱包转给另一位家庭成员');
 if(b.kind==='aa'){
 const t=await expense(c,uuid.parse(b.expenseId),family,user);if(t.owner_id!==b.recipientId)throw new Failure('AA 收款人应为原消费付款人');
 const s=(await c.query('SELECT shares FROM family_expense_shares WHERE transaction_id=$1',[t.id])).rows[0]?.shares?.find((s:any)=>s.userId===user);if(!s)throw new Failure('请先由付款人设置这笔消费的承担份额');
 const settled=Number((await c.query("SELECT COALESCE(sum(amount),0) AS amount FROM family_movements WHERE expense_id=$1 AND sender_id=$2 AND status<>'cancelled'",[t.id,user])).rows[0].amount);
 if(b.amount+settled>s.amount)throw new Failure('超过你尚未结算的承担金额');
 }
 if(b.kind==='repayment'){
 const loan=(await c.query("SELECT * FROM family_movements WHERE id=$1 AND family_id=$2 AND kind='loan' AND status='confirmed'",[uuid.parse(b.loanId),family])).rows[0];if(!loan||loan.recipient_id!==user||loan.sender_id!==b.recipientId)throw new Failure('请选择对应的已确认借款');
 const paid=Number((await c.query("SELECT COALESCE(sum(amount),0) AS amount FROM family_movements WHERE loan_id=$1 AND status<>'cancelled'",[loan.id])).rows[0].amount);if(b.amount+paid>Number(loan.amount))throw new Failure('还款金额超过剩余借款');
 }
 await c.query(`INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,target_id,kind,amount,date,note,expense_id,loan_id,status,confirmed_by,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $13='confirmed' THEN now() ELSE NULL END)`,[b.id,family,user,target?null:b.recipientId,b.sourceId,b.targetId||null,b.kind,b.amount,b.date,b.note,b.kind==='aa'?b.expenseId:null,b.kind==='repayment'?b.loanId:null,target?'confirmed':'pending',target?user:null]);return {ok:true};
 }
 const b=z.object({id:uuid,targetId:uuid.optional()}).parse(body),v=(await c.query('SELECT * FROM family_movements WHERE id=$1 AND family_id=$2 FOR UPDATE',[b.id,family])).rows[0];if(!v||![v.sender_id,v.recipient_id].includes(user))throw new Failure('无权处理此记录',403);
 if(v.status!=='pending')return {ok:true};
 if(op==='cancel'){await c.query("UPDATE family_movements SET status='cancelled' WHERE id=$1",[v.id]);return {ok:true};}
 if(v.recipient_id!==user)throw new Failure('请由收款人确认到账',403);
 const target=await wallet(c,uuid.parse(b.targetId),user,family);if(target.owner_id!==user)throw new Failure('请选择自己的到账钱包');
 await wallet(c,v.source_id,v.sender_id,family);
 await c.query("UPDATE family_movements SET target_id=$2,status='confirmed',confirmed_by=$3,confirmed_at=now() WHERE id=$1",[v.id,target.id,user]);return {ok:true};
 });}
