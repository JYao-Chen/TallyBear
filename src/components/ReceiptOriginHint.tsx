'use client';
import {type ReceiptOrigin,usableClue} from '@/lib/receipt-origin';
import {useI18n} from './LanguageProvider';
import {Store} from 'lucide-react';
import {AccountIcon} from './VisualSelect';
export function ReceiptOriginHint({origin}:{origin?:ReceiptOrigin}){const {locale}=useI18n();if(!origin)return null;const en=locale==='en';const clues=[[en?'Order platform':'订单平台',origin.orderPlatform],[en?'Payment channel':'支付渠道',origin.paymentChannel]] as const;return <div style={{gridColumn:'1 / -1'}}>{clues.filter(([,c])=>usableClue(c)).map(([label,c])=><span key={label} className="receipt-origin-label">{c===origin.orderPlatform?<Store size={16}/>:<AccountIcon name={c.name} size={16}/>}{label}：{c.name}{c.basis==='visual'?(en?' · visually identified':' · 页面识别'):''}</span>)}{clues.some(([,c])=>usableClue(c))&&<details className="usage-help"><summary>{en?'Recognition evidence':'识别依据'}</summary>{clues.filter(([,c])=>usableClue(c)).map(([label,c])=><p key={label}>{label}：{c.cues.join('；')}</p>)}{origin.funding.evidence&&<p>{en?'Funding evidence: ':'扣款依据：'}{origin.funding.evidence}</p>}</details>}</div>;}
