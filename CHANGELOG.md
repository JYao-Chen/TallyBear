# Changelog

- Separate merchandise from discounts and fees in receipt drafts, manual entry, assistant cards and saved details, with independent pagination and amount reconciliation. AI normalizes supported checkout labels; adjustments do not become repeat-purchase memories.

## Unreleased — current `main`

### Added

- Unified financial memory: scoped retrieval, product evidence, private/shared memory management, separate model configuration, versioned vector rebuilds, and assistant confirmation cards. DashScope defaults now use text-embedding-v4 and qwen3.8-flash. Grounded product extraction, per-field fill/undo and preference conflict review passed five live-model cases. Historical title-only entries are supported, fees/discounts excluded, and deleted-source preferences recalculated. See `docs/financial-memory.md` for initialization and rollout requirements.

- Expanded personal defaults to 31 categories, including digital subscriptions, daily essentials, electronics, personal care, accommodation, fitness, pets, parenting, insurance and fees. Existing personal overrides remain intact; AI classification guidance distinguishes purpose from activity grouping.

- Unified cross-book search for refund selection, editable detail fill, paginated results, and repeat-purchase totals. Repeat purchases are automatically associated during AI recognition and assistant entry preparation without an extra entry point. Personal confirmed product memory preserves new prices and payment IDs. Delivery orders now use food-led titles while dine-in retains merchant-led titles.
- Multiple refunds and cashback may exceed the original payment; negative net spending is retained in the refund calculator and allocations. Selecting a refund original from another book no longer requires moving the purchase.

- Personal activity grouping across books, with optional budgets and dates, entry assignment during manual/OCR review, existing-entry assignment, and filtered charts plus paginated details. Actual transactions, wallet balances and book ownership remain unchanged.
- Activities now support custom types, family participation, searchable active and archived views, reactivation, safe deletion, a Home quick-entry shortcut, global search and assistant queries. Family participation does not grant access to private books.
- A unified **Spending analysis** workspace combines charts with searchable, filterable and paginated records. Its charts and totals follow the same active filters, including personal-wallet reporting across books.
- Asset analysis adds balance distribution, daily income/spending and spending-category charts for either personal wallets or a selected family's shared wallets, alongside the existing wallet table.
- Deterministic personal category learning shared by receipt recognition and AI action cards. It uses the current user's confirmed entries, presets and corrections across accessible books; ranks route, merchant, item and scene evidence; applies recency decay and confidence thresholds; and never overrides an explicitly selected category.
- Visible category-suggestion explanations in review cards, including basis, confidence and evidence count. Saving a changed category records a stronger correction signal for future suggestions.
- A dedicated AI-assistant model configuration, separate from receipt-recognition text/vision models. Assistant image understanding and nested assistant calls stay within the assistant configuration.
- Automatic personal-wallet matching when receipt evidence identifies an unambiguous funding source or a unique WeChat/Alipay wallet. Ambiguous wallets remain unselected for review.

### Changed

- Categories now belong to the signed-in user instead of an individual book. Upgrade merges categories from every accessible book into each user's personal catalogue, while preserving other members' independent catalogues.
- Expanded the default catalogue from existing user practice with Drinks, Clothing & accessories, Delivery fees, and Gifts & social.
- Growing record, search, management and history lists use bounded pages instead of indefinitely extending the page.
- The separate **Records** navigation entry was removed; global search and record-return flows now open the unified Spending analysis workspace.
- The old cross-book overview page was removed; book-scoped reporting remains in the normal analysis views, while actual personal cash flow is available through the personal-wallet scope.
- The category-history option is now **Use my category habits**, enabled by default for new recognition drafts and assistant conversations. Matching runs on the server without sending personal history to the model.
- Expanded the bilingual README and user guide with the current activity, assistant reconciliation and optional payment-reference workflows; aligned deployment and operations checks with current behavior.

### Fixed

- Added an accessible mobile logout action; sign-out flushes local drafts before ending the session.
- Kept order/payment platform detection separate from the actual funding wallet, avoiding arbitrary wallet selection when several accounts match.
- Treated absent and `null` optional fields consistently when merging complementary receipt screenshots, so valid duplicate orders are not retained twice.
- Reflowed narrow-phone Activity actions and deletion confirmation so archive, restore and delete labels fit their buttons; retained the mobile navigation in short landscape viewports.

## 1.5.0 — 2026-09-16

**Conversational bookkeeping and independent personal/family finance.**

### Added

- Editable AI confirmation cards for entries, subscriptions, presets, budgets, allocations, installments, repayments and family movements.
- Family transfers, gifts, shared contributions, AA shares/settlement, loans and repayments; private recipient wallet selection and independent personal-book display links.
- Installment and debt management with partial/early repayment, schedule changes, reversal and separate cost allocation.
- Structured spending scenes, reusable quick-entry presets, relevant-history matching and transaction/create/update timestamps.
- Selectable assistant analysis scope, multicolor charts with transaction drilldown and deletable chat/report history.

### Changed

- Assets belong to people or families independently of books; moving/reusing records preserves their funding account and deduplicated event identity.
- Redesigned desktop/mobile conversations with an expanding composer, integrated attachments and lower-latency stream delivery.
- Paginated growing lists, icon-rich selectors, category ordering and wallet management.
- Comprehensive English/Chinese README and guides; package and Compose image version updated to 1.5.0.

### Fixed

- Saved transaction edits without external IDs and nested-dialog scrolling after moving entries.
- Action cards drifting to the latest turn, invalid AI line-item types and unavailable direct item editing.
- Overstated verification errors for partial checkout evidence and noisy OCR notes.
- Family duplicate-reference checks, repeat confirmation, private wallet visibility and display moves without extra balance changes.

[Full release notes / 完整发布说明](docs/releases/v1.5.0.md) · [Upgrade](docs/deployment.md#upgrading-to-150)

## 1.0.0 — 2026-09-14

First public TallyBear release.

- AI receipt recognition across batches, long images and multi-image orders; editable items, checkout discounts, duplicate suggestions and amount verification.
- Tool-using financial assistant with LangGraph, charts, saved reports and durable background jobs.
- Independent accounts, families, private/shared books and personal/shared wallets.
- Budgets, recurring periods, exact cost allocation, refund handling and linked transaction reuse.
- Optional compressed vouchers and personal photos; full-text/category/item search.
- English/Simplified Chinese and CNY/USD/EUR/GBP deployment configuration, one currency per database.
- Bear and minimal themes, 564 stickers, custom date/month pickers and desktop/mobile layouts.
- New dual-bear identity, bilingual documentation and Docker Compose deployment.

- Verified Docker startup and captured desktop/mobile screenshots using fictional demo data.
- Renamed runtime services and project directories to TallyBear.
