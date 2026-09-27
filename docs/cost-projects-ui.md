# Cost projects: surface note

Recorded 2026-09-27 for the narrow cost-project extension. The existing [DESIGN.md](../DESIGN.md) remains the visual authority; this note introduces no global tokens, identity changes, or product commitments. `PRODUCT.md` is absent; this work extends the incumbent surface.

The implementation inherits the warm-neutral Operate UI, existing panels, typography, semantic colors, form controls, and chart presentation. Original payments, cost periods, participants, optional income offsets, and review are separate editor sections. Preview leads to an explicit confirmation action. Primary styling emphasizes preview/confirmation; navigation and selection use secondary buttons, with auxiliary actions using text buttons.

Cost attribution remains visibly distinct from actual wallet cash flow. Expected offsets are labeled separately from received offsets. The report states that it includes approved cost projects rather than ordinary unallocated spending, and exposes personal versus participating-project scope. Source-change warnings distinguish previous rules from currently valid totals. These are interface boundaries, not a substitute for backend validation.

The surface uses the existing planning and analysis destinations in `Workspace.tsx`; it adds no primary navigation destination. Growing editor/detail lists reuse `PagedList`; project and report lists retain previous/next controls and visible result ranges. At widths of 600px and below, form grids and editable labels stack, project rows become vertical, and toolbar buttons wrap. Buttons retain a 44px minimum height.

Implementation: `src/components/CostProjects.tsx`, `src/components/CostReport.tsx`, `src/components/cost-projects.css`, and `src/components/Workspace.tsx`.

Review evidence is stored under `/home/yao/artifacts/tallybear/cost-projects-20260927/`: `desktop.png`, `mobile.png`, `desktop-detail.png`, `mobile-detail.png`, `desktop-editor.png`, `mobile-editor.png`, `desktop-report.png`, and `mobile-report.png`. These captures cover the recorded list, detail, editor, and report surfaces; they do not establish validation of every data state or physical-device interaction.

Final review disposition supplied by the finish reviewer for the original cost-project extension: **ship for this narrow scope**. Detector result: `[]` (one pass). Global `DESIGN.md` and its sidecar are unchanged.

## Recurring plans and ledger filtering

`CostSchedules.tsx` extends Plans & allocation with an inline recurring-plan list. Each row leads with the next due date, acceptance/payment status and cycle amount. Creation, member acceptance, payment confirmation and history open in the same section, one task at a time, using the existing controls and responsive form grid.

Creating a plan records the first due date, cycle length, fixed monthly shares and the creator's cost ledger. It selects no wallet and records no payment. Each invited member accepts the displayed rule and chooses their own editable ledger through “My ledger and acceptance”; they can also withdraw acceptance. These ledger assignments apply to future confirmed cycles.

Once a cycle is due and every member has accepted, the owner confirms an actual payment. “Paid, not yet recorded” asks for the payment ledger, wallet and actual date; “Link a recorded payment” searches existing expenses and reuses the selected payment. The existing payment must equal the cycle amount. Successful confirmation opens the resulting allocation project and advances the cycle. Family transfers remain separate. The owner can pause or resume the plan; pausing stops payment confirmation. Changing amounts or participants requires pausing and creating a new rule, as described in [the implementation boundaries](expense-attribution-implementation.md).

Plan lists, recorded-payment search and cycle history use 20-item pages. History links processed cycles to their allocation and settlement detail, with loading and empty states. Due status is evaluated when plans load; this surface does not schedule automatic charges or notifications.

`CostReport.tsx` offers “Attributed costs in the current ledger only” when a current ledger is available and the personal scope is selected. It filters the participant's recorded cost-ledger assignments, including the ledger snapshot saved for each confirmed recurring cycle. The participating-project scope does not apply this filter. These totals remain approved attributed costs; they do not add another wallet transaction or include ordinary unallocated spending.

Recurring-plan browser evidence is stored under `/home/yao/artifacts/tallybear/cost-schedules-20260927/`. The supplied verification records no horizontal overflow at desktop width 1440px and mobile width 390px. The independent reviewer supplied a final **ship** disposition after confirming the three requested fixes. This review covers the narrow recurring-plan extension, not every data state or physical-device interaction.

## Member settlement transfers

`src/components/CostSettlementTransfer.tsx` extends the existing cost-project detail with inline sending and receipt forms, reusing the current controls, responsive form grid and `PagedList` for settlement history. The sender records an actual transfer with their own payment wallet, recipient, amount and date. The recipient selects their own receiving wallet and confirms receipt in the same section. Existing transfers can still be linked separately through “Link settlement”. This surface records transfers already made outside the app; it does not execute bank payments or create another expense.

A `pending` transfer awaits the recipient and contributes nothing to settlement; either party can cancel it. Receipt confirmation changes it to `confirmed`, updates both wallet balances and automatically includes it in project settlement. A `cancelled` transfer remains visible without contributing to settlement. Cost shares continue to follow the allocation rules. If the recipient has no personal wallet, the receipt form directs them to add one in Assets and disables submission.

Browser verification used synthetic data at 1440 × 1000 and 390 × 844: sending and receipt confirmation succeeded, with no horizontal overflow. Captures are stored under `/home/yao/artifacts/tallybear/cost-settlement-20260927/`. The final reviewer's sole P2 finding, missing guidance and submission disabling for a recipient without a wallet, has been resolved. These results cover the exercised browser flows, not every data state or physical-device interaction. See [implementation boundaries](expense-attribution-implementation.md) for the broader capabilities.
