# Contributing to TallyBear

Start with the development instructions in [README.md](README.md). Use Node.js 22 and a separate PostgreSQL database, never real household data in tests.

For a bug, include the app version, browser, deployment language/currency, steps to reproduce and expected behavior. Remove names, order IDs, account numbers, API keys and receipt images containing personal information before posting.

For a larger change, open an issue to discuss the intended user experience. Keep book permissions, integer monetary arithmetic, refund semantics and linked-event deduplication intact. AI actions must not claim a transaction was saved when they only prepared a draft.

Before submitting:

```sh
npm run typecheck
npm test
npm run build
```

Add focused tests for affected behavior. For UI changes, include desktop and mobile screenshots using synthetic data. Update English and Chinese README content together when behavior changes. Translation keys live in `src/lib/locales/en.json`.

Do not commit `.env`, uploaded receipts, database dumps, logs or generated build output.
