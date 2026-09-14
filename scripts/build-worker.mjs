import {build} from 'esbuild';
await build({entryPoints:['scripts/worker.ts'],bundle:true,platform:'node',format:'esm',external:['pg','sharp'],outfile:'.next/standalone/worker.mjs',banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});
