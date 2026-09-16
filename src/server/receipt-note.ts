// Applied to generated OCR notes only, never to user-written notes.
export function cleanReceiptNote(note:string){
 return note.replace(/(?:accountId|targetId)[^。；;.!?\n]*(?:[。；;.!?]|$)/gi,'')
 .replace(/(?:订单状态(?:为|是|：|:)|(?:页面|截图|图片|票面)[^。；;\n]*(?:未显示|未提供|未截|未见|看不到))[^。；;\n]*(?:[。；;\n]|$)/g,'')
 .replace(/(?:^|[。；;\n])\s*(?:实付|实际支付)\s*[¥￥]?\d+(?:\.\d+)?\s*元?\s*(?:[。；;\n]|$)/g,'')
 .trim();
}
