# Unified expenses and transaction balances

Implementation handoff, 2026-09-27. Finish review disposition: **ship**. This records the development implementation and review evidence; it does not record a production deployment.

## Scope

Book reports now present ordinary spending and valid allocated costs in one report, without separate cashflow/allocation tabs. The list, totals, category summaries, daily chart and book CSV use the report's selected period and filters. Personal wallet reports retain their actual cash movement scope. The server also retains the explicit `basis=cashflow` report option.

This is a narrow surface change. The project's existing `DESIGN.md` remains the authority for visual identity; this document adds no global tokens or design-system rules.

## Report semantics

`src/server/unified-expenses.ts` combines ordinary movements with cost projections. A valid active cost plan claims its source payment amount: that amount is removed from ordinary expenses before its period share is included. Any unclaimed payment remainder stays in the report. Projections do not create transactions or debit wallets.

Project shares follow the plan's periods and are clipped to the selected report dates. A member's explicit display book receives their share; without that assignment, the implementation selects their first eligible private book by creation time and ID. Relevant shared source books also receive the shares. Stable projection keys prevent duplicate totals across selected books.

Existing single-entry allocations enter the same report as monthly projections, with linked refunds netted against the payment. Their original payment and linked refund events are excluded from the ordinary portion. A source already claimed by a valid cost project is not allocated a second time through this path.

Stale plans or invalid source payments are excluded from cost projections and returned through `excludedCosts` for the visible warning. Their source payment is not claimed by that invalid project, so ordinary payment reporting remains available; an independent legacy allocation can still apply. The warning must not imply that the invalid plan's projected costs were counted.

`src/server/reports.ts` applies the report filters and deduplication to the combined source. Daily charts distribute a projected amount over its covered days using integer minor units, preserving the period total. Projection rows carry `cost_row_key` and `cost_period_end`; the end date is exclusive internally. Ordinary rows retain `actual_amount` so a partially claimed payment can still be distinguished from its report amount.

## Wallet balance semantics

`src/server/wallet-history.ts` reconstructs each wallet's balance from its opening amount and complete history, independently of the report's date range, search, pagination or category filters. It includes non-deleted transaction events, confirmed family movements and account adjustments. Copies of a transaction event are deduplicated.

Events use their transaction date and recorded transaction time. Missing or invalid transaction times fall back to the entry's creation time in Asia/Shanghai. Creation time, event type and ID resolve ordering ties. Editing, backdating or deleting history therefore changes the reconstructed balances on subsequent reads; these values are not immutable bank statement snapshots.

Only wallets owned by the requesting user or available through their family membership supply balance entries. Transfers can show both visible wallets. Allocation projections have no wallet balances because they do not represent another payment.

## UI rules

- `TransactionList` keeps the transaction amount prominent and places available wallet balances beneath it as quiet secondary information. Wallet names identify the balances, including both sides of a visible transfer. Missing balances do not produce placeholders.
- Allocated rows use “当期分摊” / “Allocated cost”, do not participate in ordinary transaction bulk selection, and do not display wallet balances.
- `TransactionBalance` provides a separate detail section, “交易后账面余额” / “Book balance after transaction”, followed by the history and ordering explanation. It can use supplied balances or fetch them for an ordinary transaction detail.
- `ChartTransactionDetail` renders allocated rows as period expenses, showing their amount and inclusive display dates with the explanation that no additional wallet debit occurs. Ordinary details include `TransactionBalance`.
- A partially allocated payment can have different `actual_amount` and report `amount` values. Chart details explain the original payment versus the remaining report amount. The main editable transaction detail opens with `actual_amount`, preventing a report remainder from being written back as the original payment amount.
- Desktop and mobile retain the existing visual hierarchy. Balance text must remain subordinate to the amount and readable without widening the transaction row beyond the viewport.

## Verification and handoff evidence

The existing verification entry points are `scripts/unified-report-smoke.ts` and `scripts/unified-report-browser.mjs`. The smoke script exercises report and balance behavior; the browser script exercises the rendered flow. This documentation-only handoff does not claim a new run of either script.

The supplied finish-review screenshots are stored at `/home/yao/artifacts/tallybear/unified-report-20260927/`:

- [Desktop list](/home/yao/artifacts/tallybear/unified-report-20260927/desktop-list.png)
- [Mobile list](/home/yao/artifacts/tallybear/unified-report-20260927/mobile-list.png)
- [Desktop detail](/home/yao/artifacts/tallybear/unified-report-20260927/desktop-detail.png)
- [Mobile detail](/home/yao/artifacts/tallybear/unified-report-20260927/mobile-detail.png)

Future changes should preserve the distinction between period expenses and actual wallet movements, and keep projected costs from acquiring transaction balance or debit semantics.
