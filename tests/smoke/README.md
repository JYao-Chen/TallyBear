# 冒烟清单

从仓库根目录运行，需要 Node 22.23.4 和可建库的 PostgreSQL 账号。记忆向量用例需要 pgvector。请为同时运行的测试任务指定不同的数据库名。

```sh
TZ=Asia/Shanghai TEST_DATABASE_URL=postgres://tb:x@127.0.0.1:55486/tallybear_test npm run test:smoke
```

每个数据库脚本开始前，入口会删除并重建指定数据库，执行当前迁移、设置测试币种 CNY，再将连接字符串作为 `SMOKE_DATABASE_URL` 传给独立子进程。纯单元脚本无需建库。入口串行执行、打印每项跳过原因及最终计数，有失败时返回非零退出码。

手动运行数据库脚本时，将 `SMOKE_DATABASE_URL` 指向已迁移的、可丢弃的本机测试库。连接地址须使用 `127.0.0.1` 和以 `_test` 结尾的库名。使用应用内 API 的脚本还需要与库一致的部署币种、测试 `APP_ORIGIN`。测试所需的加密密钥使用临时随机值。例：`SMOKE_DATABASE_URL=postgres://tb:x@127.0.0.1:55486/tallybear_test node --import tsx tests/smoke/asset-ownership-smoke.ts`。

按需项从命令行单独运行（TypeScript 用 `node --import tsx`，MJS 用 `node`）。HTTP 用例只连使用同一临时库的测试实例，文件上传使用同一独立收据目录。`setup.mjs` 生成环境文件，`init.mjs` 初始化管理员；两者均不生成下表中的演示数据。浏览器前置条件见[浏览器说明](../browser/README.md)。

