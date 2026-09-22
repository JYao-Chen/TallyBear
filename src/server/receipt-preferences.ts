import type {PoolClient} from 'pg';
import {db} from './db';
import {listCategories} from './categories';
import {recommendCategory,type CategoryEvidence,type CategoryInput,type CategorySuggestion} from '@/lib/category-learning';
import {sceneTitle} from '@/lib/entry-scene';
import type {ModelProgress} from './ai';

type LearnedEntry=CategoryInput&{title:string;categorySuggestion?:CategorySuggestion};

async function learningEvidence(book:string,userId:string):Promise<CategoryEvidence[]>{
 const rows=(await db.query(`SELECT * FROM (
  SELECT DISTINCT ON (COALESCE(t.event_id,t.id)) t.id,t.category,t.kind,t.payee,t.scene,t.title,t.product,t.line_items AS "lineItems",
   CASE WHEN f.corrected THEN 'correction' WHEN f.source='manual' THEN 'manual' WHEN f.transaction_id IS NOT NULL THEN 'accepted' ELSE 'legacy' END AS source,
   COALESCE(f.confirmed_at,t.updated_at,t.created_at) AS at
  FROM transactions t
  JOIN members m ON m.book_id=t.book_id AND m.user_id=$2
  LEFT JOIN category_feedback f ON f.transaction_id=t.id AND f.user_id=$2
  WHERE NOT t.deleted AND t.kind IN ('expense','income') AND (f.user_id=$2 OR (t.created_by=$2 AND NOT EXISTS(SELECT 1 FROM category_feedback other WHERE other.transaction_id=t.id AND other.user_id<>$2)))
  ORDER BY COALESCE(t.event_id,t.id),(t.book_id=$1) DESC,COALESCE(f.confirmed_at,t.updated_at,t.created_at) DESC
 ) history ORDER BY at DESC NULLS LAST LIMIT 2000`,[book,userId])).rows as CategoryEvidence[];
 const templates=(await db.query(`SELECT e.id,(e.value->>'category') AS category,(e.value->>'kind') AS kind,COALESCE(e.value->>'payee','') AS payee,COALESCE(e.value->'scene','{}'::jsonb) AS scene,COALESCE(e.value->>'title','') AS title,COALESCE(e.value->>'product','') AS product,COALESCE(e.value->'lineItems','[]'::jsonb) AS "lineItems",'template' AS source,e.created_at AS at FROM entry_templates e JOIN members m ON m.book_id=e.book_id AND m.user_id=$1 WHERE e.user_id=$1`,[userId])).rows as CategoryEvidence[];
 return [...templates,...rows];
}

export async function applyPreferences<T extends LearnedEntry>(book:string,entries:T[],enabled:boolean,english:boolean,progress:ModelProgress={},userId?:string){
 const valid=new Set((await listCategories(userId)).filter(row=>!row.archived).map(row=>row.name));
 const evidence=enabled&&userId?await learningEvidence(book,userId):[];const result:(T&{categorySuggestion?:CategorySuggestion})[]=[];
 for(const entry of entries){progress.signal?.throwIfAborted();const suggestion=enabled?recommendCategory(entry,evidence,valid):null;result.push({...entry,title:sceneTitle(entry.scene,english)||entry.title,...(suggestion?{category:suggestion.category,categorySuggestion:suggestion}:{})});}
 return result;
}

export async function recordCategoryFeedback(c:PoolClient,book:string,userId:string,entry:{id:string;category:string;categorySource?:'explicit'|'model';categorySuggestion?:CategorySuggestion},previousCategory=''){
 const suggestion=entry.categorySuggestion;const proposed=suggestion?.category||previousCategory;const original=suggestion?.originalCategory||previousCategory;const corrected=!!proposed&&entry.category!==proposed;
 await c.query(`INSERT INTO category_feedback(transaction_id,book_id,user_id,proposed_category,original_category,final_category,source,corrected,confidence,basis,evidence_count,confirmed_at)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
  ON CONFLICT(transaction_id) DO UPDATE SET book_id=$2,user_id=$3,proposed_category=$4,original_category=$5,final_category=$6,source=$7,corrected=$8,confidence=$9,basis=$10,evidence_count=$11,confirmed_at=now()`,[entry.id,book,userId,proposed,original,entry.category,suggestion||entry.categorySource==='model'?'confirmed':'manual',corrected,suggestion?.confidence||null,suggestion?.basis||null,suggestion?.evidenceCount||0]);
}
