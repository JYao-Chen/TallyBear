# Purchases for another member

A payer can nominate one family member for a purchase. The member receives a home invitation, reviews the bill and chooses a private or shared book they can edit. Acceptance attributes the consumption to that member; it does not create debt, require reimbursement, move the payment wallet or record another payment.

## Entry points

- Manual entry and AI/import draft review: Purchase recipient defaults to Myself. Selecting a member sends an invitation when the expense is saved. Recognizers do not invent recipients.
- Existing expense details, including chart details: Save purchase recipient sends or changes a pending invitation. The actor must own the payment wallet and be able to edit that record. Shared-wallet expenses and another person's claimed copies cannot be reassigned through this control.
- Home Purchase claims & updates: Review & claim opens the single bill, payer identity, amount, details, shared note and claim discussion. The recipient chooses their own destination book. The payer receives neither the recipient's private-book list nor private-book access.
- Home Purchases for others: a permanent payer-only list of sent invitations, accepted purchases and ended claims. Reading notices never removes this entry. It opens the single bill and discussion without exposing the recipient’s destination book or its other records.
- Claim details: a pending invitation may be accepted or declined; the recipient may change the destination of an accepted claim or cancel it. The sender may withdraw it. An accepted claim must be withdrawn before nominating a different member. Both parties receive state-change notices.

Only the nominated record's details and note are shared, not the rest of the source book. Private photos and attachments are not automatically copied. Discussion is restricted to the payer and recipient under current family membership and works before acceptance. Source-book discussions remain separate.

## Accounting and synchronization

Acceptance transfers consumption display to the chosen book: the original book’s ordinary records, book reports, item reports, activity totals and ordinary search no longer include the purchase or its linked refunds. Other pre-existing book copies of the event are also excluded while this claim is accepted. Choosing the original shared book keeps its single record visible there.

Claimed rows use the existing financial event identity. Book reports and cross-book reports deduplicate the same purchase; actual wallet reports and their item drilldowns still follow the original wallet owner. Original payment facts stay intact for wallet history and the permanent Purchases for others entry. The payer can also select the original through the refund picker; managed claim copies are excluded from that picker. My expenses attributes an accepted expense, including its linked refunds, to the recipient instead of the payer. Ordinary transfers remain separate fund movements.

A claim-created display copy retains the original payment account. It is managed through claim controls rather than independent edit/move/copy/delete actions. The payer can update financial facts despite having no access to the recipient's private book. Amount, date, payer account, title, product, merchant and line items synchronize; categories and local notes remain book-specific under the existing linked-record convention. Existing and later linked refunds follow the chosen destination and remain deduplicated. The claim detail shows received refunds and net consumption. The payer’s permanent view retains the original shared bill details and claim discussion, not access to the recipient’s private notes or other records.

Changing destination makes consumption disappear from the former destination and appear in the newly selected book. Cancelling or withdrawing restores the original consumption attribution. These operations soft-delete only display copies created by the claim. A record already present in the chosen shared book is reused and is not deleted when the claim ends. Reaccepting in a previously used book can restore its managed display copy. Removing the original expense withdraws the claim, removes its managed copies and notifies the recipient. Source changes notify the recipient and advance the claim version, so accepting a stale preview requires refreshing first.

A withdrawn/declined claim shows a frozen snapshot rather than reading future private changes. Leaving the last shared family withdraws active invitations/claims, removes managed copies and notifies both members. Historical notices remain accessible to their participants; claim discussion requires current family membership.

One purchase has one active recipient. Existing member cost-project or AA allocations must be resolved before using claims, and an outstanding claim must be withdrawn before setting member cost allocation. This avoids overlapping attribution models. This release does not introduce multi-recipient splitting, reimbursement settlement or automatic debt.

## Initialization and verification

The normal initializer now runs `scripts/expense-claims-schema.sql` after the discussion schema. It creates `expense_claims`, `expense_claim_links`, `expense_claim_events`, an active-event uniqueness index and source-change/family-departure triggers. Existing records are not nominated or copied automatically.

Run the database test against a disposable local database ending in `_test`:

```sh
CLAIM_TEST_DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:PORT/claims_test \
  node --import tsx --test tests/expense-claims-db.test.ts
npm run typecheck
npm test
npm run build
```

The test initializes the schemas and rolls synthetic fixtures back. It verifies private-book isolation, destination permissions, one-copy event totals, unchanged wallet flows, recipient expense attribution, refunds, payer edits, notices, moving/cancelling/withdrawing, pre-existing shared copies, reinvitation, discussion permissions and family departure.

`scripts/expense-claims-browser.ts` exercises actual forms, existing-bill invitation, home cards, private/shared destinations, discussion, authenticated payer updates/deletion and desktop/mobile layouts. Start the app with an isolated local CNY/Chinese database and matching APP_ORIGIN; supply DATABASE_URL, CLAIM_TEST_ORIGIN, TEST_ARTIFACT_DIR and PLAYWRIGHT_MODULE. The script seeds synthetic records and sessions, so use a disposable database. No production accounts, bills or model calls are needed.
