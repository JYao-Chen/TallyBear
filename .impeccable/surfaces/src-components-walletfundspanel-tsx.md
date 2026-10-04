---
version: 1
slug: "src-components-walletfundspanel-tsx"
primary_target: "src/components/WalletFundsPanel.tsx"
related_targets: ["src/components/AccountStatistics.tsx","src/components/Workspace.tsx"]
---

# Wallet cash-flow extension

## Scope and authority

Mode: Operate. Extend the existing wallet analysis surface; `PRODUCT.md` and every incumbent `DESIGN.md` rule remain authoritative. This brief records only `WalletFundsPanel` and its placements in personal-wallet analysis and personal or selected shared-wallet asset statistics. It establishes no new global tokens, identity, imagery, or composition system.

User intent: distinguish what was consumed from how money moved, include confirmed household transfers, and inspect existing movements without creating another expense or repeating a deduction. Personal scope means the current user's own wallets across books; shared scope means the selected household's shared wallets. Other members' private wallet balances are excluded.

## First viewport and information order

Lead with the wallet cash-flow heading, the consumption-versus-movement explanation, the exact selected date range, and a persistent ownership/confirmed-entry scope line. The scope line also states that search filters the entries below rather than period totals. Keep the range readable beside the heading on desktop and below the explanation on mobile; the panel header needs its own natural height and spacing within the workspace shell.

Follow with three clickable totals: money in, money out, and net cash flow. Their actions select incoming, outgoing, or all entries respectively. Below them, explain the components of incoming and outgoing amounts, then show opening book balance, adjustments, and closing book balance. Keep the closing-balance equation and internal-transfer, calibration, and credit-purchase explanation adjacent to these balances.

Then present outgoing composition and daily net cash flow with the existing interactive chart component and its accompanying amount lists. Finish with the matching entry count, search and flow selector, entry rows, and visible range/count/page navigation.

## Visual and responsive treatment

Use the incumbent cream background, warm ink, muted supporting text, soft purple focus treatment, and established green incoming/red outgoing amount roles. Inherit the established title/body fonts and currency formatting. Large amounts lead the totals; supporting accounting explanations remain smaller and readable. This extension adds no imagery or separate visual identity.

Desktop totals use three equal columns with (12px) gaps, gently curved cream surfaces (16px radius), and restrained borders. The two existing chart panels share a row. Opening, adjustment, and closing balances use a wrapping inline group above the explanatory note. Entries stay flat, separated by light rules, with descriptive copy left and amount plus detail affordance right.

At the component's mobile breakpoint (600px), stack the three totals and align each label opposite its amount; use the observed amount size (24px). Stack search and the full-width flow selector, stack charts, and allow heading, scope, notes, and entry text to wrap. Keep the pagination range centered and readable. Use the existing `Sheet` pattern for entry details: bottom panel on mobile and dialog on desktop, retaining its established focus and dismissal behavior.

## Interaction and accounting meaning

The API summary and chart data always describe the selected period and ownership scope. Search, flow filters, and pagination refine only the entry list. Searching or changing the flow filter returns to the first page. Each page holds up to (20) entries; display the current visible range, total matches, current page, and disabled previous/next states where appropriate.

The entry list also uses the incumbent compact `DetailSortSelect` below its filters: newest/oldest time and highest/lowest absolute amount. Sort the complete matching list before paging and return to the first page on a sort change. Sorting leaves period totals, chart series, and balance calculations unchanged; see `src-components-detailsortselect-tsx.md` for the shared extension.

Incoming components are income, refunds, and transfers in; outgoing components are purchases and transfers out. Internal movements between owned wallets remain inspectable and explicitly show no aggregate change. Balance adjustments remain separate from real incoming/outgoing payments. Closing book balance equals opening book balance plus net cash flow plus adjustments. Credit purchases reflect liability changes and must not be represented as equivalent cash payment.

Rows expose date, movement type, relevant wallet direction, and amount; household movement titles identify the counterparty when available. Opening a row reveals the existing movement's type, date, wallets, counterparty, aggregate balance change, reference, and notes when present. The detail explanation confirms that this view does not add consumption or repeat deductions. Retain visible loading, error, empty, labeled-control, and keyboard-focus states.

## Recorded evidence

Source: `src/components/WalletFundsPanel.tsx`, `src/components/wallet-funds.css`, `src/components/AccountStatistics.tsx`, and the personal-wallet placement in `src/components/Workspace.tsx`. Render evidence: `/home/yao/artifacts/tallybear/wallet-funds-20261004/screenshots`, covering summary, transfer filter, details, and asset placement in Chinese/English on desktop/mobile. These captures use synthetic household data; their example balances are evidence of layout, not product claims or seed values.

The finish-review disposition was ship after the panel-header collision and list-range fixes. Those fixes preserve readable component boundaries and pagination; they are not new global visual rules. No task-specific metric, chart layout, or accounting note is promoted into `DESIGN.md` or the design sidecar.
