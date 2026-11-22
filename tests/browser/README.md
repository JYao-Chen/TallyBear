# 浏览器验收脚本

从仓库根目录运行。此目录保留阶段 4 页面重写前的浏览器验收，不随 `npm run test:smoke` 执行。

- **组件脚本**（如 `manual-entry-date-browser.mjs`）用 esbuild 在仓库根目录解析源码，向 Chromium 注入合成数据或拦截请求。可直接运行，无需登录应用。
- **整页脚本**需要已启动的本机测试服务。按脚本设置 `TEST_ORIGIN`、`CLAIM_TEST_ORIGIN`、`DISCUSSION_TEST_ORIGIN` 或 `COST_TEST_ORIGIN`。部分旧脚本使用固定端口。服务的 `APP_ORIGIN`、语言、币种和数据库应与夹具一致。
- **账号与数据**：按脚本传入测试账号的 `TEST_SESSION`（如 `finance-query-browser.mjs`），或设置与服务相同的 `DATABASE_URL`，供脚本创建测试用户及会话。有些脚本仍校验特定库名或查询先前生成的演示记录，如季度房租、记忆五案例。只使用可丢弃的本机测试库及独立收据目录。
- **Playwright**：仓库锁文件没有提供浏览器测试所需的 Playwright 安装。将 `PLAYWRIGHT_MODULE` 指向外部现有安装中可导入的模块入口（绝对路径）。部分脚本也支持自行解析 `playwright`。使用该安装配套的 Chromium；支持自定义二进制的脚本可设 `TEST_CHROMIUM_PATH`。
- **截图**：按脚本提供 `TEST_ARTIFACT_DIR` 或 `COST_SCREENSHOT_DIR`。部分旧脚本固定了截图路径或校验目录前缀，运行前先核对目标目录。

```sh
node tests/browser/manual-entry-date-browser.mjs
# TypeScript 脚本，需先满足上面的整页测试条件
node --import tsx tests/browser/discussions-browser.ts
```
