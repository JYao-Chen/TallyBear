# Deployment localization

Set `APP_LANGUAGE=zh-CN|en` and `APP_CURRENCY=CNY|USD|EUR|GBP` in the server environment. Defaults are zh-CN/CNY. Restart web and worker together. No user-level language control, browser language detection or currency conversion is performed.

`src/lib/deployment.ts` validates configuration and formats integer minor-unit money. The server writes language and currency to HTML attributes for client components. `LanguageProvider` supplies read-only locale/currency. The message catalog remains in `src/lib/locales/en.json`; unknown user content is preserved.

API responses and AI jobs use deployment language, ignoring client language fields and cookies. OCR and finance prompts generate English explanations and summaries in English deployments. Original merchant names and existing categories remain unchanged. New users see personal category defaults in the deployment language across all books.

Receipt recognition and AI assistant model settings are separate, but both follow the same deployment language and currency. Assistant-attached images and nested assistant calls use the assistant scope. Personal category matching runs locally on the server and preserves stored category names; only its explanatory UI labels are translated.

`deployment_settings` records the database currency. Run `npm run db:init` before first startup. Existing databases with books are CNY; fresh databases use APP_CURRENCY. Layout, API and workers reject a mismatch instead of relabeling historical money. Receipt recognition rejects explicit foreign-currency receipts. WeChat/Alipay CSV imports require CNY. All supported currencies use 100 minor units per unit; allocations retain exact integer arithmetic.

Personal-wallet analysis uses the same deployment currency and formatting as book reports. It changes ownership scope, not currency conversion: only the signed-in user's personal wallets are aggregated across books, and linked events are deduplicated before totals are formatted.
