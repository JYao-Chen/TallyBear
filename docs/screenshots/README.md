# TallyBear 2.0 screenshot gallery / 截图画廊

Captured on **2026-09-27** with Playwright from the actual Next.js production build. All 80 images show the running application, not generated mockups.

- Desktop: **1440 × 1000**; mobile: **390 × 844**, device scale factor 1.
- Chinese/CNY and English/USD run against separate disposable PostgreSQL databases.
- Households, transactions, memories and payment references are fictional. No production accounts or private receipts were used.
- Receipt drafts and the assistant conversation are seeded UI demonstrations, explicitly marked as such. **No live AI requests were made.**
- Some advanced English panels still contain Chinese labels. Screenshots preserve the current implementation.
- Captures use viewport screenshots, sometimes scrolled to the relevant section. WebP conversion changes encoding only; labels and layout are not retouched.
- The script checks for page errors, failed API responses and horizontal viewport overflow. This is not a full interaction or accessibility test.

本次重新采集了 20 个功能视图，每个视图均有电脑中文、电脑英文、手机中文、手机英文四种搭配。演示数据与线上隔离；预置草稿用于展示界面，不代表模型识别验收。部分较长页面只展示当前视口内的区域。

## Browse by feature / 按功能查看

| Feature / 功能 | 电脑中文 | Desktop EN | 手机中文 | Mobile EN |
|---|---|---|---|---|
| 首页 / Overview | [查看](v2/zh-desktop-overview.webp) | [View](v2/en-desktop-overview.webp) | [查看](v2/zh-mobile-overview.webp) | [View](v2/en-mobile-overview.webp) |
| 收支筛选与汇总 / Analysis | [查看](v2/zh-desktop-analysis.webp) | [View](v2/en-desktop-analysis.webp) | [查看](v2/zh-mobile-analysis.webp) | [View](v2/en-mobile-analysis.webp) |
| 图表 / Charts | [查看](v2/zh-desktop-charts.webp) | [View](v2/en-desktop-charts.webp) | [查看](v2/zh-mobile-charts.webp) | [View](v2/en-mobile-charts.webp) |
| 资金资产 / Assets | [查看](v2/zh-desktop-assets.webp) | [View](v2/en-desktop-assets.webp) | [查看](v2/zh-mobile-assets.webp) | [View](v2/en-mobile-assets.webp) |
| 活动账 / Activities | [查看](v2/zh-desktop-activities.webp) | [View](v2/en-desktop-activities.webp) | [查看](v2/zh-mobile-activities.webp) | [View](v2/en-mobile-activities.webp) |
| 预算 / Budgets | [查看](v2/zh-desktop-budgets.webp) | [View](v2/en-desktop-budgets.webp) | [查看](v2/zh-mobile-budgets.webp) | [View](v2/en-mobile-budgets.webp) |
| 账本管理 / Books | [查看](v2/zh-desktop-books.webp) | [View](v2/en-desktop-books.webp) | [查看](v2/zh-mobile-books.webp) | [View](v2/en-mobile-books.webp) |
| 家庭管理 / Family | [查看](v2/zh-desktop-family.webp) | [View](v2/en-desktop-family.webp) | [查看](v2/zh-mobile-family.webp) | [View](v2/en-mobile-family.webp) |
| 个人分类 / Categories | [查看](v2/zh-desktop-categories.webp) | [View](v2/en-desktop-categories.webp) | [查看](v2/zh-mobile-categories.webp) | [View](v2/en-mobile-categories.webp) |
| 使用说明 / Help | [查看](v2/zh-desktop-help.webp) | [View](v2/en-desktop-help.webp) | [查看](v2/zh-mobile-help.webp) | [View](v2/en-mobile-help.webp) |
| 周期计划 / Recurring plans | [查看](v2/zh-desktop-plans.webp) | [View](v2/en-desktop-plans.webp) | [查看](v2/zh-mobile-plans.webp) | [View](v2/en-mobile-plans.webp) |
| 个人资料 / Profile | [查看](v2/zh-desktop-profile.webp) | [View](v2/en-desktop-profile.webp) | [查看](v2/zh-mobile-profile.webp) | [View](v2/en-mobile-profile.webp) |
| 记忆中心 / Memory | [查看](v2/zh-desktop-memory.webp) | [View](v2/en-desktop-memory.webp) | [查看](v2/zh-mobile-memory.webp) | [View](v2/en-mobile-memory.webp) |
| 记忆变更 / Memory history | [查看](v2/zh-desktop-memory-history.webp) | [View](v2/en-desktop-memory-history.webp) | [查看](v2/zh-mobile-memory-history.webp) | [View](v2/en-mobile-memory-history.webp) |
| AI 录入 / AI intake | [查看](v2/zh-desktop-intake.webp) | [View](v2/en-desktop-intake.webp) | [查看](v2/zh-mobile-intake.webp) | [View](v2/en-mobile-intake.webp) |
| 草稿核对 / Draft review | [查看](v2/zh-desktop-draft.webp) | [View](v2/en-desktop-draft.webp) | [查看](v2/zh-mobile-draft.webp) | [View](v2/en-mobile-draft.webp) |
| 商品明细计算 / Item calculator | [查看](v2/zh-desktop-line-items.webp) | [View](v2/en-desktop-line-items.webp) | [查看](v2/zh-mobile-line-items.webp) | [View](v2/en-mobile-line-items.webp) |
| 家庭往来 / Family movements | [查看](v2/zh-desktop-family-entry.webp) | [View](v2/en-desktop-family-entry.webp) | [查看](v2/zh-mobile-family-entry.webp) | [View](v2/en-mobile-family-entry.webp) |
| 助手确认卡 / Assistant card | [查看](v2/zh-desktop-assistant.webp) | [View](v2/en-desktop-assistant.webp) | [查看](v2/zh-mobile-assistant.webp) | [View](v2/en-mobile-assistant.webp) |
| 跨账本搜索 / Search | [查看](v2/zh-desktop-search.webp) | [View](v2/en-desktop-search.webp) | [查看](v2/zh-mobile-search.webp) | [View](v2/en-mobile-search.webp) |

