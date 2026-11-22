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

## 2026-11-22 第一轮 Codex 任务合入

- `tb-stage1-backend`（迁移 0002）：任务结束时触发器删事件并 `pg_notify`，SSE 等待通知（2 秒兜底）；会话只存 sha256 摘要，旧会话迁移时就地转换；登录限流按 IP（30 次）与用户名（15 次）分开计数；新密码至少 8 位；部署币种检查缓存成功结果。审核修正：客户端 IP 取 `X-Real-IP`，退回时取 `X-Forwarded-For` 的最后一段（第一段可伪造）。
- `tb-stats-family`（迁移 0003）：`account_adjustments.effective_date`（按上海日期回填）；`family_contributions` 视图统一两种缴款记法；`GET /api/family-finance/overview` 给出缴款、共同费用、期初期末与结余；个人报表增加 `familyContribution`；资金流把缴款单列；金额区间筛选按命中金额。
- `tb-smoke-tests`：63 个冒烟移入 `tests/smoke/`，`npm run test:smoke` 每项独立重建测试库；36 个浏览器脚本移入 `tests/browser/`。审核修正：`readme-screenshots.mjs` 跟随新路径与 `SMOKE_DATABASE_URL`。

## 2026-11-23 阶段 2 API 拆分

- Web API 与助手操作共用 `src/server/http/router.ts` 的 `dispatch(req, path, actor?)`。业务路由在 `src/server/http/routes/` 声明方法、路径和访问级别，按注册顺序匹配。账本成员、写入和所有者权限继续按资源检查。
- `handler.ts` 统一检查部署币种、Origin、身份和请求体。普通 JSON 按实际读取的字节数限 35,000,000 字节。助手、对话和草稿的图片 JSON 允许更大请求，收据上传保留原始流。
- `errors.ts` 保留原有错误文案和 HTTP 状态，并返回 `code`。401、403、404、409、400、413、429、500 分别对应 `unauthorized`、`forbidden`、`not_found`、`conflict`、`validation`、`too_large`、`rate_limited`、`internal`。现有 410 附件过期响应使用 `not_found`，上游 502、503 使用 `internal`。

## 2026-11-22 第二轮合入与助手分级

- 第二轮三项 Codex 任务（`api-split`、`stats-domain`、`fixes-a`）分三个提交合入（555052e、cd0b674、76b36ed）。合并冲突在 `scripts/test-db.mjs`（测试键合并）与 `tests/stats-family-db.test.ts`（改用 `dispatch`）。
- `stats-domain` 的统计金额改为整数分。其余接口里的 `amount::float8` 是 bigint 分转 float8，2^53 以内无精度损失，保留不改。
- 迁移 0004：空库路径补 `ai_queue_settings(1,2)` 默认行（旧 `schema.sql` 有插入，schema-only baseline 带不过来；后台任务设置页在空库上 500）。
- `tb-assistant-risk`（迁移 0006）：146 个助手操作分 read 51 / write 37 / confirm 58；confirm 级由服务端拦截，模型调用 `execute_action` 只会留下待确认卡片。`assistant_action_log` 记录成功与失败（参数过滤密钥类字段），新记账、修改、删除可撤销，账目已变动时 409。顺带修正第二轮遗留：助手取消/重试任务返回 404。
- 测试与浏览器脚本插入会话改存 sha256 摘要；截图脚本按新界面（个人资料页签、个人画像栏目、草稿先选中）更新，中英文 × 电脑/手机 84 张全部跑通。
- 首页记录区去掉周期与排序（留在流水页），顶栏栏目名与标题相同时只显示一个。

验证（dev-linux 工作区快照）：tsc、eslint、prettier 通过；`npm test` 398 通过 17 跳过；`test:db` 19 通过 2 跳过；`test:smoke` 34 通过 30 跳过；构建通过；截图脚本退出 0。

## 2026-11-22 上线前演练（生产备份副本）

- 03:30 生产备份恢复为两份：旧库保持原结构给 main `4487483` 的构建用，新库跑 `migrate.mjs`（0001 legacy，0002–0006 applied）给 `1f0e61b` 的构建用。
- 两个构建同时运行，按每位用户 × 2026 年各月及全年区间请求账本报表（默认、按付款日、个人消费、个人钱包）、资产报表、活动、家庭总览，共 242 个请求逐字段比较。
- 差异全部可解释：①资金流 `transferOut` 不再包含家庭钱包缴款（缴款单列，阶段 1 的口径调整）；②个人消费不再计入家庭钱包付款的分摊支出（家庭钱包支出归家庭共同费用）；③家庭总览为新接口；④资产报表来源列表排序和代表对方名称变化，按类别、金额、笔数比较完全一致。其余请求结果一致。
- 比较脚本与结果留在开发机临时目录（含真实数据，不入库），上线后删除。

## 2026-11-22 第三轮：页面改造、逐页审核与收尾

- 页面按业务域派 Codex 改造（记一笔、流水与详情、分析/预算/活动、钱包与计划、家庭、我的/设置/记忆/助手/帮助），Claude 定样式、逐张看中英文 × 电脑/手机截图并核对数字后合入。三轮打磨（polish-a/b/c）处理审核意见：原生下拉统一为 `FormSelect`、净资产卡去重、二级导航统一为下划线页签、列表行整行可点、抽屉表单间距、危险操作样式与二次确认、助手浮钮不遮挡、帮助目录对齐等。
- 数字核对（演示数据）：家庭 800 + 800 − 80 = 1,520，共同费用 48 + 32；钱包资产 25,099.90 − 负债 993 = 24,106.90；预算与首页同为 6,050 / 2,150.60 / 3,899.40；分析页 2,150.60 / 12,000 / 9,849.40。
- 标题统一用正文字体，只有品牌字样保留衬线（DESIGN-SYSTEM.md）。网络中断显示“网络连接失败，请重试。”。
- 旧全局样式清理：按源码 token 判断类名是否仍被引用，只删整条选择器都不可能命中的规则（`:not()` 内的类不计，动态拼接前缀保留），约 14 万字节；删除前后 208 张截图逐像素对比，只有时间戳不同。画像卡片动画关键帧移入模块（全局关键帧在 CSS Modules 里原本引用不到）。
- 版本：本次发布为正式 `v2.0.0`；9 月未打标签的 “2.0.0” 在 CHANGELOG 与版本历史中改称 2.0 预览，原说明移至 `docs/releases/v2.0.0-preview.md`。
