import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BudgetPanel } from '../src/components/BudgetPanel';
import { FinanceChart } from '../src/components/InteractiveFinanceChart';

test('monthly budgets use Shanghai days, whole cents and strict warning thresholds', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2028-02-27T16:00:00Z') });
  function card(month: string, spent: number) {
    return renderToStaticMarkup(
      createElement(BudgetPanel, {
        book: 'b',
        month,
        budgets: [{ category: 'Meals', amount: 10001 }],
        spending: [{ name: 'Meals', value: spent }],
        categories: [],
        canWrite: false,
        onSave: async () => {},
        onDelete: async () => {},
      }),
    );
  }
  const current = card('2028-02', 8000);
  assert.match(current, /剩余 2 天 · 日均可用/);
  assert.match(current, /10\.00/);
  assert.match(current, /accent-color:var\(--accent\)/);
  assert.match(card('2028-02', 8001), /accent-color:var\(--attention\)/);
  assert.match(card('2028-02', 10001), /accent-color:var\(--attention\)/);
  assert.match(card('2028-02', 10002), /accent-color:var\(--expense\)/);
  assert.match(card('2028-03', 0), /剩余 31 天/);
  assert.doesNotMatch(card('2028-01', 0), /日均可用/);
});

test('a daily income series uses the income label when its dimension supplies the metric', () => {
  const html = renderToStaticMarkup(
    createElement(FinanceChart, {
      chart: {
        id: 'income',
        title: 'Trend',
        type: 'line',
        dimension: 'daily_income',
        from: '2028-02-01',
        to: '2028-02-29',
        unit: 'CNY',
        data: [],
      },
    }),
  );
  assert.match(html, /CNY · 收入/);
  assert.doesNotMatch(html, /净支出/);
});