[Capture manifest / 截图清单](v2/manifest.json) records each image's language, dimensions and feature.

## Reproduce / 重新截图

Run from the repository root with Node.js 22 and Docker available. Ports 3126 and 3127 must be free. The runner needs a production build and Playwright; Playwright is a capture tool, not an application dependency.

```sh
npm ci
npm run build

# Install screenshot tools outside the repository.
capture_tools=$(mktemp -d)
capture_runtime=$(mktemp -d)
npm install --prefix "$capture_tools" playwright
node "$capture_tools/node_modules/playwright/cli.js" install chromium

PLAYWRIGHT_MODULE="$capture_tools/node_modules/playwright/index.mjs" \
SCREENSHOT_RUNTIME="$capture_runtime" \
node scripts/readme-screenshots.mjs
```

If Chromium is already installed elsewhere, set `TEST_CHROMIUM_PATH` to its executable. On a minimal Linux host, install Playwright's required browser system libraries first.

The runner creates a temporary PostgreSQL 16 container backed by tmpfs, applies both schema scripts, seeds demonstration data, starts two local app processes and writes images to `docs/screenshots/v2`. It does not load the production environment or start an AI worker. Its `finally` block stops its own app processes and removes its own temporary database container. The temporary build/tool directories remain available for inspection; they can be removed afterward.

Use a **new empty** `SCREENSHOT_RUNTIME` directory for each run. Set `SCREENSHOT_DIR` to capture elsewhere. Never point either variable at a production release or persistent data directory.

## Historical captures / 历史截图

Files directly in this directory were captured on 2026-09-14 for **1.0.0**, using a fictional English/USD household. They remain as historical assets; the 2.0 READMEs use only the new `v2/` captures.
