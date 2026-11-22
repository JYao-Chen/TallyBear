# HANDOFF：TallyBear v3 重构

更新：2026-11-22

## 当前状态
- 分支 `refactor/v3`，基于 main `4487483`（= 生产）。尚无提交。
- 计划：`docs/refactor/PLAN.md`（决策、目标架构、阶段 0–5）。
- 视觉方案画布：https://claude.ai/artifact/6P7fRN1n9pZFftzdgHbgDu （第四行“A+C 整合”为定稿）。
- 视觉方向已定：A+C 整合，规范见 `docs/refactor/DESIGN-SYSTEM.md`。
- 统计口径：`docs/refactor/STATS-BASIS.md`（口径表、问题分级、财务总览三条线 + 对账表、阶段映射）。家庭钱包已定为“缴款 + 共同费用”（第 6 节）。带真实金额的版本 `STATS-AUDIT.md` 只在维护者本机，被 .gitignore 排除。
- 阶段 0 第 1 项（迁移系统）完成并验证，记录见 `docs/refactor/LOG.md`。尚未提交。

## 下一步
1. 阶段 0 第 2 项：Prettier + ESLint，单独一次只改格式的提交（需用户同意提交）。
2. 阶段 0 第 3、4 项：冒烟脚本归类；关键口径特征测试（合成数据），口径快照基线已存 dev-linux。
3. 上线前确认生产部署流程调用 `init.mjs`/`migrate.mjs`（首次会登记 0001|legacy）。

## 位置
- 代理机编辑：`/root/projects/apps/TallyBear`
- dev-linux 旧检出 `/home/yao/projects/apps/tallybear` 有用户未提交的文档改动，不要动。
- 仓库公开：生产主机、路径、账号等不写进仓库，见维护者工作站的项目清单。生产机内存与磁盘都紧张，部署前先看余量。
- 验证：`dev-check linux -- <命令>`；不在代理机装依赖。
