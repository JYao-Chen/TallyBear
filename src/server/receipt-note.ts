// Applied to generated OCR notes only, never to user-written notes.
export function separateReceiptNote(note:string){
 const hints:string[]=[],facts:string[]=[];
 for(const part of note.match(/[^。；;\n]+[。；;\n]?/g)||[]){
  if(/长图|拆成|已合并|自动归并|未自动合并|不叠加|可见商品.*合计|与实付.*(?:相差|差)|未自行补记|截图.*(?:未显示|未见)|单价未(?:显示|知)|金额.*(?:待核对|待确认)/.test(part))hints.push(part.trim());else facts.push(part);
 }
 return {note:cleanReceiptNote(facts.join('')),hints};
}
export function cleanReceiptNote(note:string){
 return note.replace(/(?:accountId|targetId)[^。；;.!?\n]*(?:[。；;.!?]|$)/gi,'')
 .replace(/(?:订单状态(?:为|是|：|:)|(?:页面|截图|图片|票面)[^。；;\n]*(?:未显示|未提供|未截|未见|看不到))[^。；;\n]*(?:[。；;\n]|$)/g,'')
 .replace(/(?:^|[。；;\n])\s*(?:实付|实际支付)\s*[¥￥]?\d+(?:\.\d+)?\s*元?\s*(?:[。；;\n]|$)/g,'')
 .trim();
}
