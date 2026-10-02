# Assistant financial queries

The assistant uses one validated filter set for summaries, transaction lookup, charts and chart drilldown. Supported filters include dates, category, wallet, activity, creator, merchant, product, platform, order/payment reference and order amount range. Keyword searches still match order records; they are not semantic transaction searches.

## Consistent results

`financial_summary`, `find_transactions` and `analyze_items` return a `queryId` and normalized `filters`. `draw_chart` can reuse this identifier; if omitted, a chart with the same metric inherits the most recent financial query in the current turn. Explicit fields override inherited values. Unknown references fail rather than falling back to an unrestricted chart.

Charts persist filters, book scope and metric. Clicking a point keeps those conditions and adds an exact group or a clipped day/week/month interval. Weeks start on Monday. Groupings support category, merchant, product summary, wallet and platform. Income charts aggregate income; expense charts aggregate expenses minus refunds.

Transaction results expose `total`, `offset`, `limit`, `hasMore` and `nextOffset`. Totals cover every matching record, not just the displayed page. Linked copies across books count once. Period expense uses the existing allocation logic; transaction lookup, item evidence and personal wallet scope use actual cash flow. Transfers do not become consumption.

## Product prices and quantities

`analyze_items` and item-metric charts operate on recorded merchandise rows, excluding discounts and fees. Product filters select matching item names, rather than attributing the whole order payment to one product.

- `item_amount`: sum of recorded matching item subtotals, less matching refund rows.
- `quantity`: recorded matching quantities, less matching refund quantities.
- `unit_price`: quantity-weighted recorded unit price; missing unit price may be derived from a known item subtotal and positive quantity.

Unknown subtotals, quantities and prices stay unknown and are counted explicitly. They are not filled from order payments or treated as zero. Order-level discounts and fees are not allocated to products, so recorded unit price is not necessarily effective price after checkout adjustments. Orders without item evidence cannot establish a product's unit price.

All financial tool totals and item row monetary fields use integer minor units or numeric minor-unit averages. Chart points use major currency units; quantity points have no currency. The interface distinguishes the metric and displays incomplete-evidence warnings. Queries never modify transactions.

## Verification

Unit tests cover retained filters, exact group drilldown, interval clipping, weekly grouping and date/amount validation. `scripts/finance-query-smoke.ts` requires the isolated `tallybear_query_test` database and exercises five groups: filtered chart consistency/deduplication, weighted prices/unknowns, merchandise-only subtotals, personal scope/income and pagination/reference handling. It creates synthetic records only and must not be run against production.
