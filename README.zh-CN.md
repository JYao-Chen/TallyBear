<div align="center">

<img src="public/brand/tallybear-logo.png" width="140" alt="TallyBear — 布布一二主题 AI 记账" />

# TallyBear

**让 AI 读懂账单，让每一笔生活清晰可见。**

带有 **布布一二（一二布布）小熊主题**的 AI 个人与家庭记账应用。
自主部署 · 精细记账 · 财务对话 · 布布一二陪伴

[English](README.md) · 简体中文

[![Version](https://img.shields.io/badge/v1.0.0-78618f?style=flat-square)](https://github.com/JYao-Chen/TallyBear/releases/tag/v1.0.0)
[![MIT](https://img.shields.io/badge/code-MIT-43755e?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/deploy-Docker-d2a363?style=flat-square)](docs/deployment.md)

[开始使用](#开始使用) · [探索功能](#从一张账单到一份洞察) · [部署指南](docs/deployment.md) · [版本下载](https://github.com/JYao-Chen/TallyBear/releases)

</div>

**和布布、一二一起记账。** 白熊与棕熊插画、动态表情包和可自定义的分类图标，让日常记账多一点可爱。可以选择布布一二主题，也可以切换为简洁的无小熊界面。

![收支分析：收入、支出与消费构成](docs/screenshots/zh-desktop-analysis.png)

## 从一张账单，到一份洞察

拍下小票，整理明细；记下日常，读懂收支。

<table>
<tr>
<td width="33%" align="center">
<img src="public/characters/overalls.gif" height="90" alt="记录"/><br/>
<strong>01 · 轻松录入</strong><br/>
截图变成可编辑账单。<br/>商家、商品、优惠，一起留下。
</td>
<td width="33%" align="center">
<img src="public/characters/thinking.gif" height="90" alt="核验"/><br/>
<strong>02 · 智能核对</strong><br/>
核对金额，发现重复。<br/>跨图归并，还原完整订单。
</td>
<td width="33%" align="center">
<img src="public/characters/cheer.gif" height="90" alt="分析"/><br/>
<strong>03 · 对话分析</strong><br/>
问问收支，生成图表。<br/>把有用的分析保存成报告。
</td>
</tr>
</table>

### 每一单，都可以记得更细

一次上传多张图片或长截图，自动归并关联订单、提取商品明细、概括商品名称，并核对结算合计与实付金额。识别结果、重复提示和明细都可以在入账前查看与修改。

- **商品与结算** — 数量、单价、结算优惠与附加费用。
- **退货退款** — 关联原始消费，处理全额与部分退款。
- **检索与留存** — 搜索商家、分类和子项目；按需保存压缩凭证与生活附图。

### 让相同消费，记得更统一

交通、餐饮、购物、买菜共用结构化场景表单：始发站与终点站、店名与门店、用餐类型和商品概括分别记录，自动组成简洁标题。AI 草稿、手动记账和常用预设使用同一套字段；未知信息留空。开启“参考相关记账习惯”后，按商家与场景挑选去重后的历史样例，并参考自己的预设；分类有冲突时再调用模型判断，不以历史金额或路线补造本次事实。

### 能调用工具的财务助手

> “对比这个月和上个月，看看哪些支出增加了，生成图表并保存报告。”

基于 LangGraph 的助手查询已授权账本，协调识别、核验、记账与分析工具，生成图表并保存报告。也可以用文字或图片发起记账、周期订阅、常用预设、预算、费用分摊与分期还款：助手补齐字段、追问缺失信息，在对话中展示确认卡片；继续用自然语言修改，点击确认后保存。后台任务持续运行，支持进度展示、重试和管理员调整并发数量。

在后台选择 OpenAI 兼容服务、文字与视觉模型，并直接测试连接。

### 个人的钱，家庭的账，各有归属

| 你想管理的 | TallyBear 的方式 |
|---|---|
| 个人与家庭 | 独立用户、家庭、私人账本与共享账本。 |
| 钱从哪里花 | 资产归属个人或家庭，独立于账本。记账选择实际付款账户；移动或复用账单保留付款账户，同一笔交易只影响一次余额。 |
| 同一笔，不同视角 | 一笔交易关联多个账本，跨账本汇总按同一事件去重。 |
| 订阅与预算 | 自选日、周、月、年周期，精确分摊费用，设置分类预算。 |
| 自己的使用习惯 | 中英文部署、常用币种格式，以及电脑与手机自适应布局。 |

## 让日常记账，多一点陪伴

选择布布一二主题，让柔和配色与 **564 张动态表情**陪你记账；也可以切换简洁主题。头像、分类和账本标识，都能从表情库中挑选。

<p align="center"><img src="public/characters/together.gif" height="120" alt="布布和一二"/> &nbsp; <img src="public/stickers/bubu-yier-560.gif" height="120" alt="购物小熊"/></p>

<table>
<tr>
<td width="50%" align="center"><strong>手机随手记</strong><br/><br/><img src="docs/screenshots/zh-mobile-overview.png" width="280" alt="手机版账本总览"/></td>
<td width="50%" align="center"><strong>明细与优惠，一目了然</strong><br/><br/><img src="docs/screenshots/zh-mobile-line-items.png" width="280" alt="手机版商品与结算明细"/></td>
</tr>
</table>

<details>
<summary><strong>展开查看更多中文页面</strong></summary>

#### 智能录入
![中文智能录入工作台](docs/screenshots/zh-desktop-intake.png)

#### 订单详情
![中文订单详情](docs/screenshots/zh-desktop-line-items.png)

</details>

## 技术路线与 AI 协作

TallyBear 使用 **Next.js 全栈应用 + PostgreSQL + 独立任务 Worker**。前端与 API 共享 TypeScript 领域类型；交易、权限、任务进度和报告持久化到数据库，图片经 Sharp 压缩后进入独立存储。

| 层次 | 实现 | 负责什么 |
|---|---|---|
| 页面与交互 | React · Next.js App Router | 响应式记账、草稿核对、对话与账本管理 |
| 业务与数据 | Next.js API · PostgreSQL | 账本权限、交易事务、账户余额、费用分摊与去重统计 |
| AI 协作 | LangGraph · 工具调用 | 总助手按任务委派识别、核对、分析助手 |
| 后台执行 | 独立 Node.js Worker · PostgreSQL 队列 | 持久任务、进度、重试与可配置并发 |
| 展示与附件 | Recharts · Markdown · Sharp | 对话图表、可保存报告、高清压缩凭证 |

### 总助手调度，专业助手分工

对话采用 **Supervisor + 专业助手** 的多智能体架构。每个助手通过 LangGraph 的“模型决策 → 工具执行 → 继续决策”循环完成任务。总助手可以直接回答简单问题，也可以根据需要委派专业助手，再依据返回的证据继续调用工具或汇总结论。

| 助手 | 使用的能力 | 用户得到的结果 |
|---|---|---|
| 总助手 | 理解问题、选择工具、委派任务、汇总结果 | 一个连续的财务对话入口 |
| 识别助手 | 图片与文字识别、跨图订单整理 | 商家标题、商品明细、优惠和可编辑草稿 |
| 核对助手 | 草稿检查、重复匹配、退款与金额核验 | 可核对的差额、重复提示与关联建议 |
| 分析助手 | 收支查询、账户查询、预算与分摊、图表工具 | 有数据依据的分析、图表与报告 |

**AI 理解内容，业务工具计算金额。** 图表工具直接查询账本汇总，金额采用整数最小货币单位计算；模型负责解释结果、选择分析范围与组织报告。账单识别结合结构化提取和金额核验，把图片转换成可确认的记录。

专业助手共享本轮草稿与已有结论，通过总助手协调协作。后台队列支持多个任务并发执行；对话中展示处理阶段、工具活动和流式回答，用户离开页面后任务继续运行。服务地址、文字模型、视觉模型与队列并发均可配置。

这条路线把 **录入 → 核对 → 入账 → 分析** 连起来：减少逐项抄写，让重复订单与金额差异在确认前可见，并把财务查询直接变成可查看、可保存的图文结果。

## 开始使用

准备 **Docker Compose v2** 与 **Node.js 22**（用于初始化配置）。

```sh
git clone https://github.com/JYao-Chen/TallyBear.git
cd TallyBear
npm run setup
```

打开生成的 `.env`，设置语言、币种与访问地址：

```dotenv
APP_ORIGIN=http://localhost:3016
APP_LANGUAGE=zh-CN
APP_CURRENCY=CNY
```

```sh
docker compose up -d --build
```

打开 [**localhost:3016**](http://localhost:3016)，使用 `.env` 中的 `ADMIN_USERNAME` 与自动生成的 `ADMIN_PASSWORD` 登录，创建第一本账本即可开始记录。

<details>
<summary><strong>语言、币种与公网部署</strong></summary>

| 配置 | 可选值 |
|---|---|
| `APP_LANGUAGE` | `en` · `zh-CN` |
| `APP_CURRENCY` | `USD` · `EUR` · `GBP` · `CNY` |

初始化默认使用英文与美元。每套部署统一使用一种语言和币种，界面、AI 生成摘要、图表与导出遵循语言设置；金额以最小货币单位的整数存储。人民币部署还支持微信与支付宝 CSV 账单导入。

公网访问时配置 HTTPS 反向代理，并将 `APP_ORIGIN` 设为实际公网地址。

[部署、存储与备份 →](docs/deployment.md)

</details>

<details>
<summary><strong>连接 AI 服务</strong></summary>

1. 管理员打开 **账本设置**。
2. 填写 OpenAI 兼容服务地址（以 `/v1` 结尾）、API Key、文字与视觉模型名称。
3. 文字模型选择支持工具调用与流式输出的型号，视觉模型选择支持图片输入的型号。
4. 分别测试文字与图片连接，设置后台并发数量。
5. 进入 **记一笔 → AI 文字／截图**，上传账单，核对草稿并选择资金账户。

[记账与 AI 使用指南 →](docs/user-guide.md)

</details>

<details>
<summary><strong>参与开发</strong></summary>

**Next.js App Router · React · TypeScript · PostgreSQL · LangGraph · Recharts · Sharp**

Next.js 提供页面与 API，独立 Worker 处理持久化后台任务，与 Web 应用共享 PostgreSQL 和图片存储。

```sh
npm ci
npm run setup
docker compose -f compose.yaml -f compose.dev.yaml up -d db
node --env-file=.env scripts/init.mjs
npm run dev
```

在另一个终端启动 Worker：

```sh
node --env-file=.env --import tsx scripts/worker.ts
```

```sh
npm run typecheck
npm test
npm run build
```

[贡献指南 →](CONTRIBUTING.md)

</details>

---

<div align="center">

**一起把记账，做成更轻松的小事。**

欢迎分享使用建议、完善翻译、补充账单格式，或提交你的改进。

[提出建议](https://github.com/JYao-Chen/TallyBear/issues) · [参与贡献](CONTRIBUTING.md) · [更新记录](CHANGELOG.md)

喜欢 TallyBear？点一颗 ⭐，让更多人找到自己的记账伙伴。

[MIT](LICENSE) · [素材与致谢](THIRD_PARTY_NOTICES.md)

</div>

## 分期、负债与按月分摊

白条、花呗和信用卡等使用负债账户管理：购买时记录一次消费，还本金是钱包之间的转账，利息与手续费单独计支出。支持新建分期购买、关联已有消费、部分还款、提前结清、调整后续各期金额与日期，以及撤销误记的还款。个人与家庭共同负债沿用资产权限。

费用分摊与还款计划独立：可以将购买成本分摊到实际使用月份，既不改钱包余额，也不增加欠款；提前结清不会缩短分摊期。退回负债账户的退款抵减本金。对话助手可查询有权访问的分期，区分消费、实际还款与月度成本。
