import type { Draft } from '@/components/DraftReview';
import { validEntryDate } from './entry-time';
import { requiresVerification } from './verification';

export function missingEntryFields(d: Draft, accounts: { id: string; type?: string }[]) {
  if (d.action === 'skip') return [];
  const missing: string[] = [];
  if (d.installment) {
    if (!d.installment.terms) missing.push('分期期数');
    if (!d.installment.firstDate) missing.push('首次还款日期');
    if (d.installment.fees == null) missing.push('总手续费');
    if (!accounts.some(a => a.id === d.accountId && a.type === 'credit')) missing.push('信用账户');
  }
  if (d.action === 'merge') {
    if (!d.mergeId || !d.mergeVersion) missing.push('请选择已有记录');
    return missing;
  }
  if (!d.amount) missing.push('金额');
  if (!validEntryDate(d.date)) missing.push('交易日期');
  if (!d.category.trim()) missing.push('分类');
  if (!d.accountId) missing.push('资金账户');
  if (d.kind === 'transfer' && (!d.targetId || d.targetId === d.accountId)) missing.push('转入账户');
  if (requiresVerification(d.lineItems || [], d.amount) && !d.verificationReason?.trim())
    missing.push('金额差异确认');
  return missing;
}
