# Deploy TallyBear

## Docker Compose

Use Node.js 22 for `npm run setup`, which creates `.env` with random credentials. No package installation is needed to run that helper. Edit `APP_ORIGIN`, `APP_LANGUAGE` and `APP_CURRENCY` before initializing a database. Compose requires v2 with dependency conditions.

Run `docker compose up -d --build`. The `init` service builds the image, waits for PostgreSQL and initializes schema/defaults. Web and worker start after successful initialization. Initial administrator settings apply only when there are no users.

- Web: localhost port 3016 (set `APP_PORT` to change the host port).
- Database: internal Compose network; not exposed publicly.
- Named `database` volume: PostgreSQL storage.
- Named `receipts` volume: persistent files shared by web/worker.

Check `docker compose ps` and `docker compose logs --tail=80 web worker init` when startup fails. Keep secrets out of public issue reports.

## Public access

Point an HTTPS reverse proxy at `127.0.0.1:3016`. Set `APP_ORIGIN=https://your-domain.example` and restart web/worker. Forward streaming responses without proxy buffering for AI progress. Do not publish database ports. Configure proxy upload/time limits to suit long-image and batch uploads.

## Languages and currency

Setup/Compose defaults: `en`, `USD`. Supported languages: `en`, `zh-CN`; currencies: `USD`, `EUR`, `GBP`, `CNY`. Application fallback when environment values are entirely absent remains `zh-CN`/`CNY` for older deployments. Restart both processes when changing environment settings.

Currency is recorded in the database; a mismatch is rejected. Use a fresh database to deploy with another currency. Existing amounts are never converted by changing an environment variable.

## AI configuration

Sign in as administrator and configure two independent OpenAI-compatible scopes in **Book settings**:

- **Receipt recognition models** handle quick text/image intake, OCR extraction, cross-image order merge, amount verification and recognition connection tests.
- **AI assistant models** handle assistant chat, tool decisions, images uploaded inside chat, receipt reading initiated by the assistant, delegated/nested assistant calls and assistant connection tests.

Each scope has its own base URL, API key, text model and vision model. The assistant text model must support tool calling and streaming; vision models must support image input. Keys are encrypted with `ENCRYPTION_KEY`. Connection tests call the selected provider and can incur its normal charges. Queue concurrency is shared between scopes. The worker must run for recognition, chat and background connection tests.

## Upgrades

Back up first. Stop web and worker, obtain the desired release and run `docker compose up -d --build`. Initialization reruns the bundled idempotent schema updates before services start. Never restore an older database over newer changes without also restoring its matching files/configuration.

## Upgrading current `main` after 1.5.0

Current `main` adds separate assistant-model settings and personal category-learning feedback. Apply the bundled `scripts/schema.sql` (or let the Compose `init` service apply it) before starting the new web and worker together. The migration creates `assistant_ai_settings` and `category_feedback` without rewriting existing transactions. Historical entries created by a user remain usable as lower-weight personal evidence; new confirmations and corrections populate feedback after the upgrade.

After startup:

1. Configure and test both **Receipt recognition models** and **AI assistant models**. The existing recognition configuration is not silently copied into the assistant scope.
2. Confirm **Spending analysis → My personal wallets** updates the charts and searchable, paginated records from the same filters and returns only the signed-in user's owned wallets.
3. In **Assets**, switch between personal and family ownership scopes and confirm the charts and wallet table use only that scope.
4. Create a receipt draft with **Use my category habits** enabled, verify any suggestion explanation, change its category, save it, and confirm the next matching draft can learn from the correction.
5. Check a long records list shows page controls and verify sign-out from mobile navigation.

Rollback requires the matching application release. The added tables are harmless to 1.5.0, but do not rely on a partial code-only rollback after making unrelated newer schema changes.

## Upgrading to 1.5.0

1. Back up the database, receipt files and `.env` using the steps below.
2. Stop web and worker before changing the schema.
3. Fetch and select the release, then rebuild and start:

```sh
docker compose stop web worker
git fetch origin --tags
git checkout v1.5.0
docker compose up -d --build
docker compose ps
curl --fail http://localhost:3016/api/health
```

Compose uses the `tallybear:1.5.0` image and runs `scripts/init.mjs` before web/worker startup. Keep the existing database and receipts volumes, encryption key, language and currency. Initialization applies the bundled ownership, installment, family-movement and per-user book-display tables; existing users remain intact.

For standalone installations, stop both processes, install dependencies with `npm ci`, run `node --env-file=.env scripts/init.mjs`, build with `npm run build`, and deploy the resulting web/worker artifacts together. Preserve persistent receipt storage. A standalone build emits `server.js` and `worker.mjs` inside `.next/standalone`; copy `public` and `.next/static` into that same release directory.

Family movements remain separate from ordinary transactions. Each participant can assign an existing movement to their own private book using **Display book**. The book shows it under fund movements, outside income/expense totals. Sender and recipient preferences are independent; no historical display book is guessed during the upgrade.

For rollback across the asset-ownership change, restore the matching pre-upgrade database, attachments, configuration and application release together.

## Backups

Back up the PostgreSQL database, the receipts volume and `.env` together. The encryption key in `.env` is required to read saved AI credentials. Keep backups private. A simple full backup while services are stopped:

```sh
mkdir -p backups
docker compose stop web worker
docker compose exec -T db pg_dump -U tallybear -Fc tallybear > backups/database.dump
docker compose run --rm --no-deps --user root --entrypoint tar web -C /app/data -czf - receipts > backups/receipts.tar.gz
cp .env backups/config.env
chmod 600 backups/*
docker compose start web worker
```

Test restoration in a separate Compose project before relying on backups. Do not run `docker compose down -v` on a deployment you want to keep: that removes its data volumes.

## Without Docker

Use PostgreSQL, Node.js 22, `npm ci`, `.env` and `node --env-file=.env scripts/init.mjs`. For production run `npm run build`, copy `public` and `.next/static` into `.next/standalone`, then start `server.js` and `worker.mjs` with the same environment. Set an absolute persistent `RECEIPT_DIR` shared by both processes. Supervise both processes; the web server alone does not process queued AI work.

## Existing installations renamed to TallyBear

Renaming a source directory or service does not migrate money or user accounts. Preserve the existing database, persistent image directory, encryption key and language/currency values. Stop web and worker before moving their working directory; update service working directories, environment-file paths, absolute image-storage paths, backup jobs and any deployment scripts together. Then start the renamed services and verify `/api/health` and a saved attachment.

Existing database roles/names and browser storage keys may retain legacy internal names. Do not recreate a database or change an encryption key merely to rename them. New Compose deployments use `tallybear` names. The `scripts/backup.sh` and `restore-drill.sh` helpers target standalone installations with local receipt storage; their database container/user/name can be set with `DB_CONTAINER`, `DB_USER`, `DB_NAME`. Compose users should use the volume-aware backup steps above.

## Person and family asset ownership

The ownership migration in `scripts/schema.sql` removes account/book coupling. Back up the database before upgrading. Personal balances are private; family members manage family assets. Existing explicitly linked wallets consolidate into one asset. Unlinked accounts with matching names remain separate. Books classify transactions; moving or reusing an entry preserves its payment account. Old releases require their matching pre-migration database.

Use `scripts/asset-ownership-smoke.ts` against an isolated database initialized with the current schema to check ownership, permissions, reuse, moves, reports and balance reconciliation.
