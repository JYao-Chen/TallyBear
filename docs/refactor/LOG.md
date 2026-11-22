# 重构日志

## 2026-11-22 阶段 0 第 1 项：迁移系统

- `migrations/0001_baseline.sql`：生产库 `pg_dump --schema-only` 导出（main `4487483`），75 张表。与旧 `init.mjs` 在空库建出的结构对比，只差 pgvector 扩展（生产手装，改为可选）和 `category_preferences` 两个约束名（旧表改名遗留，baseline 用生产名）。
- `scripts/migrate.mjs`：`schema_migrations` 记录版本与校验和，advisory lock 防并发；新库执行 baseline，已有库先补跑 `scripts/legacy-schema/` 5 个旧幂等脚本再登记（mode=legacy）；已执行的迁移文件被改动会报错。`init.mjs`、冒烟脚本、数据库测试都改为调用它。
- 删除 23 个历史增量 SQL（内容已并入旧 `schema.sql`，对比证实）。
- 修复：`Dockerfile` 原先只复制 3 个 SQL，而 `init.mjs` 要读 5 个，Compose 初始化会失败；改为复制 `migrations/` 与 `legacy-schema/`。
- `npm run test:db`：重建 127.0.0.1 上的 `*_test` 库，串行跑自带夹具的数据库测试；`tests/migrations-db.test.ts` 校验新库与旧库路径结构一致、重复执行无变化、改动检测。需要演示数据的 CHAT_/FUNDS_ 测试和帮助索引测试仍需单独准备，默认跳过。
- `scripts/stats-snapshot.ts` + `stats-diff.mjs`：各统计口径（STATS-BASIS §1 的 A–F）按用户、按月只存汇总的快照，供重构前后对比。

验证（dev-linux，工作区快照，未提交）：
- `tsc --noEmit` 通过；`npm test` 396 项，386 通过，10 跳过，0 失败。
- `npm run test:db`（pgvector/pgvector:0.8.2-pg16 临时容器）：9 项，7 通过，2 跳过（演示数据测试）。
- 生产 2026-11-22 03:30 备份恢复副本：`migrate.mjs` 走旧库路径，登记 `0001|legacy`，再次执行无变化；迁移前后口径快照 `stats-diff` 无差异。基线快照存于开发机 artifacts 目录（真实数据，权限 600，不入库）。
