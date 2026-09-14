<p align="center"><img src="public/brand/tallybear-logo.png" width="220" alt="TallyBear：白熊和棕熊一起记账" /></p>
<h1 align="center">TallyBear · 小熊记账</h1>
<p align="center"><strong>把票据整理成账目，把问题变成财务洞察。</strong></p>
<p align="center">AI 驱动的个人与家庭记账，可自行部署，也有小熊陪你记录生活。</p>
<p align="center"><a href="README.md">English</a> · 简体中文<br/>
<a href="https://github.com/JYao-Chen/TallyBear/releases"><img alt="版本" src="https://img.shields.io/badge/version-1.0.0-78618f" /></a>
<a href="LICENSE"><img alt="代码许可 MIT" src="https://img.shields.io/badge/code-MIT-43755e" /></a>
<img alt="自行部署" src="https://img.shields.io/badge/self--hosted-your%20data-d2a363" /></p>

## 少一点录入，多一点理解

上传小票、长截图，或同一订单的多张图片。TallyBear 帮你整理成可编辑的账目，保留商品明细，核验实付金额，提示可能的重复记录。核对保存以后，再通过对话了解自己的消费。

**上传图片 → 整理草稿 → 金额核验 → 你来确认 → 对话分析。**

<table><tr>
<td width="33%" align="center"><img src="public/characters/overalls.gif" height="100" alt="小熊主题插画"/><br/><strong>记录细节</strong><br/>截图、小票、商品、优惠与附加费用。</td>
<td width="33%" align="center"><img src="public/characters/thinking.gif" height="100" alt="思考中的小熊插画"/><br/><strong>核对再入账</strong><br/>重复提示、退款关联、明细与总额核验。</td>
<td width="33%" align="center"><img src="public/characters/cheer.gif" height="100" alt="开心的小熊插画"/><br/><strong>和账本聊聊</strong><br/>查询真实账目，生成图表，保存分析报告。</td>
</tr></table>

## 特色能力

### 🧾 从零散截图到完整账目

- **批量与跨图识别**：一图多单、多图一单、长小票，统一整理。
- **保留消费明细**：优先提取商家作为标题，商品名称简明概括，保留数量、单价、优惠和配送费。
- **不止识字，还会核验**：明细加总与实付对比，不一致时重新识别；仍不确定的交给用户核对。
- **智能重复提示**：结合已有流水查找重复，归并互补的订单信息，不单凭金额相同就删除记录。
- **正确区分退款与转账**：支持原消费关联、部分退款；退款冲减支出，账户互转不算收入或消费。

### ✨ 能使用工具的财务助手

问一句“比较这个月和上个月的支出”，或“列出我的大额消费”，助手会查询有权限的账目、核对草稿、生成图表，并把有用的分析保存为报告。

- 使用 LangGraph 协调主助手与识别、核对、分析工具。
- 后台可配置兼容 OpenAI API 的服务地址、文字模型、视觉模型与连接测试。
- 任务进入持久化后台队列，显示进度，支持重试与并发数量设置；关闭网页仍继续处理。
- 识别结果先形成草稿，由你确认入账；不会执行真实支付或银行转账。

### 🏡 个人独立，家庭共享

独立账号、家庭、多账本和明确的成员权限。私人账与公共账分开，个人钱包与共有钱包分别管理。一笔交易可关联多个账本，跨账本汇总按关联事件去重。应用管理员不会自动获得私人账本的访问权。

### 📊 日常财务，一起照顾

预算与账户余额、收支图表、自定义日／周／月／年周期、精确到分的费用分摊、包含商品子项目的搜索、可选压缩凭证，以及记录吃了什么、买了什么的生活附图。

### 🐻 小熊陪伴，也可以极简

提供 **布布一二主题** 与 **极简主题**。内置 **564 张动态表情**，可用于分类、头像和账本图标；系统开启减少动态效果时使用静态图片。

<p align="center"><img src="public/characters/together.gif" width="170" alt="布布和一二主题插画"/> &nbsp; <img src="public/stickers/bubu-yier-560.gif" width="120" alt="可选的小熊表情"/></p>

## 真实页面预览

以下为独立演示环境中的真实浏览器截图，账号、姓名和交易均为虚构示例，不含个人账单。电脑端视口为 1440 × 1000，手机端为 390 × 844；整页截图可能更长。

![电脑端收支分析](docs/screenshots/desktop-analysis.png)

<table><tr><td width="50%" align="center"><strong>手机端总览</strong><br/><img src="docs/screenshots/mobile-overview.png" width="300" alt="手机端总览"/></td><td width="50%" align="center"><strong>订单明细</strong><br/><img src="docs/screenshots/mobile-line-items.png" width="300" alt="手机端订单明细与结算优惠"/></td></tr></table>

<details><summary>查看更多电脑端截图</summary>

![流水筛选与搜索](docs/screenshots/desktop-transactions.png)
![订单明细与优惠核验](docs/screenshots/desktop-line-items.png)
![智能录入工作区](docs/screenshots/desktop-intake.png)

</details>

## 快速部署

需要 **Docker Compose v2**，以及用于生成配置的 **Node.js 22**。

```sh
git clone https://github.com/JYao-Chen/TallyBear.git
cd TallyBear
npm run setup
```

打开生成的 `.env`，其中已生成独立的数据库密码、加密密钥和初始 `ADMIN_PASSWORD`。**首次启动前**选择语言、币种和访问地址：

```dotenv
APP_ORIGIN=http://localhost:3016
APP_LANGUAGE=zh-CN
APP_CURRENCY=CNY
ADMIN_USERNAME=admin
```

