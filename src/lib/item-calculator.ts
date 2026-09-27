import {lineItemKind,type LineItem} from './line-items';

const maxMoney=100000000000;
// Multiply integer cents by a decimal quantity, rounding half up once per row.
export function recommendedItemAmount(item:LineItem):number|null{
 const {quantity,unitPrice}=item;
 if(lineItemKind(item)!=='item'||quantity==null||unitPrice==null||!Number.isFinite(quantity)||quantity<=0||quantity>1000000||!Number.isSafeInteger(unitPrice)||unitPrice<0||unitPrice>maxMoney)return null;
 const [coefficient,exponent='0']=String(quantity).toLowerCase().split('e');
 const [whole,fraction='']=coefficient.split('.');
 const scale=fraction.length-Number(exponent);
 const numerator=BigInt(whole+fraction)*BigInt(unitPrice)*(scale<0?10n**BigInt(-scale):1n);
 const denominator=scale>0?10n**BigInt(scale):1n;
 const result=Number((numerator*2n+denominator)/(denominator*2n));
 return result<=maxMoney?result:null;
}

export function editCalculatedItem(item:LineItem,patch:Partial<LineItem>):LineItem{
 const next={...item,...patch};
 if(('quantity' in patch||'unitPrice' in patch)&&!('amount' in patch)&&lineItemKind(item)==='item'&&lineItemKind(next)==='item'){
  const previous=recommendedItemAmount(item);
  // An observed or manually overridden subtotal is never overwritten.
  if(item.amount==null||(previous!==null&&item.amount===previous))next.amount=recommendedItemAmount(next);
 }
 return next;
}

export function canUseSettlementTotal(known:number,missing:number){return missing===0&&Number.isSafeInteger(known)&&known>0&&known<=maxMoney;}
