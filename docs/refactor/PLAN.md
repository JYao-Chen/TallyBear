# TallyBear v3 重构计划

2026-11-22 立项。基线：main `4487483`（与生产版本相同）。工作分支：`refactor/v3-clean`（`refactor/v3` 为早期分支，已废弃）。

## 已定决策

| 事项 | 决定 |
|---|---|
| 推进方式 | 渐进替换：按阶段整体替换模块，每阶段可测试、可单独上线，旧代码随之删除 |
| 技术栈 | 保留 Next.js 16 + PostgreSQL + LangGraph 单体，内部分层重整 |
| 视觉 | 先出方案对比（画布：https://claude.ai/artifact/6P7fRN1n9pZFftzdgHbgDu），选定后定设计系统 |
| 执行 | 代理机会话（Claude）负责架构、设计系统、外壳与首页、审核与合并；边界清楚的后端与迁移类任务派给 dev-linux 上的 Codex（gpt-6.2-astra，中等思考），每个任务一份任务单、一个 worktree，Claude 逐项审核补丁并复跑验证后才合入 |
| 数据 | 生产库不重建；表结构变化全部走迁移，迁移前备份，可回滚 |

## 不变的约束

- 账务口径不变：金额 bigint 分；钱包现金口径、信用账户欠款口径、分摊、分期、家庭往来、退款关联的现有规则以测试固定后再搬迁。
- 权限语义不变：账本角色 owner/editor/viewer，家庭成员不因参与活动获得私人账本权限。
- 生产只有 2 个用户、799 条交易，但都是真实数据；每次上线前备份，上线不做真实收费模型调用。
- 不在 current release 改代码；发布沿用 releases/current/rollback 方式。

## 目标架构

```
src/
  app/                      路由（每个页面一个 route segment；API 按业务域拆 route handler）
    (app)/layout.tsx        登录后外壳：导航、账本切换、助手入口
    (app)/page.tsx          首页
    (app)/entries/…         流水、详情 /entries/[id]
    (app)/analysis/…        分析
    (app)/wallets/…         钱包与计划
    (app)/family/…          家庭
    (app)/settings/…        设置（账本、分类、用户、模型、队列）
    (app)/help/…            帮助
    api/<domain>/…/route.ts 每个业务域自己的 handler
  server/
    http/                   handler 包装：鉴权、来源校验、zod 解析、错误码 → HTTP
    domain/<域>/            业务服务（纯函数 + 事务），不 import next/*
    db/                     连接、事务、查询工具
    jobs/                   队列、worker、事件推送
    ai/                     模型调用、助手工具目录、风险分级
  ui/                       设计系统：tokens.css、基础组件
  features/<域>/            页面级组件与数据 hooks
  lib/                      前后端共享的纯逻辑与类型
migrations/                 编号迁移 0001_baseline.sql …
```

## 执行分工（2026-11-22 定）

| 工作 | 执行者 | 任务单 / 状态 |
|---|---|---|
| 阶段 0：迁移系统、格式化、特征测试 | Claude | 已完成 |
| 阶段 0：冒烟脚本归类与 `test:smoke` | Codex `tb-smoke-tests` | 已合入 |
| 阶段 1：任务事件 LISTEN/NOTIFY、会话摘要、IP 限流、密码长度、币种缓存（迁移 0002） | Codex `tb-stage1-backend` | 已合入；IP 改为信任 `X-Real-IP`（审核修正） |
| 阶段 1：校准生效日、家庭缴款统一、家庭总览、金额区间（迁移 0003） | Codex `tb-stats-family` | 已合入 |
| 阶段 1：助手风险分级、操作记录与撤销（迁移 0006） | Codex `tb-assistant-risk` | 已合入 |
| 阶段 1：错误码 | 并入阶段 2 的 http 包装（响应增加 `code`，文案不动） | 已合入 |
| 阶段 2：`server/http` 包装与路由表、拆除 `application-api.ts` | Codex `tb-api-split` | 已合入 |
| 阶段 2：统计领域统一（投影、赠与规则、钱包域、整数分） | Codex `tb-stats-domain` | 已合入 |
| 缺陷：偏好依据缺 accountId、逐笔余额按生效日、家庭钱包认领 | Codex `tb-fixes-a` | 已合入 |
| 阶段 3：tokens 与基础组件（`src/ui/`） | Claude | 已完成 |
| 阶段 4：网址路由、5 项导航外壳、首页 | Claude | 已完成 |
| 阶段 4：其余页面换用 `src/ui` 组件与 CSS Modules | 按页面派 Codex，Claude 定样式与验收 | 已合入（含 polish-a/b/c 三轮审核返工） |
| 阶段 5：删除旧样式层、文档、发布 | Claude | 已完成：未引用的旧全局样式已删，发布为 v2.0.0（原计划称 v3.0，按用户要求定为 2.0）；剩余全局样式见下 |

