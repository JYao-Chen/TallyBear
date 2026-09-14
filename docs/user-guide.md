# Using TallyBear / 使用指南

## Start with the structure / 先设置账户关系

**User → family membership → book permission → funding account.** These represent different things:

- A user signs in independently. A family organizes people and books; joining a family does not mean every private book becomes public.
- A book defines a recording and reporting scope. Owners manage access; editors record transactions; viewers read permitted records.
- A funding account records where money moved. Personal/shared ownership is separate from whether a book is shared.
- A linked wallet connects representations of the same real wallet across books. Link only accounts that really represent the same funds.

用户独立登录；家庭组织成员和账本；账本决定记录与统计范围；资金账户说明钱实际从哪里来、到哪里去。个人账户可以支付公账消费，共享账本不会自动把付款钱包变成家庭共有。不要把不同人的支付宝或银行卡关联为同一个钱包。

## Receipt workflow / 账单识别流程

1. Open Record and choose AI text/screenshots. Upload one or several images; overlapping screenshots and long receipts are supported.
2. The worker extracts candidate orders, combines complementary evidence and checks item totals. Possible duplicates and unresolved differences stay reviewable.
3. Check merchant/title, payment date, paid total, category and line items. Explicit fees are positive; checkout discounts are negative. Unknown item amounts remain unknown.
4. Select the actual funding account. A visible platform such as Alipay does not prove which balance or bank card was debited. OCR does not require that information to prepare a draft.
5. Resolve duplicate suggestions and refund links. Choose whether to retain receipt vouchers, then confirm saving.

上传图片后先生成草稿，不会因为识别完成就自动扣款或转账。一个订单可以保留多个商品明细，但整单实付只记一次。原图编号用于跨图关联与核对，不等于资金来源。票面不足时可以手动补充，不应编造折扣来强行配平。

## Refunds and reused entries / 退款与复用

A received refund reduces spending and can link to the original purchase. An application for a refund is not money received. Keep the original purchase and refund as separate dated records.

Use “Record in another book too” to preserve the shared event identity. Cross-book totals deduplicate linked copies. Separately typing the same purchase twice does not establish that link. Linked amount/date edits affect associated entries; book-specific notes/categories remain local. Removing one book's copy does not erase the whole event from every book.

退款到账才记退款；退款申请中不当作收入。通过“同时记入另一本账本”复用，系统才有可靠的关联用于跨账本去重。独立重复录入的两笔记录需要另行核对。

## Cost allocation / 周期分摊

Record the actual payment first, then configure its coverage period. The allocation view distributes integer minor units over the selected days/weeks/months/years. Remainders are assigned without losing a cent. It does not manufacture extra payments or change the actual account balance. Recurring schedules and allocation are distinct: a schedule concerns future due dates; allocation describes the cost coverage of a payment.

先记录一次实际付款，再设置费用覆盖的起始日期与周期。分摊展示每月承担多少费用，不重复生成付款、不改变真实余额。“周期账单”管理何时应付款，“费用分摊”管理已经付款的费用覆盖多久。

## Assistant and background work / 助手与后台任务

Open Bear assistant (or AI assistant in the minimal theme) to ask about authorized data. Queries can use ledger tools and produce charts/report artifacts. Save useful reports for later. Recognition and chat run through durable jobs; closing a tab does not cancel them. The background worker, database and image storage must remain available.

The concurrency setting limits processing jobs; it is not a promise of unlimited provider requests. Provider limits, image support and tool-calling support still apply. Streaming model explanations appear only when returned by the provider; TallyBear does not manufacture a model's reasoning when none is supplied.

对话助手可查询授权账本、分析收支并生成图表或报告。网页关闭后，已提交任务由 worker 继续处理。并发设置控制任务处理数量，仍受模型服务本身的速率限制影响。遇到失败先检查后台任务中的错误，再决定是否重试。

## Images / 图片保存

Receipt vouchers are optional. Extra transaction photos are separate from OCR inputs and can be attached without recognition. The server compresses supported images for storage; long-image recognition also prepares suitable model inputs. Higher resolution does not mean lossless storage. Keep source originals separately when exact archival fidelity matters.

原始凭证与额外生活照片可以分别选择是否保留。保存会进行压缩；识别所需的切片与压缩图不代表原始上传文件被无损归档。对档案保真有要求时，请自行保留原文件。
