import { Pool, type PoolClient } from 'pg';
const globalDb = globalThis as unknown as { bubuPool?: Pool };
export const db = globalDb.bubuPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
globalDb.bubuPool = db;
export async function transaction<T>(fn:(c:PoolClient)=>Promise<T>) { const c=await db.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();} }

export async function lockBook(c:PoolClient,book:string){await c.query('SELECT id FROM books WHERE id=$1 FOR UPDATE',[book]);}
