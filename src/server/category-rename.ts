import type {PoolClient} from 'pg';
import {Failure} from './access';

// Match the current classification, so manually reclassified records are preserved.
export async function renameCategoryRecords(c:PoolClient,books:string[],from:string,to:string,creator?:string){
 if(from===to||!books.length)return 0;
 const result=await c.query(`UPDATE transactions t SET category=$3,version=t.version+1
  WHERE t.book_id=ANY($1::uuid[]) AND t.category=$2
   AND ($4::uuid IS NULL OR t.created_by=$4 OR EXISTS(SELECT 1 FROM books b WHERE b.id=t.book_id AND b.kind='shared'))`,[books,from,to,creator||null]);
 return result.rowCount||0;
}

export async function renameCategoryBudgets(c:PoolClient,books:string[],from:string,to:string){
 if(from===to||!books.length)return 0;
 const conflict=await c.query(`SELECT 1 FROM budgets old JOIN budgets target ON target.book_id=old.book_id AND target.month=old.month
  WHERE old.book_id=ANY($1::uuid[]) AND old.category=$2 AND target.category=$3 LIMIT 1`,[books,from,to]);
 if(conflict.rowCount)throw new Failure('该分类已有预算，请修改已有预算',409);
 const result=await c.query('UPDATE budgets SET category=$3 WHERE book_id=ANY($1::uuid[]) AND category=$2',[books,from,to]);
 return result.rowCount||0;
}
