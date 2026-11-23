'use client';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileQuestion, Rows3 } from 'lucide-react';
import { formatMoney } from '@/lib/deployment';
import type { StatementReconciliation as Result, StatementRecord } from '@/lib/statement-reconciliation';
import { PagedList } from './PagedList';
import { useI18n } from './LanguageProvider';
import { Segmented } from '@/ui';

function RecordLine({ item }: { item: StatementRecord }) {
  const { t: tr } = useI18n();
  return (
    <div className="reconciliation-row">
      <span>
        <strong>{item.title || item.payee || tr('未识别交易对方')}</strong>
        <small>
          {item.date}
          {item.occurredAt ? ' · ' + item.occurredAt : ''}
          {item.orderId ? ' · ' + tr('订单号') + ' ' + item.orderId : ''}
          {item.externalId ? ' · ' + tr('流水号') + ' ' + item.externalId : ''}
        </small>
      </span>
      <strong>{formatMoney(item.amount)}</strong>
    </div>
  );
}
export function StatementReconciliation({ result }: { result: Result }) {
  const { t: tr } = useI18n(),
    s = result.summary;
  const tabs = [
    ...(s.missing > 0 ? [{ value: 'missing', label: `${tr('疑似漏记')} (${s.missing})` }] : []),
    ...(s.ambiguous > 0 ? [{ value: 'ambiguous', label: `${tr('待判断')} (${s.ambiguous})` }] : []),
    { value: 'matched', label: `${tr('已匹配')} (${s.matched})` },
    ...(s.ledgerOnly > 0 ? [{ value: 'ledgerOnly', label: `${tr('仅账本存在')} (${s.ledgerOnly})` }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.value || 'matched');
  const activeTab = tabs.some(x => x.value === tab) ? tab : tabs[0]?.value || 'matched';
  return (
    <section className="statement-reconciliation" aria-label={tr('智能核对结果')}>
      <header>
        <div>
          <Rows3 size={20} />
          <h3>{tr('智能核对结果')}</h3>
        </div>
        <small>{tr(result.orientation === 'reversed' ? '已自动识别为倒序账单' : '按截图顺序完成对齐')}</small>
      </header>
      <div className="reconciliation-summary">
        <span>
          <CheckCircle2 size={16} />
          {tr('已匹配')} {s.matched}
        </span>
        <span>
          <AlertCircle size={16} />
          {tr('疑似漏记')} {s.missing}
        </span>
        <span>
          <FileQuestion size={16} />
          {tr('待判断')} {s.ambiguous}
        </span>
        <span>
          {tr('仅账本存在')} {s.ledgerOnly}
        </span>
      </div>
      <Segmented tabs label={tr('智能核对结果')} value={activeTab} onChange={setTab} options={tabs} />
      {activeTab === 'missing' && s.missing > 0 && (
        <div className="reconciliation-group">
          <p className="muted">{tr('疑似漏记 · 可送到草稿核对')}</p>
          <PagedList items={result.missing}>{item => <RecordLine item={item} />}</PagedList>
        </div>
      )}
      {activeTab === 'ambiguous' && s.ambiguous > 0 && (
        <div className="reconciliation-group">
          <p className="muted">{tr('证据不足，不自动合并')}</p>
          <PagedList items={result.ambiguous}>
            {item => (
              <div>
                <RecordLine item={item.statement} />
                <p className="muted">{tr(item.reason)}</p>
              </div>
            )}
          </PagedList>
        </div>
      )}
      {activeTab === 'matched' && (
        <div className="reconciliation-group">
          <PagedList items={result.matched}>
            {item => (
              <div>
                <RecordLine item={item.statement} />
                <p className="muted">{tr(item.reason)}</p>
              </div>
            )}
          </PagedList>
        </div>
      )}
      {activeTab === 'ledgerOnly' && s.ledgerOnly > 0 && (
        <div className="reconciliation-group">
          <PagedList items={result.ledgerOnly}>{item => <RecordLine item={item} />}</PagedList>
        </div>
      )}
      <p className="muted">
        {tr('编号与精确时间优先；同名同价记录仅在前后锚点足够时按顺序匹配。所有漏记候选仍需确认后才会入账。')}
      </p>
    </section>
  );
}
