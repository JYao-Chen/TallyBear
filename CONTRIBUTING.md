# Contributing to TallyBear

Start with the development instructions in [README.md](README.md). Use Node.js 22 and a separate PostgreSQL database, never real household data in tests.

For a bug, include the app version, browser, deployment language/currency, steps to reproduce and expected behavior. Remove names, order IDs, account numbers, API keys and receipt images containing personal information before posting.

For a larger change, open an issue to discuss the intended user experience. Keep book permissions, integer monetary arithmetic, refund semantics and linked-event deduplication intact. AI actions must not claim a transaction was saved when they only prepared a draft.

Respect the current scope boundaries:

- Book reports classify records; personal-wallet reports follow wallets owned by the signed-in user across books. Do not expose another member's private balances or include family/shared wallets in the personal scope.
- Receipt order platform, payment channel and actual funding account are separate facts. Never choose an arbitrary wallet when several accounts match.
- Personal category learning is deterministic server-side logic. It must use only the current user's eligible evidence, preserve explicit categories, decline weak/ambiguous matches and record corrections only after a successful save.
- Receipt recognition and AI assistant model settings are independent. Assistant images and nested calls stay in the assistant scope; quick receipt OCR stays in the recognition scope.
- Growing user-visible lists need bounded pagination and must reset safely when their filter scope changes.

Before submitting:

```sh
npm run typecheck
npm test
npm run build
```

Add focused tests for affected behavior. For UI changes, include desktop and mobile screenshots using synthetic data. Update English and Chinese README content together when behavior changes, and update `docs/user-guide.md`, deployment notes or `OPERATIONS.md` when the user workflow, schema or release procedure changes. Translation keys live in `src/lib/locales/en.json`.

Do not commit `.env`, uploaded receipts, database dumps, logs or generated build output.
