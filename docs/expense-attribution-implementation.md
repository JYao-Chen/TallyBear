# Cost allocation implementation

Cost projects extend the application without changing the existing transaction or wallet calculation paths. Deployment uses the standalone additive migration described below.

## Available paths

- **Plans & allocation → Cost allocation & sharing** creates, searches, previews, revises and archives projects.
- Existing expense details offer a link to start a project from that payment.
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
- Archive preserves historical costs. There is no project deletion or version-history rollback UI. Display-book assignment has an API but is not used to filter the new report yet.
- Assistant catalog and confirmation execution use the same server permissions. A live external-model conversation was not part of verification.

## Storage and migration

`scripts/schema.sql` contains the additive tables. `scripts/cost-projects.sql` is the standalone additive migration for an existing database. Existing transactions and wallet balances are not rewritten. Rollback can restore the previous application code while retaining these additional tables.

`src/lib/cost-attribution.ts` owns pure calculations. `src/server/cost-projects.ts` owns source reservations, permissions, approvals, personal offsets, project reports and settlement associations. All routes are authenticated by the existing application dispatcher.

## Verification

- `npx tsx --test tests/cost-attribution.test.ts`: amount conservation, individual shares, expected offsets, daily and custom ranges, large integers and partial-range consistency.
- `DATABASE_URL=<isolated *_cost_test database> npx tsx scripts/cost-projects-smoke.ts`: real PostgreSQL integration including private ledgers, consent, over-allocation rejection, partial salary linking, member privacy, source changes and wallet invariance.
- `scripts/cost-projects-browser.mjs`: isolated local app, desktop 1440×1000 and mobile 390×844, project details, editor and populated analysis views; no horizontal overflow and no app errors in the captured run.
- TypeScript, the existing unit suite and production compilation were exercised. UI review disposition was `ship` for this narrow extension; physical-device behavior and live AI behavior are not claimed by that review.

See `cost-projects-ui.md` for the observed interface structure and `expense-attribution-design.zh-CN.md` for the broader design.
