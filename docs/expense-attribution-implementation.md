# Cost allocation implementation

Cost projects extend the application without changing the existing transaction or wallet calculation paths. Deployment uses the standalone additive migration described below.

## Available paths

- **Plans & allocation → Cost allocation & sharing** creates, searches, previews, revises and archives projects.
- **Recurring cost plans** stores future commitments without a wallet or transaction. Each participant accepts the recurring monthly share and selects their own editable ledger. A participant can confirm an incoming family transfer against the current cycle before the expense is paid; pending transfers credit the chosen wallet, and previously confirmed transfers are linked without another credit. When the payer confirms the real payment or links an existing one, these receipts are carried into project settlement and the cycle advances. Retries cannot create a second payment for the same cycle.
- Existing expense details offer a link to start a project from that payment.
- **Member transfers and receipts**, inside a paid cost project, records an actual personal-wallet transfer to another participant. The recipient selects their own receiving wallet and confirms there or through the existing family inbox. The pending link is stored atomically with the transfer; only confirmed transfers affect balances and settlement. Cancellation leaves a cancelled history row. No extra expense is created. Existing transfers can still be linked separately.
- **Income & expense analysis → Allocated project costs** reports approved project costs for the selected date range. The ordinary cash-flow view remains separate.
- Global search includes accessible cost projects. Assistant operation cards can query, create, revise, approve, archive and link existing settlements; writes still require confirmation.

## Calculation and access

An existing payment can contribute all or part of its amount. Multiple payments can fund a project. Equal calendar-month, actual-coverage daily, and custom-period modes preserve the total and each participant's total down to the cent. The coverage end is exclusive; report range endpoints are inclusive. Equal calendar-month attribution uses explicitly selected months, independent of the actual coverage dates.

Participant amounts describe the full-period cost before income offsets. Any received income, including salary, can contribute a partial amount. Expected offsets remain separate from realized offsets. Each participant can manage their own private offsets without changing anyone else's share. Explicitly shared offsets expose the assigned amount, not the private income record.

Other participants must accept a proposed shared version. Until acceptance, the previous valid version remains active. A first invitation can be rejected; that project is archived and its reservations released. A changed financial source invalidates the active cost calculation until reviewed and approved. Changed personal income makes its offset provisional until the participant saves it again.

Original transactions stay in their original personal or shared ledger. Other family participants receive the agreed cost summary, not private ledger records or wallet balances. Membership is checked on each access. Linking an already confirmed family transfer settles the assigned amount without executing another transfer.

## Current boundaries

This is the core implementation, not every item in the broader design document:

- Project payment sources currently come from the owner's personal wallets, across their editable ledgers. A shared ledger is supported; a family-owned wallet or a payment from another participant is not yet a project funding source.
- The new cost report includes approved cost projects only. It does not yet combine ordinary unallocated consumption, legacy allocations, budgets or exports into one accrual report.
- Legacy allocations are retained. An expense already using the legacy allocation must have that allocation removed before joining a new project; no historical conversion has been run.
- Existing project participant sets and family are fixed. Changes to amounts and periods are supported; changing participants requires a new project.
- Existing expense details and assistant operations are connected. Atomic creation of a transaction plus its project directly inside the entry draft is not implemented.
- Archive preserves historical costs. There is no project deletion or version-history rollback UI. Recurring plans snapshot each participant's chosen ledger into each paid project; the personal cost report can filter these assignments by the current ledger. These are attributed costs, not duplicate cash transactions.
- Assistant catalog and confirmation execution use the same server permissions. A live external-model conversation was not part of verification.
- In-project settlement starts after a valid paid project exists; advance transfers before the first payment can be recorded in Family transfers and linked once the project is created. The application records transfers, it does not send bank payments. Pending family transfers retain the existing behavior: neither wallet changes until receipt is confirmed.

## Storage and migration

`scripts/schema.sql` contains the additive tables. `scripts/cost-projects.sql` is the standalone additive migration for an existing database. Existing transactions and wallet balances are not rewritten. Rollback can restore the previous application code while retaining these additional tables.

`scripts/cost-schedules.sql` adds recurring rules, participant consent, processed-cycle markers and early member-settlement links. Apply it before running the new application. Pending status is derived from the saved next due date in Asia/Shanghai when the plan is loaded; there is no background payment, notification or bank integration. Missed cycles remain pending until processed. Pause stops confirmation; change amounts or participants by pausing and creating a new rule. The first version supports fixed monthly member shares and a payment every 1–120 months. Payment-source wallets are selected only at confirmation. A linked existing payment must equal the cycle amount. Personal salary offsets remain independent. Member transfers explicitly linked to a planned cycle are credited once and carried into that cycle’s project settlement.

Example: a plan beginning 2026-10-15 with three-month cycles and monthly shares of 2,900 and 1,400 creates no transaction at setup. Confirming payment creates or links 12,900 once, covering 2026-10-15 through 2027-01-15 exclusively, attributed to October, November and December. The next due date becomes 2027-01-15. The payer's cash view shows 12,900; personal cost views show 2,900 and 1,400 per month. Never add the two reporting bases together.

`src/lib/cost-attribution.ts` owns pure calculations. `src/server/cost-projects.ts` owns source reservations, permissions, approvals, personal offsets, project reports and settlement associations. All routes are authenticated by the existing application dispatcher.

## Verification

- `npx tsx --test tests/cost-attribution.test.ts`: amount conservation, individual shares, expected offsets, daily and custom ranges, large integers and partial-range consistency.
- `DATABASE_URL=<isolated *_cost_test database> npx tsx scripts/cost-projects-smoke.ts`: real PostgreSQL integration including private ledgers, consent, over-allocation rejection, partial salary linking, member privacy, source changes and wallet invariance.
- `scripts/cost-projects-browser.mjs`: isolated local app, desktop 1440×1000 and mobile 390×844, project details, editor and populated analysis views; no horizontal overflow and no app errors in the captured run.
- TypeScript, the existing unit suite and production compilation were exercised. UI review disposition was `ship` for this narrow extension; physical-device behavior and live AI behavior are not claimed by that review.
- `tests/cost-schedule.test.ts` and `scripts/cost-schedules-smoke.ts` cover calendar attribution, month-end anchors, advance-only-on-confirmation, consent, distinct private ledgers, duplicate/concurrent requests, existing payment reuse, pause, future dates and revoked family access. `scripts/cost-schedules-browser.mjs` captures desktop/mobile plan, editor, acceptance, payment and history views against the isolated database.

See `cost-projects-ui.md` for the observed interface structure and `expense-attribution-design.zh-CN.md` for the broader design.

`scripts/cost-settlement-smoke.ts` verifies duplicate requests, receipt permissions, wallet ownership, cancellation, confirmation through the existing family workflow, and unchanged 2,900/1,400 cost shares after a 4,300 payment. `scripts/cost-settlement-browser.mjs` exercises sender and recipient forms at desktop and mobile sizes against synthetic data.

### Early received member shares in analysis

A confirmed schedule settlement immediately projects the sender’s received amount across the cycle’s reporting months in their chosen attribution ledger and My expenses. Partial receipts project only the amount paid. The recipient gets no expense from receiving the transfer. Wallet cash flow and personal transfer rows show the linked schedule title while retaining transfer classification and the actual transfer date. Once the occurrence is processed, its prepaid projection is excluded and the resulting cost project supplies the period costs. This is a read projection: no extra transaction or wallet debit is created.