| 脚本 | 归类 | 夹具、前置条件或原因 |
| --- | --- | --- |
| `accounts-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `agents-live-smoke.ts` | 按需 | 需要 queue0 测试用户、账本和已配置的真实模型。 |
| `ai-smoke.mjs` | 按需 | 需要测试服务、yao 演示账号、ADMIN_PASSWORD 和模型配置。 |
| `ai-stream-smoke.mjs` | 按需 | 需要测试服务、yao 演示账号、ADMIN_PASSWORD 和模型配置。 |
| `allocation-order-smoke.ts` | 转正 · 数据库 | 自建真实流水和分摊行，验证分页前排序。 |
| `allocation-range-smoke.ts` | 转正 · 数据库 | 自建支出与退款，验证日期区间、分摊和回滚。 |
| `asset-ownership-smoke.ts` | 转正 · 数据库 | 自建个人和家庭钱包，验证归属、权限和余额。 |
| `assistant-allocation-range-smoke.ts` | 转正 · 数据库 | 用合成对话确认分摊卡，验证重复确认及钱包余额。 |
| `assistant-capabilities-smoke.ts` | 转正 · 数据库 | 自建对话、账目和钱包，直接执行工具及确认操作。 |
| `assistant-operations-smoke.ts` | 转正 · 数据库 | 用测试 APP_ORIGIN 调用应用内 API，验证确认、撤销和权限。 |
| `avatar-management-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `budget-rename-smoke.mjs` | 按需 | 需要 localhost:3119 的测试服务。 |
| `category-move-smoke.mjs` | 按需 | 需要测试服务、ADMIN_USERNAME 和 TEST_PASSWORD。 |
| `category-rename-smoke.ts` | 转正 · 数据库 | 事务内创建多个账本，验证历史分类和预算更新范围。 |
| `chat-actions-smoke.ts` | 转正 · 数据库 | 自建用户及会话，验证卡片修订、重复请求和确认。 |
| `chat-card-placement-smoke.ts` | 转正 · 单元 | 内存中的模拟对话覆盖卡片归属与去重。 |
| `chat-scope-smoke.ts` | 转正 · 数据库 | 双账本夹具验证去重；通过当前工具的 bookIds 参数验证越权拒绝。 |
| `chat-search-smoke.ts` | 转正 · 数据库 | 用显式 bookIds 限定单本查询，再跨本搜索并检查隐藏账本隔离。 |
| `cost-projects-smoke.ts` | 转正 · 数据库 | 自建付款人与参与人，验证费用归属及项目权限。 |
| `cost-schedules-smoke.ts` | 转正 · 数据库 | 自建家庭、账本和计划，验证期数、同意及付款历史。 |
| `cost-settlement-smoke.ts` | 转正 · 数据库 | 自建付款与结算项目，验证取消、确认和钱包影响。 |
| `cross-image-smoke.mjs` | 按需 | 需要测试服务和可处理请求的 AI 配置。 |
| `deployment-http-smoke.mjs` | 按需 | 需要 .next/standalone 构建及空闲的 3017 端口。 |
| `families-http-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `families-smoke.ts` | 转正 · 数据库 | 自建用户和账本，验证邀请、转让和退出。 |
| `family-finance-smoke.ts` | 转正 · 数据库 | 自建成员、钱包和账本，覆盖家庭往来与分担，复用入口建库。 |
| `finance-chat-image-smoke.mjs` | 按需 | 需要测试服务和可处理请求的 AI 配置。 |
| `finance-chat-smoke.mjs` | 按需 | 需要测试服务和可处理请求的 AI 配置。 |
| `finance-query-smoke.ts` | 转正 · 数据库 | 构造跨本重复事件和商品明细，核对查询、图表与分页。 |
| `flexible-period-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `i18n-http-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `i18n-render-smoke.tsx` | 转正 · 单元 | 服务端渲染八个英文界面；Node 仅忽略静态标记不使用的 CSS。 |
| `improvements-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `installment-action-smoke.ts` | 转正 · 数据库 | 自建助手卡片和钱包，验证分期确认及分摊。 |
| `installments-smoke.ts` | 转正 · 数据库 | 自建交易验证还款、退款、撤销及重复请求。 |
| `item-categories-smoke.ts` | 转正 · 数据库 | 自建商品和优惠行，验证分摊、导出、重命名和钱包扣款。 |
| `line-items-image-smoke.mjs` | 按需 | 需要测试服务和可处理请求的 AI 配置。 |
| `line-items-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `memory-live-five.ts` | 按需 | 需要 DashScope 真实模型、测试密钥和 TEST_ARTIFACT_DIR。 |
| `memory-model-smoke.ts` | 转正 · 数据库 | 自建 pgvector 索引，模拟嵌入响应，验证权限、切换及降级。 |
| `memory-smoke.ts` | 转正 · 数据库 | 自建记忆和来源，验证检索、遗忘、共享与撤权。 |
| `modal-scroll-smoke.ts` | 转正 · 单元 | 模拟 document，覆盖嵌套弹窗按两种顺序关闭。 |
| `organize-http-smoke.ts` | 按需 | 需要 TEST_BASE_URL 对应的测试服务。 |
| `password-policy-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `photo-upload-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `preference-smoke.ts` | 转正 · 数据库 | 自建个人消费历史，验证助手确认卡同时保存账本和钱包的偏好依据。 |
| `profile-smoke.ts` | 转正 · 数据库 | 事务内建立个人规则和上下文，验证权限、推断及设置。 |
| `purchase-search-smoke.ts` | 按需 | 需要 TEST_ORIGIN 对应的测试服务及图片夹具。 |
| `queue-public-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务和独立队列 worker。 |
| `queue-smoke.ts` | 按需 | 需要 TEST_RELEASE 中的 standalone 服务、3018 端口及队列 worker。 |
| `receipt-origin-smoke.ts` | 转正 · 单元 | 合成凭证线索覆盖平台、支付渠道与钱包匹配。 |
| `receipt-retention-smoke.ts` | 转正 · 数据库 | 合成图片和个人钱包，验证临时目录中的保留、过期和队列保护。 |
| `receipt-upload-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `scene-http-smoke.ts` | 按需 | 需要场景冒烟生成的记录、历史 scene-entry 服务构建和 3018 端口。 |
| `scene-smoke.ts` | 转正 · 数据库 | 自建账本、钱包与消费场景，验证复用及偏好。 |
| `search-smoke.ts` | 转正 · 数据库 | 自建两个用户和两本账，以可见交易关联钱包，验证筛选、隐私和分页。 |
| `settlement-categories-smoke.ts` | 转正 · 数据库 | 用合成明细比较 SQL 与分类金额计算。 |
| `shared-transfer-note-smoke.ts` | 转正 · 数据库 | 自建家庭与转账，验证备注同步、报表和权限。 |
| `themes-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `title-settlement-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `transaction-photos-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
| `unified-report-smoke.ts` | 转正 · 数据库 | 自建分担项目及副本，验证统计、导出及余额。 |
| `wallet-lifecycle-smoke.ts` | 转正 · 数据库 | 自建个人钱包及交易，验证归档、合并和复用。 |
| `wallets-smoke.mjs` | 按需 | 需要运行中的隔离 HTTP 服务（APP_ORIGIN）。 |
