# Updating screenshots

The capture script writes desktop and mobile images to `docs/screenshots/v2/`. English files use the `en-` prefix; Chinese files use `zh-`. Each README and gallery references only its own language.

Requirements: Node.js 22, Docker, a Chromium browser, and free ports 3126/3127.

```sh
npm ci
npm run build
capture_tools=$(mktemp -d)
capture_runtime=$(mktemp -d)
npm install --prefix "$capture_tools" playwright
node "$capture_tools/node_modules/playwright/cli.js" install chromium
PLAYWRIGHT_MODULE="$capture_tools/node_modules/playwright/index.mjs" \
SCREENSHOT_RUNTIME="$capture_runtime" \
node scripts/readme-screenshots.mjs
```

Set `TEST_CHROMIUM_PATH` to use an existing Chromium executable and `SCREENSHOT_DIR` to change the output folder. Use a new empty runtime directory. The runner creates its own temporary database with sample records and closes its app processes and database container afterward. Build and tool directories remain for inspection.

Update both galleries when adding a feature. The generated manifest records image dimensions and filenames.
