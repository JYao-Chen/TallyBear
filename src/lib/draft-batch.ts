import type {Draft} from '../components/DraftReview';
import {matchReason} from '../server/intake';
/** Retain the user's edited drafts; new recognition only appends proposals. */
export function appendDraftBatch(current:Draft[],incoming:Draft[]){
 const retained=[...current],aliases=new Map<string,string>(),added:Draft[]=[];
 for(const draft of incoming){
  if(retained.some(r=>r.id===draft.id))continue;
  const previous=retained.find(r=>r.action!=='skip'&&matchReason(draft,r));
  if(previous){aliases.set(draft.id,previous.action==='merge'&&previous.mergeId?previous.mergeId:previous.id);added.push({...draft,action:'skip',matches:[{record:previous,reason:'与已有待确认草稿相似，请核对是否同一笔'},...draft.matches||[]]});}
  else{added.push(draft);retained.push(draft);}
 }
 return [...current,...added.map(d=>d.refundOf&&aliases.has(d.refundOf)?{...d,refundOf:aliases.get(d.refundOf)!}:d)];
}
