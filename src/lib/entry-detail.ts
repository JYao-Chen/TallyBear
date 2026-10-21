import type {LedgerRow} from './ledger-types';
// Reports and item drilldowns are projections. Always edit the current original record and its version.
export async function resolveEntryDetail(row:LedgerRow,currentBook:string,load:(book:string,id:string)=>Promise<LedgerRow[]>){
 if(row.family_movement_id||row.cost_row_key)return row;
 const book=row.book_id||currentBook;
 const source=(await load(book,row.id)).find(source=>source.id===row.id);
 if(!source)throw new Error('记录不存在或已删除');
 return {...row,...source,book_id:book,cost_row_key:undefined,cost_project_id:undefined};
}
