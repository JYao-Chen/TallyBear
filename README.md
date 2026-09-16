<div align="center">

<img src="public/brand/tallybear-logo.png" width="140" alt="TallyBear — Bubu & Yier bear-themed AI bookkeeping" />

# TallyBear

**Your receipts, understood. Your finances, in view.**

An AI-powered personal and family finance app with a **Bubu & Yier (布布一二 / 一二布布) bear theme**.
Self-hosted · Conversational bookkeeping · Family transfers · Bubu & Yier companions

English · [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/v1.5.0-78618f?style=flat-square)](https://github.com/JYao-Chen/TallyBear/releases/tag/v1.5.0)
[![MIT](https://img.shields.io/badge/code-MIT-43755e?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/deploy-Docker-d2a363?style=flat-square)](docs/deployment.md)

[Get started](#get-started) · [Explore the features](#from-receipt-to-insight) · [Deployment guide](docs/deployment.md) · [Latest release](https://github.com/JYao-Chen/TallyBear/releases)

</div>

**Bookkeeping with Bubu & Yier.** White and brown bear illustrations, animated stickers and customizable category icons bring a playful touch to everyday finances. Choose the bear theme or switch to a clean, minimal interface.

![Spending analysis](docs/screenshots/desktop-analysis.png)

## New in 1.5

**From receipt recognition to conversational bookkeeping and family finance.**

Editable AI action cards · Private recipient wallet confirmation · Personal-book transfer views · Installments and exact cost allocation · Scoped analysis with chart drilldown · A redesigned mobile/desktop conversation workspace.

[Read the 1.5 release notes →](docs/releases/v1.5.0.md) · [Upgrade an existing installation →](docs/deployment.md#upgrading-to-150)

## From receipt to insight

Drop in your receipts. Review the details. Ask what your money is doing.

<table>
<tr>
<td width="33%" align="center">
<img src="public/characters/overalls.gif" height="90" alt="Capture"/><br/>
<strong>01 · Capture</strong><br/>
Images become editable records.<br/>Keep the merchant, items and discounts.
</td>
<td width="33%" align="center">
<img src="public/characters/thinking.gif" height="90" alt="Reconcile"/><br/>
<strong>02 · Reconcile</strong><br/>
Check totals and spot duplicates.<br/>Bring related pages into one order.
</td>
<td width="33%" align="center">
<img src="public/characters/cheer.gif" height="90" alt="Understand"/><br/>
<strong>03 · Understand</strong><br/>
Ask questions, explore charts.<br/>Save the reports that matter.
</td>
</tr>
</table>

### Capture a receipt, describe a purchase, or tap a preset

Upload several receipts, order screenshots or one long image. AI distinguishes separate purchases from overlapping pages of the same order and produces editable drafts. Manual forms and reusable presets cover fixed commutes, routine purchases and regular income.

| Detail | How it works |
|---|---|
| Merchants and products | Merchant-led titles, concise product summaries and separate itemized rows. |
| Checkout | Quantities, unit prices, subtotals, discounts, rounding and extra fees; the paid total remains the transaction amount. |
| Partial screenshots | Distinguish incomplete checkout evidence from conflicting amounts. Confirm the actual payment with an explanation instead of inventing a balancing discount. |
| Duplicates and refunds | Compare existing records, review potential duplicates, and link full or partial refunds to the original purchase. |
| Dates and notes | Keep transaction, creation and modification timestamps; use device time when transaction time is missing. Notes focus on useful context. |
| Attachments and search | Optionally retain compressed vouchers and everyday photos; search merchants, categories, amounts, dates and individual items. |

Transport, dining, shopping and groceries use structured scene fields: departure and arrival stops, merchants and branches, meal types and product summaries. AI drafts, manual forms and presets share those fields, with editable titles.

Optional preference matching selects relevant history and presets to keep categories and descriptions consistent, rather than simply passing the latest records to the model.

### AI that prepares the action, not just the answer

> “I took the bus from Central Station to Riverside. It cost $2, paid from my wallet.”
>
> “Record this annual subscription and spread its cost over the coverage period.”
>
> “I sent my partner my share of the rent. Help me record the family transfer.”

The assistant looks up real books, categories, wallets and family members, then uses tools to prepare **editable confirmation cards**. Fill missing or ambiguous details in conversation or directly on the card: wallet, category, amount, scene and line items. Confirm the card to save.

| In conversation | Supported actions |
|---|---|
| Everyday records | Expenses, income, refunds, transfers and itemized purchases |
| Repeatable tasks | Quick-entry presets, recurring subscriptions and category budgets |
| Longer-term costs | Cost allocations, installment purchases and actual repayments |
| Family movements | Transfers, gifts, AA shares and settlement, loans, repayments, shared-wallet contributions and receipt confirmation |
| Financial insights | Selected-book analysis, transaction and asset queries, interactive charts and saved reports |

Cards stay with their originating turn. Delete conversations and reports from history. The responsive composer expands with your text and brings attachments and options into the input area on desktop and mobile.

### Assets hold the money. Books organize the view.

- Wallets belong to a person or a family, independently of books. Manage multiple payment wallets and bank accounts with recognizable account and bank icons.
- Users sign in independently and can join families with several books. Users, families and books have separate management, avatars and permissions.
- A personal wallet can pay for a shared-book expense. Moving a record preserves its funding account; linked reuse across books counts the same event once in consolidated totals.
- Create, edit, delete and reorder categories with custom icons. Organize entries in batches, move them or link them to another book.

### One family transfer, two personal views

The sender selects **their own funding wallet and the recipient**. The recipient confirms receipt into **their own wallet**, which can differ from the sender’s payment platform. Neither party sees the other’s private wallets; authorized members manage shared family wallets.

Each person independently selects a personal display book, with a remembered default. Its **Home and Records** views show movements alongside everyday records. The home **Incoming transfers** inbox lets recipients choose their own wallet and book and confirm receipt. Changing the display book does not move money or change the other person’s record. Existing movements can be assigned a display book later.

| Shared-rent example | Where it appears | Household spending |
|---|---|---|
| One member sends the other their 1,500 share | Family history and each selected personal book | None |
| The payer pays the landlord 3,000 | The shared book selected for the expense | 3,000 |
| Each member contributes 500 to a shared wallet | Family history and their selected personal books | None |

Gifts, loans, partial repayments, AA settlements and shared contributions use the same movement model. AA links to the original expense and agreed shares; repayments link to the loan. Payment references and similar transfers are checked before posting. A movement remains one underlying record, with balances updated after confirmation. Gifts count as personal expenses for the sender and income for the recipient; consolidated household reporting eliminates internal income and expenses. Transfers, loans, repayments, AA settlements and shared contributions remain non-consumption flows.

### Subscriptions, installments and allocation answer different questions

| Feature | Question | Accounting behavior |
|---|---|---|
| Recurring schedules | When is payment due? | Custom day/week/month/year intervals; review the actual payment when due. |
| Installments and debt | What is owed and repaid? | Record consumption at purchase, principal repayments as transfers, and interest/fees as expenses. |
| Cost allocation | How long does the paid cost cover? | Distribute cost over the selected period with exact rounding, without another wallet debit. |

Use credit or BNPL accounts, create a plan from a new or existing purchase, record partial or early repayments, revise future installments and reverse an incorrect repayment. Allocation remains independent of debt repayment: early settlement does not shorten the coverage period. Refunds into the debt account reduce principal.

### Explore the chart, then the entries behind it

Choose the **current book, selected books or all accessible books** in the conversation composer. Consolidated analysis deduplicates linked records; asset queries use personal/family ownership scopes, keeping differing reporting scopes distinct from missing entries.

Explore multicolor category, doughnut, bar and trend views. Charts with a query dimension let you select a category or time point to inspect related transactions. Save useful analysis as a report and return to it later.

Recognition and chat run as durable background jobs with progress, streaming responses, retries and administrator-controlled concurrency. Leave the page and return when the result is ready.

## A little company for everyday money

Choose the Bubu & Yier theme for warm colors and **564 animated stickers**, or switch to a minimal workspace. Use the sticker library for avatars, categories and book identities.

<p align="center"><img src="public/characters/together.gif" height="120" alt="Bear companions"/> &nbsp; <img src="public/stickers/bubu-yier-560.gif" height="120" alt="Shopping companion"/></p>

<table>
<tr>
<td width="50%" align="center"><strong>Your book, on the go</strong><br/><br/><img src="docs/screenshots/mobile-overview.png" width="280" alt="Mobile overview"/></td>
<td width="50%" align="center"><strong>Every item adds up</strong><br/><br/><img src="docs/screenshots/mobile-line-items.png" width="280" alt="Itemized receipt on mobile"/></td>
</tr>
</table>

<details>
<summary><strong>Explore the desktop workspace</strong></summary>

#### AI intake
![AI intake workspace](docs/screenshots/desktop-intake.png)

#### Receipt details
![Receipt details](docs/screenshots/desktop-line-items.png)

</details>

<details>
<summary><strong>简体中文 · Chinese interface</strong></summary>

![中文收支分析](docs/screenshots/zh-desktop-analysis.png)

<p align="center"><img src="docs/screenshots/zh-mobile-intake.png" width="280" alt="中文智能录入"/> &nbsp; <img src="docs/screenshots/zh-mobile-line-items.png" width="280" alt="中文商品与结算明细"/></p>

</details>

## Technology & AI architecture

TallyBear combines a **Next.js full-stack app, PostgreSQL and a dedicated job worker**. The UI and API share TypeScript domain types. Transactions, permissions, job progress and reports live in PostgreSQL; Sharp compresses images into persistent attachment storage.

| Layer | Technology | Responsibility |
|---|---|---|
| Interface | React · Next.js App Router | Responsive entry, draft review, conversations and book management |
| Business & data | Next.js API · PostgreSQL | Permissions, transactional writes, balances, cost allocation and deduplicated totals |
| AI collaboration | LangGraph · tool calling | A supervisor delegates receipt reading, reconciliation and analysis |
| Background execution | Node.js worker · PostgreSQL queue | Durable jobs, progress, retries and configurable concurrency |
| Artifacts & images | Recharts · Markdown · Sharp | Conversational charts, saved reports and compressed vouchers |

### A supervisor with specialist agents

Conversations use a **supervisor + specialists** architecture. Each agent follows a LangGraph loop of model decisions, tool execution and follow-up decisions. The supervisor answers simple questions with tools or delegates focused tasks, then uses the returned evidence to continue or summarize.

| Agent | Capabilities | What you get |
|---|---|---|
| Supervisor | Understand requests, select tools, delegate and synthesize | One continuous conversation about your finances |
| Entry & plans | Prepare editable entry, subscription, budget, installment and family-movement proposals | Confirm a completed form in conversation |
| Recognition | Read images and text; assemble orders across images | Merchant titles, line items, discounts and editable drafts |
| Reconciliation | Inspect drafts, find duplicates, check refunds and totals | Reviewable differences, duplicate matches and linking suggestions |
| Analysis | Query transactions, accounts, budgets and allocations; draw charts | Data-backed explanations, charts and reports |

**AI interprets the content; business tools calculate the money and enforce permissions.** Chart tools query ledger aggregates directly, and amounts use integer minor units. Models select useful questions and explain results. Receipt processing combines structured extraction with amount checks to produce reviewable entries.

Specialists share the current drafts and previous findings through the supervisor. The background queue processes concurrent jobs, while conversations display processing stages, tool activity and streamed answers. Work continues between visits. Provider endpoints, text and vision models, and queue concurrency are configurable.

Cards are proposals until the user confirms. Confirmation validates permissions and current data inside a database transaction; family movements keep a single record with separate per-user book display links. PostgreSQL stores job progress and conversation artifacts so the worker can keep running while the browser is closed.

The result connects **capture → reconcile → confirm → save → analyze**: less manual transcription, visible duplicate and amount checks before confirmation, and financial questions turned into charts and reports you can keep.

## Get started

You’ll need **Docker Compose v2** and **Node.js 22** for the setup helper.

```sh
git clone --branch v1.5.0 https://github.com/JYao-Chen/TallyBear.git
cd TallyBear
npm run setup
```

Set your language, currency and address in the generated `.env`:

```dotenv
APP_ORIGIN=http://localhost:3016
APP_LANGUAGE=en
APP_CURRENCY=USD
```

```sh
docker compose up -d --build
```

Open [**localhost:3016**](http://localhost:3016). Sign in with `ADMIN_USERNAME` and the generated `ADMIN_PASSWORD` from `.env`, create your first book, and start recording.

<details>
<summary><strong>Language, currency & public deployment</strong></summary>

| Setting | Options |
|---|---|
| `APP_LANGUAGE` | `en` · `zh-CN` |
| `APP_CURRENCY` | `USD` · `EUR` · `GBP` · `CNY` |

The setup helper defaults to English and USD. Each deployment uses one language and one currency. The interface, AI-generated summaries, charts and exports follow the selected language. Amounts are stored as integer minor units. CNY deployments also support WeChat and Alipay CSV imports.

For public access, configure an HTTPS reverse proxy and set `APP_ORIGIN` to your public origin.

[Deployment, storage and backups →](docs/deployment.md)

</details>

<details>
<summary><strong>Connect your AI provider</strong></summary>

1. Open **Book settings** as an administrator.
2. Enter an OpenAI-compatible base URL ending in `/v1`, an API key, and your text/vision model IDs.
3. Choose a text model with tool calling and streaming, and a vision model with image input.
4. Run the text and image connection tests, then set background concurrency.
5. Open **Record → AI text / screenshots**, upload a receipt, review the draft and choose its funding account.

[Bookkeeping and AI guide →](docs/user-guide.md)

</details>

<details>
<summary><strong>Develop with TallyBear</strong></summary>

**Next.js App Router · React · TypeScript · PostgreSQL · LangGraph · Recharts · Sharp**

The Next.js app serves the UI and API. A separate worker processes durable jobs, sharing PostgreSQL and persistent image storage with the web app.

```sh
npm ci
npm run setup
docker compose -f compose.yaml -f compose.dev.yaml up -d db
node --env-file=.env scripts/init.mjs
npm run dev
```

Start the worker in another terminal:

```sh
node --env-file=.env --import tsx scripts/worker.ts
```

```sh
npm run typecheck
npm test
npm run build
```

[Contribution guide →](CONTRIBUTING.md)

</details>

---

<div align="center">

**Make room for the next little improvement.**

Ideas, translations, receipt formats and thoughtful pull requests are welcome.

[Share an idea](https://github.com/JYao-Chen/TallyBear/issues) · [Contribute](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

Enjoying TallyBear? A ⭐ helps others find their new bookkeeping companion.

[MIT](LICENSE) · [Credits & artwork](THIRD_PARTY_NOTICES.md)

</div>
