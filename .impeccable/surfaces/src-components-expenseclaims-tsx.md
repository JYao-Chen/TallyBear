---
version: 1
slug: "src-components-expenseclaims-tsx"
primary_target: "src/components/ExpenseClaims.tsx"
related_targets: ["src/components/ClaimRecipientSelect.tsx","src/components/expense-claims.css","src/components/QuickEntry.tsx","src/components/DraftReview.tsx","src/components/Workspace.tsx","src/components/ChartTransactionDetail.tsx"]
---

# Purchase claim extension

## Scope and authority

Mode: Operate. Extend new-purchase entry, existing expense details and the home inbox within the incumbent TallyBear system. `PRODUCT.md` and `DESIGN.md` remain authoritative; this code-led local extension adds no global tokens, imagery or separate messaging surface. Actual accounting and lifecycle behavior is recorded in `docs/purchase-claims.md`.

The user confirmed both new and existing purchases, one recipient per purchase, and the recipient choosing their own writable private or shared destination book. A claim attributes consumption; it creates no debt, settlement requirement or second payment. Actual payment remains with the original wallet. Preserve other application behavior and pre-existing changes.

## Context and reading order

Manual entry and AI/import draft review reuse the labeled recipient selector, defaulting to Myself. Selecting a member reveals the adjacent explanation: the recipient receives an invitation and chooses their book; only this bill's details are shared, excluding private photos and unrelated records. Existing expense details, including chart details, show current recipient, actual payer and claim status before the focused assignment control. Assignment requires original payment-wallet ownership and editable source access; an accepted invitation must be withdrawn before changing its recipient.

Home Purchase claims & updates follows the existing inbox-row vocabulary: current author avatar/name and invitation or update context, purchase title and amount, date, then Review & claim or View update. Preserve five-row pagination and visible ranges, refresh, error and changed-event updates.

Home > 为他人购买 (Purchases for others) is the payer's permanent history, independent of unread notices. Its collapsible list retains sent, accepted and ended claims after reading and reloading. Reuse flat home rows with recipient avatar/name, purchase title/amount, date/status and View bill & discussion; retain five-row pagination, readable ranges, retry and expanded-state semantics. Opening a row shows the shared bill and discussion, never the recipient's destination-book identity, private notes or other records.

The existing Sheet opens the single purchase. Read from payer avatar/name and status to purchase identity, amount/date/category, refunds and net consumption where present, line items and shared note. Place the no-debt/no-wallet-charge explanation before the destination choice. Destination options explicitly identify Private or Shared; explain shared-book visibility and that the sender receives no private-book access. Claim discussion follows the accounting context rather than replacing it.

## States and interaction

Pending recipients can accept into a chosen book or decline. Acceptance makes that book the exclusive consumption destination: ordinary source-book records, reports, item/activity totals and search exclude the purchase and linked refunds, as do other pre-existing book copies. Selecting the original shared book keeps its single visible record. Financial-event identity and original payment facts remain intact; wallet history and the payer's permanent history continue to show the payment.

Accepted recipients can change destination or cancel; senders can withdraw an active invitation. Changing destination removes consumption from the former book; cancellation/withdrawal restores original attribution. Retain confirmation for cancellation/withdrawal, disabled busy actions, loading/error feedback and manual refresh. Source updates and deletion produce contextual home notices; withdrawn or declined details preserve their frozen snapshot. Explain exclusive destination, permanent payer access and no debt/wallet charge together before the picker. Private/shared destination choice must never suggest repayment or give the sender access to private books.

## Visual and responsive treatment

Inherit cream surfaces, warm ink, muted helpers, incumbent typography, buttons, `VisualSelect`, `Sheet` and `Discussion`. Reuse the existing current-member `Avatar` component at (40px) in claim details and (36px) in home rows. Identity and permission labels remain textual; character imagery never supplies authority.

Use flat record sections with the existing top rule, wrapping identities and preserved note line breaks. Actions wrap with (12px) gaps; at (600px) and below they flex into reachable rows, while avatars remain unshrunk and headings align at the top. Preserve the existing mobile Sheet scrolling and home-row stacking, keeping destination choices and actions reachable without horizontal overflow.

## Evidence and disposition

Sources are the targets above and `docs/purchase-claims.md`. Current direction: `/home/yao/artifacts/tallybear/claims-20261019/claim-move/direction.md`. Twelve synthetic-data captures in `claim-move/screenshots/` cover desktop/mobile payer history and claims, invitation, acceptance, private/shared destination changes and source-book exclusion at desktop (1440px) and mobile (375px). The payer history remains accessible after reading and reloading. There is no approved image comp; the narrow extension is code-led.

Fresh finish reviewer `claim_move_ui_review` returned **ship**, with no material fixes: incumbent rows, current avatars and Sheet remain consistent, mobile stays readable, and destination privacy is explicit. Evidence is isolated synthetic browser/database validation, not deployment or physical-device acceptance. This iteration is uncommitted and undeployed and adds no schema. Root design documentation and its sidecar remain unchanged because these are local surface decisions.

## Existing-entry editor correction (2026-10-19)

The existing QuickEntry edit form also loads the source claim and exposes the same recipient selector to the payer. Changed pending/new recipients are submitted with Save changes through the existing transaction update. Unchanged attribution is omitted; an accepted claim shows its recipient and withdrawal guidance. Load failure has an independent retry and does not prevent unrelated bill edits. Synthetic desktop/mobile component browser verification covers assignment, pending cancellation, accepted preservation and payer permissions (`scripts/claim-edit-browser.mjs`).
