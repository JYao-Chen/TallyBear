import { Pool, type PoolClient } from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
const connectionScope=new AsyncLocalStorage<PoolClient>();
const globalDb = globalThis as unknown as { bubuPool?: Pool };
const pool = globalDb.bubuPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
globalDb.bubuPool = pool;
// Keep page-service writes and assistant confirmation in one transaction.
export const db = new Proxy(pool,{get(target,key){
 if(key==='query'){const connection=connectionScope.getStore();return (connection||target).query.bind(connection||target);}
 const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
}});
export function withConnection<T>(connection:PoolClient,fn:()=>Promise<T>){return connectionScope.run(connection,fn);}
export async function transaction<T>(fn:(c:PoolClient)=>Promise<T>, connection?:PoolClient) { const existing=connection||connectionScope.getStore();if(existing)return fn(existing); const c=await db.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();} }

export async function lockBook(c:PoolClient,book:string){await c.query('SELECT id FROM books WHERE id=$1 FOR UPDATE',[book]);}
