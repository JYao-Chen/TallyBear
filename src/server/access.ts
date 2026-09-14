import {db} from './db';
export class Failure extends Error { constructor(message:string, public status=400){super(message);} }
export type User={id:string;username:string;name:string;admin:boolean;avatar:string;theme:'bear'|'minimal'};
export async function member(book:string,u:User,write=false,owner=false){const {rows}=await db.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[book,u.id]);const role=rows[0]?.role;if(!role||write&&role==='viewer'||owner&&role!=='owner')throw new Failure('无权访问或修改此账本',403);return role as string;}
