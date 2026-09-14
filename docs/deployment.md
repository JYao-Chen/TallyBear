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

Sign in as administrator and set an OpenAI-compatible base URL, text model, vision model and API key. Connection testing uses the configured provider and can incur its normal charges. Set queue concurrency in the admin interface. The worker must run for recognition, chat and background connection tests.

## Upgrades

Back up first. Stop web and worker, obtain the desired release and run `docker compose up -d --build`. Initialization reruns the bundled idempotent schema updates before services start. Never restore an older database over newer changes without also restoring its matching files/configuration.

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
