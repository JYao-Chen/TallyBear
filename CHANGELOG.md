# Changelog

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
