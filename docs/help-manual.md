# In-app illustrated manual

Open **Help** from the sidebar or the mobile **More** menu. The manual contains 18 chapters in four ordered groups: introduction and setup, recording, review and management, and assistant and settings. The first chapter introduces TallyBear 2.0 and explains books, wallets, activities and categories.

Each chapter has its own contents, titled sections, numbered procedures, examples, notes and FAQs. Feature shortcuts open the relevant page or entry mode without posting a transaction or replacing a draft. The remembered chapter is restored when returning. “Ask the assistant” prefills a chapter-specific question for the user to complete and send; it does not call the model automatically. A book must be selected to use the assistant.

Chinese deployments show Chinese copy and screenshots; English deployments show English. Figures sit next to the matching instructions with descriptive captions. Each figure can switch between desktop and mobile, defaults to mobile on narrow screens, and links to the selected full-size image. The directory groups chapters on desktop and becomes a grouped chapter selector on mobile.

Search accepts keywords or questions. Results show matching passages; selecting a chapter keeps the query and highlights matching words in the text. Chinese questions are segmented for keyword retrieval. Results are paginated six chapters at a time. Semantic-only results are labeled as related by meaning rather than displaying fabricated keyword highlights.

## Storage and retrieval

- `src/lib/help-guide.ts` defines the bilingual structured content, figure references and typed feature targets. `src/lib/help-manual.ts` localizes it and produces the searchable text. These files are the editable master copy; the old flat help paragraphs are no longer appended to articles.
- The authenticated `GET /api/help` synchronizes both languages into `help_articles` and queues missing embeddings. `GET /api/help?q=...` returns ranked chapter content and snippets for the deployment language.
- `help_vectors` stores chapter vectors, content versions, dimensions and embedding-model versions. At this catalogue size, cosine similarity is calculated over the stored arrays; no additional vector extension is required for help search.
- Keyword and semantic rankings are fused. Only vectors for the current model and content version participate. A query embedding has a five-second timeout; failures fall back to keyword results. The page also retains local keyword search if the API is unavailable.
- The existing memory embedding configuration supplies the model and encrypted key. Help indexing runs as a `memory` background job with operation `help-index`, independently of personal memory learning. Completed chapter vectors are reused on retry. It indexes documentation only, never private financial records.
- Editing chapter content invalidates its previous vector on the next synchronization. Changing the configured embedding model queues a new version on the next visit/search.

## Assistant

The `search_help` tool retrieves the same chapters and adds chapter shortcuts to the conversation. The assistant policy calls it for feature locations, instructions and accounting definitions. Financial amounts still come from the financial tools. Selecting a shortcut opens the relevant chapter in Help.

## Screenshots and release

`scripts/prepare-help-assets.mjs` copies existing documentation screenshots into generated `public/help/v2/` during `npm run dev` and `npm run build`. The original images remain in `docs/screenshots/v2/`; generated copies are ignored by Git. Docker includes them through its existing public-assets copy.

Run the normal `scripts/init.mjs` during release to create the two additional tables, then restart Web and worker together. Open Help to synchronize content and start indexing. Until the embedding model is configured and indexing completes, keyword search remains usable.

## Tests

`tests/help.test.ts` covers bilingual chapters, screenshot references, highlighting and matching. `tests/help-integration.test.ts` runs with `HELP_TEST_DATABASE_URL` pointed at a disposable, initialized database; its model responses are deterministic fixtures. It checks indexing, reuse, semantic retrieval, model failure, stale versions and assistant chapter links.

Use `HELP_FIGURES_ONLY=1` with the screenshot runner to capture manual entry, refunds, import and reconciliation input in both languages and device sizes. `HELP_AUDIT_ONLY=1` checks the guide, highlighted results, steps, image switching, feature navigation, memory shortcut and assistant prefill. Set `SCREENSHOT_DIR` to an artifact directory for these additional views.
