# Deployment localization

Set `APP_LANGUAGE=zh-CN|en` and `APP_CURRENCY=CNY|USD|EUR|GBP` in the server environment. Defaults are zh-CN/CNY. Restart web and worker together. No user-level language control, browser language detection or currency conversion is performed.

`src/lib/deployment.ts` validates configuration and formats integer minor-unit money. The server writes language and currency to HTML attributes for client components. `LanguageProvider` supplies read-only locale/currency. The message catalog remains in `src/lib/locales/en.json`; unknown user content is preserved.

API responses and AI jobs use deployment language, ignoring client language fields and cookies. OCR and finance prompts generate English explanations and summaries in English deployments. Original merchant names and existing categories remain unchanged. New books receive defaults in deployment language.

`deployment_settings` records the database currency. Run `npm run db:init` before first startup. Existing databases with books are CNY; fresh databases use APP_CURRENCY. Layout, API and workers reject a mismatch instead of relabeling historical money. Receipt recognition rejects explicit foreign-currency receipts. WeChat/Alipay CSV imports require CNY. All supported currencies use 100 minor units per unit; allocations retain exact integer arithmetic.
