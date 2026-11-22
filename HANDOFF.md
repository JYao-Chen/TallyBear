# HANDOFF：TallyBear 2.0

更新：2026-11-23

## 当前状态
- **2.0.0 已发布并上线**：标签 `v2.0.0`（`0f85e7d`），main 已快进到该提交；`refactor/v3-clean` 与 main 同步。`refactor/v3` 已废弃（远端分支待删除）。
- 生产按 release 目录切换，rollback 指向上一版 `4487483`。迁移 0001–0006 已在生产执行（0001 登记为 legacy）。
- 版本说明：`CHANGELOG.md`、`docs/releases/v2.0.0.md`、`docs/deployment.md`“Upgrading to 2.0.0”。重构过程：`docs/refactor/PLAN.md`、`docs/refactor/LOG.md`。
- 视觉规范：`docs/refactor/DESIGN-SYSTEM.md`；统计口径：`docs/refactor/STATS-BASIS.md`。

## 发布前已核对
- 全量检查：tsc / eslint / prettier / `npm test`（404 通过）/ `test:db`（19 通过）/ `test:smoke`（34 通过，0 失败）/ build。
- 真实界面截图 212 张 + 帮助图 16 张，中英文、桌面/手机；英文界面未翻译清单为空。
- 统计数字逐项对账：家庭钱包、资产、钱包余额、分析与首页一致、预算（未设预算分类另行提示）、分期。

## 剩余工作（非阻塞）
- 全局 CSS 仍约 60KB 在用，后续逐页迁入 CSS Modules。
- `src/components/Workspace.tsx` 仍过大，可按记一笔 / 导入 / 草稿拆分。

## 验证命令（dev-linux）
- `npx tsc --noEmit`、`npm test`、`npx eslint . --quiet`、`npx prettier --check .`、`npm run build`
- 数据库：起 `pgvector/pgvector:0.8.2-pg16` 临时容器，`TZ=Asia/Shanghai TEST_DATABASE_URL=postgres://…@127.0.0.1:<port>/tallybear_test npm run test:db`，`npm run test:smoke` 同理。
- 截图：`node scripts/readme-screenshots.mjs`（`HELP_FIGURES_ONLY=1` 只出帮助图），产物进 `docs/screenshots/v2`。

## 部署注意
- 迁移 0002 把会话改为摘要存储：回滚到 2.0 之前的版本会让所有人重新登录。
- 发布包需含 `scripts/{init,migrate}.mjs`、`scripts/legacy-schema`、`migrations`；在 release 目录内用生产环境变量运行 `scripts/migrate.mjs`。
- 生产机磁盘与内存紧张：不在生产构建，部署前看余量，保留两个 release。

## 位置
- 代理机编辑：`/root/projects/apps/TallyBear`
- dev-linux 旧检出 `/home/yao/projects/apps/tallybear` 有用户未提交的文档改动，不要动。
- 仓库公开：生产主机、路径、账号等不写进仓库，见维护者工作站的项目清单。
