# Correct a family transfer's payment wallet

A transfer's **Correct payment wallet** control appears to its sender in the movement details, below the shared facts and before the reconstructed wallet balance. It is separate from **My record**, which edits private annotations and display-book preferences.

Choose an active personal or eligible family wallet, then confirm. The server accepts `operation: correct-source` with `id`, `sourceId` and `expectedSourceId` at the existing family-finance POST endpoint. It checks current family membership, sender identity, current source, active wallet access, transfer-purpose ownership rules and source/target inequality. Cancelled transfers cannot be corrected. The recipient cannot change the sender's payment wallet.

The same movement is updated; its amount, date, recipient, target account, confirmation status, settlement links and discussion stay intact. A pending movement remains unpaid. For a confirmed movement, existing wallet calculations remove the debit from the old source and apply it to the new source; the recipient's credit stays unchanged. This records a correction, not another transfer or bank operation. Existing private annotations remain intact; the sender's detail modification time is refreshed.

No database schema change is required. The feature does not infer which bank card a real transfer used or automatically change existing records.

Verification:

- `MOVEMENT_TEST_DATABASE_URL=postgres://.../movement_test node --import tsx --test tests/movement-source-db.test.ts` uses a disposable local database and rolls back synthetic records. It covers pending/confirmed balances, recipient credit, wallet history, preserved record fields/annotations/settlement links, sender-only access, active wallet access, stale-source conflicts and cancelled/same-wallet rejection.
- `scripts/movement-source-browser.mjs` uses the real component with synthetic API responses at desktop and mobile widths. It checks selection, the correction payload, confirmation, refresh/close callbacks, conflict feedback and visibility for sender/recipient/cancelled/pending states.
