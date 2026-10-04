本目录是 tallybear 开发源码。生产在 /home/yao/production/tallybear，先读其 README.md。旧 /home/yao/projects/tallybear 指向生产，不能当开发工作区。开发不得加载生产 .env 或复用生产数据库/收据目录。发布从明确版本生成新的 releases 快照，再切换 current；不在 current 中改代码。提交需用户明确授权。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
