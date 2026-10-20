import type {EntryScene} from './entry-scene';
import {recordingDate,validEntryDate} from './entry-time';
type ManualDraft={date?:string;amount?:number;title?:string;payee?:string;note?:string;product?:string;orderId?:string;externalId?:string;platform?:string;scene?:Partial<EntryScene>;refundOf?:string|null;lineItems?:unknown[];photoIds?:string[];attachmentIds?:string[]};
// Empty saved forms contain defaults, not an unfinished transaction. Do not carry their old date into a new entry.
export function manualEntryDate(draft?:ManualDraft,today=recordingDate()){
 const pending=!!draft&&(Number(draft.amount)>0||[draft.title,draft.payee,draft.note,draft.product,draft.orderId,draft.externalId,draft.platform,draft.refundOf].some(v=>!!v?.trim())||[draft.lineItems,draft.photoIds,draft.attachmentIds].some(v=>!!v?.length)||Object.entries(draft.scene||{}).some(([key,value])=>typeof value==='string'&&!!value.trim()&&!(key==='type'&&value==='general')&&!(key==='diningMode'&&value==='unknown')));
 return pending&&draft?.date&&validEntryDate(draft.date)?draft.date:today;
}
