import {Failure,type User} from './access';
export {Failure,member,type User} from './access';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verifyPassword(password:string,stored:string){const [salt,hash]=stored.split(':');const b=Buffer.from(hash,'hex');const a=scryptSync(password,salt,64);return b.length===a.length&&timingSafeEqual(a,b);}
export async function user():Promise<User>{const token=(await cookies()).get('bubu_session')?.value;if(!token)throw new Failure('请先登录',401);const {rows}=await db.query('SELECT u.id,u.username,u.name,u.admin,u.avatar,u.theme FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>now() AND NOT u.disabled',[token]);if(!rows[0])throw new Failure('登录已过期，请重新登录',401);return rows[0];}
export async function session(id:string){const token=randomBytes(32).toString('hex');await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')",[token,id]);(await cookies()).set('bubu_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.APP_ORIGIN?.startsWith('https://'),path:'/',maxAge:604800});}
