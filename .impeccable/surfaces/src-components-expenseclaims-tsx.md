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

The existing Sheet opens the single purchase. Read from payer avatar/name and status to purchase identity, amount/date/category, refunds and net consumption where present, line items and shared note. Place the no-debt/no-wallet-charge explanation before the destination choice. Destination options explicitly identify Private or Shared; explain shared-book visibility and that the sender receives no private-book access. Claim discussion follows the accounting context rather than replacing it.

## States and interaction

Pending recipients can accept into a chosen book or decline. Accepted recipients can change destination or cancel; senders can withdraw an active invitation. Retain confirmation for cancellation/withdrawal, disabled busy actions, loading/error feedback and manual refresh. Source updates and deletion produce contextual home notices; withdrawn or declined details preserve their frozen snapshot. Consumption copies remain one financial event, with wallet flows tied to the original payer. Private/shared destination choice must never suggest repayment or give the sender access to private books.

## Visual and responsive treatment

Inherit cream surfaces, warm ink, muted helpers, incumbent typography, buttons, `VisualSelect`, `Sheet` and `Discussion`. Reuse the existing current-member `Avatar` component at (40px) in claim details and (36px) in home rows. Identity and permission labels remain textual; character imagery never supplies authority.

Use flat record sections with the existing top rule, wrapping identities and preserved note line breaks. Actions wrap with (12px) gaps; at (600px) and below they flex into reachable rows, while avatars remain unshrunk and headings align at the top. Preserve the existing mobile Sheet scrolling and home-row stacking, keeping destination choices and actions reachable without horizontal overflow.

## Evidence and disposition

Sources are the targets above and `docs/purchase-claims.md`. Direction: `/home/yao/artifacts/tallybear/claims-20261019/direction.md`. Ten synthetic-data captures in its `screenshots/` directory cover desktop/mobile entry, existing-bill invitation, home claims, private destination, changing to shared, source updates and withdrawal notices at (1440 × 1000) and (375 × 812). There is no approved image comp; the narrow extension is code-led. Detector findings: none reported.

The finish reviewer returned **ship**, with no material fixes: private/shared destination, home invitation/update context, current avatars, no-debt/wallet explanation and original-payer control match the confirmed direction. Evidence is isolated synthetic browser/database verification, not deployment or physical-device acceptance. A production-build repeat of browser flows was underway at documentation time and is not recorded here as complete. Root design documentation and its sidecar remain unchanged because these are local surface decisions.
