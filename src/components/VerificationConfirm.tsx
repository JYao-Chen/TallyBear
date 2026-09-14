import {useI18n} from './LanguageProvider';
import {requiresVerification} from '@/lib/verification';
import type {LineItem} from '@/lib/line-items';
export function VerificationConfirm({items,total,value,onChange}:{items:LineItem[];total:number;value:string;onChange:(s:string)=>void}){const {t:tr,locale}=useI18n();if(!requiresVerification(items,total))return null;return <label className="notice">{tr("明细待核验 · 确认原因")}<textarea value={value} maxLength={500} required placeholder={tr("请先修正明细；若保留差额入账，说明原因，例如小票缺少配送费")} onChange={e=>onChange(e.target.value)}/></label>;}
