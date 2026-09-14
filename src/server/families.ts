import {avatar} from './management';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction} from './db';
import {Failure} from './auth';
const uuid=z.string().uuid(),name=z.string().trim().min(1).max(80);
export async function families(uid:string,method:string,path:string[],body:unknown){
 if(path.length===1&&method==='GET'){
  const items=(await db.query(`SELECT f.*,u.name AS owner_name,(SELECT count(*)::int FROM family_members WHERE family_id=f.id) AS member_count FROM families f JOIN family_members m ON m.family_id=f.id JOIN users u ON u.id=f.owner_id WHERE m.user_id=$1 ORDER BY f.created_at`,[uid])).rows;
  const invitations=(await db.query(`SELECT f.id,f.name,f.avatar,u.name AS owner_name FROM family_invitations i JOIN families f ON f.id=i.family_id JOIN users u ON u.id=f.owner_id WHERE i.user_id=$1 ORDER BY i.created_at`,[uid])).rows;
  return {items,invitations};
 }
 if(path.length===1&&method==='POST'){
  const b=z.object({name,description:z.string().trim().max(500).default(''),avatar:avatar.default('🏡')}).parse(body),id=randomUUID();
  await transaction(async c=>{await c.query('INSERT INTO families(id,name,description,owner_id,avatar) VALUES($1,$2,$3,$4,$5)',[id,b.name,b.description,uid,b.avatar]);await c.query('INSERT INTO family_members VALUES($1,$2)',[id,uid]);});return {id};
 }
 const id=uuid.parse(path[1]);
 return transaction(async c=>{
  const f=(await c.query('SELECT * FROM families WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!f)throw new Failure('家庭不存在或已解散',404);
  if(path[2]==='invitation'&&method==='POST'){
   const b=z.object({accept:z.boolean()}).parse(body);
   const inv=await c.query('DELETE FROM family_invitations WHERE family_id=$1 AND user_id=$2 RETURNING user_id',[id,uid]);
   if(!inv.rowCount)throw new Failure('邀请已失效',404);
   if(b.accept)await c.query('INSERT INTO family_members VALUES($1,$2) ON CONFLICT DO NOTHING',[id,uid]);return {ok:true};
  }
  const joined=(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[id,uid])).rowCount;
  if(!joined)throw new Failure('无权访问此家庭',403);
  const owner=f.owner_id===uid;
  const requireOwner=()=>{if(!owner)throw new Failure('只有家庭负责人可以操作',403);};
  if(path.length===2&&method==='GET'){
   const members=(await c.query('SELECT u.id,u.name,u.username,u.avatar,u.disabled FROM family_members m JOIN users u ON u.id=m.user_id WHERE m.family_id=$1 ORDER BY u.created_at',[id])).rows;
   const books=(await c.query('SELECT b.id,b.name,b.icon,m.role FROM books b JOIN members m ON m.book_id=b.id WHERE b.family_id=$1 AND m.user_id=$2 ORDER BY b.created_at',[id,uid])).rows;
   const availableBooks=(await c.query("SELECT id,name,icon FROM books WHERE owner_id=$1 AND kind='shared' AND family_id IS NULL ORDER BY created_at",[uid])).rows;
   const invitations=owner?(await c.query('SELECT u.id,u.name,u.username FROM family_invitations i JOIN users u ON u.id=i.user_id WHERE i.family_id=$1',[id])).rows:[];
   return {...f,members,books,availableBooks,invitations};
  }
  if(path.length===2&&method==='PUT'){requireOwner();const b=z.object({name,description:z.string().trim().max(500),avatar:avatar.optional()}).parse(body);await c.query('UPDATE families SET name=$1,description=$2,avatar=COALESCE($4,avatar) WHERE id=$3',[b.name,b.description,id,b.avatar??null]);return {ok:true};}
  if(path.length===2&&method==='DELETE'){requireOwner();await c.query('DELETE FROM families WHERE id=$1',[id]);return {ok:true};}
  if(path[2]==='invitations'){
   requireOwner();
   if(method==='POST'){const b=z.object({username:name}).parse(body);const target=(await c.query('SELECT id FROM users WHERE username=$1 AND disabled=false',[b.username])).rows[0];if(!target)throw new Failure('账号不存在或已停用，请先由系统管理员创建独立账号');if((await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[id,target.id])).rowCount)throw new Failure('该用户已经是家庭成员');await c.query('INSERT INTO family_invitations(family_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,target.id]);return {ok:true};}
   if(method==='DELETE'){const b=z.object({userId:uuid}).parse(body);await c.query('DELETE FROM family_invitations WHERE family_id=$1 AND user_id=$2',[id,b.userId]);return {ok:true};}
  }
  if(path[2]==='members'&&method==='DELETE'){
   const b=z.object({userId:uuid}).parse(body);if(b.userId!==uid)requireOwner();if(b.userId===f.owner_id)throw new Failure('负责人请先转交家庭，或解散家庭');
   // A departed book owner keeps their independent book; detach it from the family.
   await c.query('UPDATE books SET family_id=NULL WHERE family_id=$1 AND owner_id=$2',[id,b.userId]);
   await c.query('DELETE FROM family_members WHERE family_id=$1 AND user_id=$2',[id,b.userId]);return {ok:true};
  }
  if(path[2]==='owner'&&method==='PUT'){requireOwner();const b=z.object({userId:uuid}).parse(body);if(!(await c.query('SELECT 1 FROM family_members m JOIN users u ON u.id=m.user_id WHERE family_id=$1 AND user_id=$2 AND u.disabled=false',[id,b.userId])).rowCount)throw new Failure('请选择已加入且可用的家庭成员');await c.query('UPDATE families SET owner_id=$1 WHERE id=$2',[b.userId,id]);return {ok:true};}
  if(path[2]==='books'&&(method==='POST'||method==='DELETE')){
   const b=z.object({bookId:uuid}).parse(body);const book=(await c.query('SELECT * FROM books WHERE id=$1 FOR UPDATE',[b.bookId])).rows[0];
   if(!book)throw new Failure('账本不存在',404);
   if(method==='POST'){
    if(book.owner_id!==uid)throw new Failure('只能关联自己拥有的共享账本',403);
    if(book.kind!=='shared')throw new Failure('私人账本不能关联家庭');
    if(book.family_id&&book.family_id!==id)throw new Failure('此账本已关联其他家庭，请先解除关联');
    await c.query('UPDATE books SET family_id=$1 WHERE id=$2',[id,b.bookId]);
   }else{if(book.family_id!==id)throw new Failure('账本不属于此家庭',404);if(book.owner_id!==uid&&!owner)throw new Failure('只有账本所有者或家庭负责人可以解除关联',403);await c.query('UPDATE books SET family_id=NULL WHERE id=$1',[b.bookId]);}
   return {ok:true};
  }
  if(path[2]==='access'&&method==='PUT'){
   const b=z.object({bookId:uuid,userId:uuid,role:z.enum(['editor','viewer','none'])}).parse(body);
   const book=(await c.query('SELECT * FROM books WHERE id=$1 FOR UPDATE',[b.bookId])).rows[0];
   if(!book||book.family_id!==id||book.owner_id!==uid)throw new Failure('只有此账本所有者可以授权',403);
   if(book.owner_id===b.userId)throw new Failure('不能修改账本所有者权限');
   if(!(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[id,b.userId])).rowCount)throw new Failure('该用户尚未加入家庭');
   if(b.role==='none')await c.query("DELETE FROM members WHERE book_id=$1 AND user_id=$2 AND role<>'owner'",[b.bookId,b.userId]);
   else await c.query('INSERT INTO members VALUES($1,$2,$3) ON CONFLICT(book_id,user_id) DO UPDATE SET role=$3',[b.bookId,b.userId,b.role]);return {ok:true};
  }
  throw new Failure('操作不存在',404);
 });
}
