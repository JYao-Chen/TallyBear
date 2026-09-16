import {db} from './db';
import {z} from 'zod';
export async function familyInbox(user:string,params:URLSearchParams){
 const offset=z.coerce.number().int().nonnegative().parse(params.get('offset')||0);
 const {rows}=await db.query(`SELECT v.id,v.family_id,f.name AS family_name,s.name AS sender_name,s.avatar AS sender_avatar,v.kind,v.amount::float8 AS amount,to_char(v.date,'YYYY-MM-DD') AS date,v.note,count(*) OVER()::int AS total FROM family_movements v JOIN families f ON f.id=v.family_id JOIN family_members m ON m.family_id=f.id AND m.user_id=$1 JOIN users s ON s.id=v.sender_id WHERE v.recipient_id=$1 AND v.status='pending' ORDER BY v.created_at DESC,v.id LIMIT 5 OFFSET $2`,[user,offset]);
 return {rows,total:rows[0]?.total||0};
}
