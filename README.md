<div align="center">

<img src="public/brand/tallybear-logo.png" width="140" alt="TallyBear" />

# TallyBear

**Your receipts, understood. Your finances, in view.**

An AI-powered home for personal and family finances.
Self-hosted · Itemized receipts · Financial conversations · Bear companions

English · [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/badge/v1.0.0-78618f?style=flat-square)](https://github.com/JYao-Chen/TallyBear/releases/tag/v1.0.0)
[![MIT](https://img.shields.io/badge/code-MIT-43755e?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/deploy-Docker-d2a363?style=flat-square)](docs/deployment.md)

[Get started](#get-started) · [Explore the features](#from-receipt-to-insight) · [Deployment guide](docs/deployment.md) · [Latest release](https://github.com/JYao-Chen/TallyBear/releases)

</div>

![Spending analysis](docs/screenshots/desktop-analysis.png)

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

### Keep every useful detail

Upload multiple images or a long screenshot. TallyBear groups related orders, extracts line items, summarizes product names and compares the checkout total with the amount paid. Review editable drafts and duplicate suggestions before saving.

- **Itemized purchases** — quantities, unit prices, checkout discounts and extra fees.
- **Refunds** — full or partial refunds linked to the original purchase.
- **Search & memories** — search merchants, categories and individual items; attach compressed vouchers or everyday photos.

### A conversation that works with your books

> “Compare this month with last month, show where spending changed, and save a report.”

A LangGraph-powered assistant queries your accessible books, coordinates recognition and reconciliation tools, generates charts and saves reports. Background jobs keep running between visits, with live progress, retries and administrator-controlled concurrency.

Choose your own OpenAI-compatible provider and text/vision models, then test the connection in settings.

### Your money, your household, your view

| What you want to manage | How TallyBear helps |
|---|---|
| Personal and shared finances | Independent users, families, private books and shared books. |
| Who paid | Multiple personal and shared wallets; track the funding account for each expense. |
| Different reporting views | Link one transaction to several books and count that event once in cross-book totals. |
| Subscriptions and plans | Flexible daily, weekly, monthly and yearly periods; exact cost allocation and category budgets. |
| Your preferred workspace | English or Chinese deployment, familiar currency formatting and responsive desktop/mobile layouts. |

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

## Get started

You’ll need **Docker Compose v2** and **Node.js 22** for the setup helper.

```sh
git clone https://github.com/JYao-Chen/TallyBear.git
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

Open **http://localhost:3016**. Sign in with `ADMIN_USERNAME` and the generated `ADMIN_PASSWORD` from `.env`, create your first book, and start recording.

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
