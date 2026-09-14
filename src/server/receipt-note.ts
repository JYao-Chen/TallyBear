// Remove internal account-field commentary without removing visible payment facts.
export function cleanReceiptNote(note:string){
 return note.replace(/(?:accountId|targetId)[^。；;.!?\n]*(?:[。；;.!?]|$)/gi,'').trim();
}
