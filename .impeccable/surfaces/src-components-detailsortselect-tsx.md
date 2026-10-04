---
version: 1
slug: "src-components-detailsortselect-tsx"
primary_target: "src/components/DetailSortSelect.tsx"
related_targets: ["src/components/RecordsPanel.tsx","src/components/InteractiveFinanceChart.tsx","src/components/WalletFundsPanel.tsx","src/components/ActivitiesPage.tsx","src/components/FamilyFinance.tsx","src/components/GlobalSearch.tsx","src/components/AttentionRecords.tsx","src/components/Workspace.tsx"]
---

# Detail sorting extension

## Scope and authority

Mode: Operate. Record the compact sorting control added to existing entry lists. `PRODUCT.md`, the complete incumbent `DESIGN.md`, and the global design sidecar remain authoritative. This extension adds no new palette, typography, imagery, or global layout rule.

Apply the shared `DetailSortSelect` in records, chart-detail sheets, wallet cash-flow entries, activity entries, household movement records, verification/trash sheets, and the home preview. Global search keeps its own `FormSelect` with relevance as its initial option and the same four explicit time/value orders.

## Control and placement

Reuse the incumbent `FormSelect` trigger and `ChoicePicker` dialog: warm neutral text and surfaces, restrained borders, gently curved corners, chevron, accessible selected-value label, and established focus/dismissal behavior. The shared control has a compact maximum width (280px), shrinks to its container, and uses vertical spacing (12px). Keep it beside the list's existing filtering and before the entries rather than adding a new toolbar or decoration. Mobile uses the same readable control within the stacked filter area.

The shared control is labeled “明细排序” / “Sort entries”. Its four choices are `date_desc` (newest first), `date_asc` (oldest first), `amount_desc` (highest first), and `amount_asc` (lowest first); the initial shared value is newest first. Show Chinese/English labels according to the interface locale. Chart drilldowns relabel the value choices as quantity or unit price when those are the displayed metric. Global search additionally retains “相关结果优先” / “Best matches first” and its search-specific accessible label.

## Ordering behavior

Order the entire matched list before pagination or the home preview limit. Changing sort restarts pagination at its first page; household movements include sorting in the existing `PagedList` reset key. Preserve current date range, ownership, search, and other filters. In records, exporting all results follows the selected ordering.

Value sorting compares absolute magnitudes rather than treating expenses/refunds as small merely because their displayed sign is negative. Unknown values remain last in both directions. Equal values retain a deterministic chronological/creation/id ordering. Time ordering uses transaction date and available occurrence/creation time, with stable creation/id ties.

Sorting changes row order only: totals, chart series and chart point selection, ownership permissions, bookkeeping, and historical wallet balances retain their existing meanings. A chart detail list sorts by its actual displayed amount, quantity, or unit-price metric. The home heading reads “最近的小记录” for newest-first and “所选范围的小记录” for the other orders, so the preview describes its contents accurately.

## Evidence and disposition

Source: `DetailSortSelect.tsx`, `FormSelect.tsx`, `src/lib/detail-sort.ts`, and the related component targets in this brief's metadata. Render evidence: `/home/yao/artifacts/tallybear/detail-sort-20261004/screenshots/manifest.json`, with (40) synthetic-data captures spanning Chinese/English, desktop/mobile, funds, records, chart details, activities, family movements, global search, and asset placement. The refinement reviewer returned ship. Synthetic amounts and any individual screenshot's scroll position are not product defaults or new design rules.