```sh
docker compose up -d --build
```

访问 **http://localhost:3016**，使用 `ADMIN_USERNAME` 和配置文件中的 `ADMIN_PASSWORD` 登录。创建账本后，在后台配置 AI 服务即可使用识别与对话；手动记账无需 AI Key。

公网使用时，在本机端口前配置 HTTPS 反向代理，并将 `APP_ORIGIN` 改为准确的公网地址。[部署说明 →](docs/deployment.md)

## 语言与币种

| 配置项 | 支持值 |
|---|---|
| `APP_LANGUAGE` | `zh-CN`、`en` |
| `APP_CURRENCY` | `CNY`、`USD`、`EUR`、`GBP` |

安装助手默认生成英文＋美元配置；中文用户按上面的示例修改。语言与币种由部署统一决定，应用内不显示切换入口。界面、AI 生成摘要、图表标签和导出使用配置语言；商家原名与已有用户内容保留。

每个数据库使用**一种币种**，金额保存为整数最小货币单位。不做汇率换算，也不把已有人民币金额直接改标成美元。配置与数据库币种不同会阻止运行。微信和支付宝 CSV 导入限人民币部署，目前不提供海外银行自动同步。

## 配置 AI 助手

1. 管理员登录后进入**账本设置**，配置 AI 服务和后台任务并发数。
2. 填写兼容 OpenAI 的**基础地址**（通常以 `/v1` 结尾）、API Key、文字模型及视觉模型。应用会追加 `/chat/completions`，基础地址不要重复包含这个后缀。
3. 文字模型需支持**工具调用与流式响应**；视觉模型需支持**图片输入**。同一模型具备两种能力时可以填写相同名称。
4. 分别测试文字和图片能力。文字连接成功，不代表视觉识别也可用。
5. 在**记一笔 → AI 文字／截图**中上传小票，核对金额和明细，选择实际收付款账户后确认入账。

模型名称没有写死。这里需要模型服务的 API 凭据，不是 Claude/Codex 客户端订阅或浏览器登录凭据。助手只能访问当前用户有权访问的账本。[详细使用说明 →](docs/user-guide.md)

## 金额与统计口径

| 场景 | 处理方式 |
|---|---|
| 小票只有“支付宝”，没有具体扣款账户 | 保留付款平台，确认入账时选择资金账户；识图不猜资金来源。 |
| 商品合计 60 元，结算优惠 2 元 | 保留商品与负数优惠明细，实际记账 58 元。 |
| 退货款到账 | 关联原消费并冲减支出，不当作工资等收入。 |
| 用个人银行卡支付家庭费用 | 可以记入共享账本；钱包归属与账本可见性分别管理。 |
| 一笔消费同时记入个人账和公账 | 使用“同时记入另一本账本”，保留同一事件关联，跨账本合计去重；两次独立手填不能保证自动视为同一笔。 |
| 100 元订阅覆盖 12 个月 | 按最小货币单位分配余数，分摊合计严格等于 100 元；实际付款只发生一次。 |

## 常见问题

**能自动连接银行吗？** 当前支持图片、文字、手工记账以及微信/支付宝 CSV 导入，不包含银行实时同步、实际扣款或银行转账。

**关闭网页会停止识别吗？** 已排队任务由后台 worker 继续处理，重新进入可以查看进度和结果；部署时必须运行 worker。

**可以不用 AI、不用小熊吗？** 可以。手工记账不需要模型 Key，用户可选择极简主题。

**这是 Actual Budget 的换皮吗？** 不是。TallyBear 有独立的 Next.js 前后端、PostgreSQL 数据结构和后台进程，不依赖 Actual 服务；当前没有自动迁移 Actual 数据库的工具。

**能随时切换币种吗？** 不会通过更改符号来转换已有金额。每个数据库仅使用一种币种；不同币种应使用新部署。v1.0 不做汇率换算或多币种余额合并。

## 本地开发

```sh
npm ci
npm run setup                         # 仅在没有 .env 时执行
docker compose -f compose.yaml -f compose.dev.yaml up -d db
node --env-file=.env scripts/init.mjs
npm run dev
```

另开终端启动后台任务：

```sh
node --env-file=.env --import tsx scripts/worker.ts
```

```sh
npm run typecheck
npm test
npm run build
```

**技术栈：** Next.js App Router、React、TypeScript、PostgreSQL、LangGraph、Recharts、Sharp。网页与后台任务共用数据库和持久化图片存储。[参与贡献 →](CONTRIBUTING.md)

## 数据与 AI

账本权限由应用控制，不提供针对服务器运维者的端到端加密。使用 AI 时，输入的图片、文字及任务所需的授权上下文会发送给配置的模型服务。模型效果、可用性和费用取决于服务提供方。

凭证图片可选择保存；已关联交易的图片长期保留，未引用的临时上传文件满七天后清理。请同时备份数据库、图片与配置，尤其保留加密密钥。[备份说明 →](docs/deployment.md#backups)

## 参与项目

欢迎提交 Bug、去除个人信息的票据格式样例、翻译和界面改进。可以先创建 [Issue](https://github.com/JYao-Chen/TallyBear/issues)，或阅读 [贡献说明](CONTRIBUTING.md)。

如果 TallyBear 对你有用，欢迎点一个 ⭐，让更多人发现它。

## 许可与致谢

应用代码采用 [MIT](LICENSE)。字体、第三方标识和角色素材单独列在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。TallyBear 是独立项目，不是布布一二官方产品。
