import {useI18n} from './LanguageProvider';
import {requiresVerification} from '@/lib/verification';
import type {LineItem} from '@/lib/line-items';
export function VerificationConfirm({items,total,value,onChange}:{items:LineItem[];total:number;value:string;onChange:(s:string)=>void}){
 const {t:tr}=useI18n();if(!requiresVerification(items,total))return null;
 return <div className="notice"><p>{tr('实付与已展示明细不同，不一定是账单错误。截图可能未包含全部优惠或附加费用。')}</p><button type="button" className="secondary" aria-pressed={!!value} onClick={()=>onChange(value?'':'已确认实付金额，截图未完整展示结算明细')}>{tr(value?'已确认实付 · 点击撤销':'实付金额正确，按实付保存')}</button><details><summary>{tr('补充说明（选填）')}</summary><textarea value={value} maxLength={500} onChange={e=>onChange(e.target.value)}/></details></div>;
}
