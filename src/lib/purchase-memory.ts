import {emptyScene,sceneTitle,type EntryScene} from './entry-scene';
import type {LineItem} from './line-items';
import type {LedgerRow} from './ledger-types';

export function purchaseFromRow(row:LedgerRow):Purchase{return {...row,lineItems:row.line_items};}

export type Purchase={id:string;kind:string;title?:string;payee:string;product?:string;category:string;categorySource?:'explicit'|'model';platform?:string;note?:string;scene?:EntryScene;lineItems?:LineItem[]};
const normalize=(s:string)=>(s||'').normalize('NFKC').toLowerCase().replace(/[\s·、，,。!！()（）]/g,'');
const goods=(p:Partial<Purchase>)=>(p.lineItems||[]).filter(i=>(!i.kind||i.kind==='item')&&(i.amount===null||i.amount>=0));
const names=(p:Partial<Purchase>)=>goods(p).map(i=>normalize(i.name)).sort().join('|');

// Prices and dates never identify a product; a merchant alone is not a match.
export function samePurchase(a:Partial<Purchase>,b:Partial<Purchase>){
 if(a.kind!=='expense'||b.kind!=='expense')return false;
 if(a.payee&&b.payee&&normalize(a.payee)!==normalize(b.payee))return false;
 if(a.scene?.diningMode&&b.scene?.diningMode&&a.scene.diningMode!=='unknown'&&b.scene.diningMode!=='unknown'&&a.scene.diningMode!==b.scene.diningMode)return false;
 const an=names(a),bn=names(b);
 if(an&&bn)return an===bn;
 const ap=normalize(a.product||a.scene?.summary||''),bp=normalize(b.product||b.scene?.summary||'');
 return ap.length>=2&&ap===bp;
}

export function purchaseDefaults(source:Purchase,refund=false){
 const scene={...emptyScene(),...source.scene,purchaseGroup:source.scene?.purchaseGroup||source.id};
 return {title:source.title||source.product||source.payee,payee:source.payee,product:source.product||'',category:source.category,platform:source.platform||'',note:source.note||'',scene,
  // A new purchase/refund must not inherit old payment facts or item prices.
  lineItems:refund?[]:goods(source).map(i=>({...i,quantity:null,unitPrice:null,amount:null})),
  orderId:'',externalId:'',verificationReason:''};
}

export function applyPurchaseMemory<T extends Omit<Purchase,'id'>&{id?:string}>(current:T,history:Purchase[],english=false):T{
 const candidates=history.filter(p=>samePurchase(current,p));
 if(!candidates.length)return current;
 if(!current.payee&&new Set(candidates.map(p=>normalize(p.payee))).size>1)return current;
 // Conflicting catalogue names need a human selection rather than an arbitrary fill.
 if(new Set(candidates.map(p=>normalize(p.product||names(p)))).size>1)return current;
 const previous=candidates[0],defaults=purchaseDefaults(previous);
 const scene={...emptyScene(),...current.scene,purchaseGroup:previous.scene?.purchaseGroup||previous.id};
 for(const key of ['merchant','branch','summary'] as const)scene[key]||=defaults.scene[key];
 const product=previous.product||current.product||'';
 if(scene.diningMode==='delivery')scene.summary=product.slice(0,80)||scene.summary;
 return {...current,category:current.categorySource==='explicit'?current.category:previous.category,payee:current.payee||defaults.payee,platform:current.platform||defaults.platform,product,scene,title:sceneTitle(scene,english)||previous.title||current.title,
  // Keep current OCR evidence, including all newly observed amounts and quantities.
  lineItems:current.lineItems?.length?current.lineItems:defaults.lineItems};
}

export function normalizeDining<T extends {scene?:EntryScene;product?:string;title?:string;lineItems?:LineItem[]}>(entry:T,english=false):T{
 const scene={...emptyScene(),...entry.scene};
 if(scene.type==='dining'&&scene.diningMode==='delivery')scene.summary=(entry.product||goods(entry).map(i=>i.name).join('、')||scene.summary).slice(0,80);
 return {...entry,scene,title:sceneTitle(scene,english)||entry.title};
}
