# HANDOFF：TallyBear v3 重构

更新：2026-11-22

## 当前状态
- 分支 `refactor/v3-clean`，基于 main `4487483`（= 生产）。`refactor/v3` 已废弃。
- 计划与分工：`docs/refactor/PLAN.md`（“执行分工”一节列出 Claude / Codex 各自的任务与状态）。
- 视觉规范：`docs/refactor/DESIGN-SYSTEM.md`（A+C 整合，已定稿）。统计口径：`docs/refactor/STATS-BASIS.md`；家庭钱包按“缴款 + 共同费用”（第 6 节）。
- 已完成：
  - 阶段 0：迁移系统（`migrations/` + `scripts/migrate.mjs`）、格式化、统计特征测试（`tests/stats-characterization-db.test.ts`）、冒烟归类（`tests/smoke/`、`npm run test:smoke`；浏览器脚本在 `tests/browser/`，不在默认验证中）。
  - 阶段 1 大部分：迁移 0002（任务事件 NOTIFY、会话摘要存储、登录限流）、0003（校准生效日、家庭缴款视图、家庭总览接口）。
  - 阶段 3：`src/ui/`（tokens + 基础组件）。
  - 阶段 4 第一步：网址路由（`src/lib/routes.ts`、`src/app/(app)/`）、新外壳（`src/features/shell/`）、首页（`src/features/home/`）。
- 第二轮 Codex 任务（任务单在维护者工作站 scratch，摘要见 PLAN.md）：API 拆分 + 错误码、统计领域统一、三处缺陷、助手风险分级（迁移 0004）。

## 验证命令（dev-linux）
- `npx tsc --noEmit`、`npm test`、`npx eslint . --quiet`、`npx prettier --check .`、`npm run build`
- 数据库：起 `pgvector/pgvector:0.8.2-pg16` 临时容器，`TZ=Asia/Shanghai TEST_DATABASE_URL=postgres://…@127.0.0.1:<port>/tallybear_test npm run test:db`，`npm run test:smoke` 同理。

## 部署注意
- 迁移 0002 会把现有会话改成摘要存储：新代码与迁移必须一起上线，否则所有人掉登录。
- 登录限流按 `X-Real-IP` 识别客户端，生产网关已设置该头。
- 生产机磁盘与内存紧张，部署前看余量；先在备份恢复副本上演练迁移。

## 位置
- 代理机编辑：`/root/projects/apps/TallyBear`
- dev-linux 旧检出 `/home/yao/projects/apps/tallybear` 有用户未提交的文档改动，不要动。
- 仓库公开：生产主机、路径、账号等不写进仓库，见维护者工作站的项目清单。
