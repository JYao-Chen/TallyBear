---
version: 1
slug: "src-components-familymovementdetails-tsx"
primary_target: "src/components/FamilyMovementDetails.tsx"
related_targets: ["src/app/globals.css"]
---

# Family movement payment-wallet correction

## Scope and authority

Mode: Operate. Extend the existing family movement detail with a focused source-wallet correction. `PRODUCT.md` and `DESIGN.md` remain authoritative. Preserve incumbent detail fields, cream surfaces, warm typography, `Sheet`, `VisualSelect` and discussion; introduce no global design or separate editing surface.

## Placement and interaction

Place Correct payment wallet immediately after the source/target detail fields, before reconstructed balances and discussion. Only the sender of a non-cancelled movement sees this control; recipients and cancelled movements have none. Keep My record and its private notes, attachments and display-book editor independent of this financial correction.

Opening the control preselects the existing source wallet. Show a labeled selector, concise accounting explanation, Confirm wallet correction and Cancel. Wallet labels combine distinct name, institution and suffix values without repeating the same bank label. Exclude the receiving wallet and retain applicable ownership restrictions. Disable submission for an unchanged or empty choice and while saving. Require explicit confirmation before applying; keep correction errors beside these controls and allow cancellation without changing the movement. Successful correction refreshes the surrounding data and closes the detail.

## Accounting meaning

Pending movements incur no debit when their source changes. For confirmed movements, move the existing debit from the old source wallet to the new one; do not send another payment. Recipient credit, amount, movement status and settlement links remain unchanged. Place this explanation next to the selector and repeat the material balance effect in the confirmation so source correction cannot read as another transfer or a private-note edit.

## Visual and responsive treatment

Use existing secondary/primary buttons, labeled fields, muted helper text and local error styling. The correction section follows the detail's natural reading order rather than adding another card. Retain its observed vertical spacing (12px above, 24px below), readable helper line height (1.7) and wrapping actions with (12px) gaps. At (600px) and below, buttons flex into reachable rows with a (130px) basis. Preserve existing Sheet scrolling and readable wallet labels on mobile.

## Evidence and disposition

Sources: `src/components/FamilyMovementDetails.tsx` and movement-source rules in `src/app/globals.css`. Direction: `/home/yao/artifacts/tallybear/movement-source-20261019/direction.md`. Synthetic component-browser captures `screenshots/correction-1440.png` and `screenshots/correction-375.png` record desktop/mobile correction states. Reported synthetic database tests cover pending/confirmed balances, sender and wallet eligibility, archived/stale choices and settlement preservation.

Fresh reviewer `movement_source_ui_review` returned **ship**, with no material fixes after duplicate bank labels were deduplicated. Evidence is synthetic UI/database validation, not production or physical-device acceptance. No production financial data changed; this iteration is uncommitted and undeployed. Global design documentation and its sidecar remain unchanged.
