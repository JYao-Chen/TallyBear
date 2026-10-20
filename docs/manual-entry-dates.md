# Manual entry default dates

New blank manual entries use today's recording date in Asia/Shanghai. A saved cloud form containing only defaults (date, category, wallet, etc.) is not an unfinished financial entry, so its old date must not override today's default.

A draft containing an amount or entered content retains its valid date. Existing-record editing retains the original transaction date. Users may still explicitly choose a historical date; that chosen date is submitted unchanged. After a successful new-entry save, the next blank form and its saved draft reset to today's date.

Previously QuickEntry always preferred `savedDraft.date`, including blank forms, and did not reset the date after saving. Those two paths could repeatedly apply an old date to new records even while showing Save succeeded. The fix is in `src/lib/manual-entry-date.ts` and QuickEntry's post-save reset.

`tests/manual-entry-date.test.ts` verifies blank versus substantive drafts. `scripts/manual-entry-date-browser.mjs` verifies actual date controls and save/reset behavior at desktop/mobile widths, including intentional historical entry, cloud-draft reset, pending drafts and existing-record editing. This change does not rewrite historical transaction dates automatically.
