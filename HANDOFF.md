# 交接：TallyBear（保存于2026-11-23，Claude@代理机）

## 先读
1. `docs/sessions/20261123-polish.md`（本会话记录）
2. `docs/refactor/DESIGN-SYSTEM.md`（视觉规范）、`docs/refactor/STATS-BASIS.md`（统计口径）
3. `src/components/QuickEntry.tsx`、`src/components/CategoryPicker.tsx`（正在重构的手动记账）

## 仓库状态
| 仓库 | 分支 | 最新commit | 未推送/未提交 |
|---|---|---|---|
| TallyBear | `feat/v2-polish` | 见 `git log -3`（WIP：手动记账重构） | 已推送；main = 5080b75 = 生产 v2.0.0 + HANDOFF |

## 进行中
### 1. 前端打磨（用户要求：文字截断、溢出、风格统一逐页检查）
- 7d7b56b 已完成一轮并通过全量检查，未部署。
- 方法：`node scripts/readme-screenshots.mjs` 加环境变量 `CLIP_AUDIT=<out>/clips.json`，输出每页被截断/溢出的元素；配合截图逐张看（中英文 × 电脑/手机）。
- 剩余已知小项：帮助页手机章节条横向滚动（有意）、资产页钱包分布图横轴标签省略、Sort 选择框英文 “Newest” 差 2px（已加 min-width 待复核）。

### 2. 手动记账重构（用户要求：选项层层折叠页面太长、类别不能搜索、带表情的类别显示不正常 → 重做前端与交互）
- 已做（WIP 提交）：核心字段（类型/金额/标题/类别/账户日期/账本）单列；“补充信息”按钮组按需展开（商家与平台、商品与优惠费用、消费场景、备注、订单号与流水号、活动、分期、生活附图），已有数据的默认展开；表单容器 ≥860px 时补充信息放右栏并吸顶。
- CategoryPicker：常用 7 类快捷选 + “全部 N 类”打开可搜索弹窗（回车选第一项）；贴纸用静态 PNG。
- 截图脚本在 `shot('manual')` 后新增 `manual-categories`、`manual-extras` 两张（第 1874 行附近）。
- tests/browser 下三个浏览器脚本已改为新结构（不在默认验证里）。
- 未验证：没跑全量测试、没跑截图。DraftReview 里选中草稿后的长表单（“账单归属与场景”等）还是旧结构，可用同样思路收敛。

## 后台任务
- 无需接手的任务。dev-linux `/home/yao/scratch/20261123_tallybear-polish/`：截图工作目录（pw/ 为 Playwright，p1–p3 为截图结果、sheet.py 拼图）。任务结束后删除该目录，以及本任务下载的 `~/.cache/ms-playwright/chromium-1200`、`chromium_headless_shell-1200`。

## 下一步
1. 在 dev-linux 检出 `feat/v2-polish`，跑全量：`npm ci && npx tsc --noEmit && npx eslint . --quiet && npx prettier --check . && npm test && npm run build`；数据库与冒烟测试按 README（pgvector 临时容器，`TEST_DATABASE_URL`）。
2. 跑截图：`SCREENSHOT_DIR=<out>/shots SCREENSHOT_AUDIT=<out>/untranslated.json CLIP_AUDIT=<out>/clips.json PLAYWRIGHT_MODULE=/home/yao/scratch/20261123_tallybear-polish/pw/node_modules/playwright/index.mjs node scripts/readme-screenshots.mjs`；重点看 manual、manual-categories、manual-extras、draft-edit、refund（中英 × 手机/电脑），修到无截断、无溢出。`HELP_FIGURES_ONLY=1` 再出帮助图。
3. 通过后把 `<out>/shots` 中与 `docs/screenshots/v2` 同名的图覆盖进去并更新 manifest.json 的宽高与 capturedAt。
4. 交回代理机审核后再合并、部署（Codex 不提交、不推送、不部署）。

## 等用户决定
- 是否删除远端旧分支 `refactor/v3`（含生产地址，仓库公开）：`git push origin --delete refactor/v3`。
- 生产机上 12 个旧 WeKnora 应用镜像（2.3–4.9G/个，层共享，约 5G 可回收）是否清理，只保留当前和上一版。

## 现行约束
- 仓库公开：生产主机、路径、真实金额不写进仓库。
- 生产部署方式：dev-linux 从 tag 干净构建发布包 → 生产 releases/<名> → 备份 → 迁移 → 切 current/rollback 软链 → 健康检查；不在生产构建（内存紧张）；保留两个 release。具体主机与步骤见维护者工作站项目清单，不在仓库。
- 回滚到 2.0 之前会让所有人重新登录（迁移 0002）。

## 本会话记录
- `docs/sessions/20261123-polish.md`；commit 7d7b56b（打磨）与本次 WIP 提交。