### 实施中的设计调整
- **API 拆分方式**：助手执行写操作时在进程内调用 API 分发（`assistant-operations.ts` 的 `runOperation`），所以不采用“每域一个 `app/api/<domain>/route.ts`”，改为 `src/server/http/routes/<domain>.ts` 路由表 + 统一 `dispatch`，`app/api/[...path]/route.ts` 与助手共用。
- **错误码**：响应体统一为 `{ error, code }`；中文文案保留在服务端（前端与助手都直接显示 `error`），不做文案表外置。
- **页面路由**：`src/app/(app)/layout.tsx` 常驻 `Workspace`，`[[...slug]]` 只校验网址；页面由网址决定（`src/lib/routes.ts`）。之后按页面把内容迁到各自的 route 文件，`Workspace` 逐步缩小。
- **字体**：生产在国内且不引入外部字体服务，标题用系统宋体栈（Noto Serif SC / 思源宋体 / 宋体），正文用系统黑体栈，数字 Geist。

## 阶段

每阶段结束：`typecheck` + 全量单测 + 数据库集成测试（dev-linux 临时 PostgreSQL）通过，写入 `docs/refactor/LOG.md`，由用户决定是否上线。

统计口径的修复与统一按 `STATS-BASIS.md` 第 5 节分摊到各阶段。

### 阶段 0：工程地基（不改行为）
1. 迁移系统：从生产 `pg_dump --schema-only` 与 `scripts/*.sql` 对照，生成 `migrations/0001_baseline.sql`；新增 `schema_migrations` 表和 `scripts/migrate.mjs`；`init.mjs` 改为调用迁移。生产已有库只登记 baseline，不执行建表。
2. 格式化与 lint：加 Prettier + ESLint（typescript-eslint），单独一次只改格式的提交；`no-explicit-any` 先告警。
3. 测试入口：`npm run test:db` 用临时 PostgreSQL 跑全部 `*-db.test.ts`；`scripts/` 下冒烟脚本归类到 `tests/smoke`、`tests/browser`，统一入口。
4. 关键口径的特征测试：现金/信用余额、分摊、分期、退款、家庭往来、统计去重。后续重构以它们为安全网。

### 阶段 1：后端稳定性与安全
1. 任务事件：完成后压缩进结果并清理 `ai_job_events`（生产 85MB/30 万行）；进度推送改 `LISTEN/NOTIFY`，去掉 50ms 轮询。
2. 会话：令牌存 SHA-256；定期删除过期会话；登录限流加 IP 维度；密码最短 8 位（旧密码不强制改）。
3. `checkDeploymentCurrency` 启动时校验一次并缓存。
4. 助手写操作风险分级：记账/编辑类可自动执行；删除、权限、家庭成员、钱包余额更正等必须用户确认；所有助手执行留操作记录并支持撤销。
5. 报错改错误码 + 文案表，去掉服务端中文硬编码。

### 阶段 2：后端分层与 API 拆分
1. `server/http` 包装器统一鉴权、来源校验、请求体大小（按实际读取字节计）、zod、错误码。
2. 按业务域把 `application-api.ts` 的约 87 个分支迁到 `app/api/<domain>/…/route.ts`，每迁一个域删一段旧分支；接口路径保持不变，前端无感。
3. 领域服务去 `any`，输入输出类型由 zod schema 推导，前后端共享。

### 阶段 3：设计系统（依赖视觉方案选定）
1. `ui/tokens.css`：颜色、字号、间距、圆角、阴影、动效；bear 与 minimal 两个主题都由 tokens 表达。
2. 基础组件：Button、IconButton、Field、Select、Sheet/Dialog、Tabs、Chip、Card、ListRow、Money、DateField、EmptyState、Toast。
3. 删除 `globals.css`、`*-refinement.css`、`workspace-polish.css` 等叠加层，组件样式用 CSS Modules。

### 阶段 4：前端路由与页面重建
1. 信息架构：14 个侧栏入口收拢为 5 个一级（首页、流水、分析、钱包与计划、家庭），设置与帮助进头像菜单，账本切换放在导航顶部，助手常驻。
2. 用 App Router 拆页面，URL 可分享、可后退、刷新不丢位置；详情用路由式抽屉。
3. 数据层：统一的请求与缓存（TanStack Query 或自写轻量 hook，阶段 3 前定），变更后按资源失效。
4. 按页懒加载：帮助手册、图表、画像、助手不进首屏。
5. 页面顺序：首页 → 记账（手动/识图/导入/家庭往来）→ 流水与详情 → 分析 → 钱包与计划 → 家庭 → 画像 → 设置 → 帮助。每页完成即删除 `Workspace.tsx` 对应部分。

### 阶段 5：收尾
删除旧外壳与样式、更新 README/帮助截图、性能与可访问性检查、正式发布（定为 v2.0.0）。

2.0.0 之后仍留的工作：`globals.css` 等全局样式里仍被引用的旧类（共约 6 万字节）逐页迁入模块；`Workspace.tsx` 按页面拆进各自的 route 文件。

## 上线节奏

阶段 0、1 各自可单独上线（阶段 1 含迁移，先在生产备份的恢复副本上演练）。阶段 2 每迁完一组业务域可上线。阶段 3、4 视觉变化大，按页面分批上线或整体切换，到时再定。
