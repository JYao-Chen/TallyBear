# Using TallyBear / 使用指南

## Start with the structure / 先设置账户关系

**User → family membership → book permission → funding account.** These represent different things:

- A user signs in independently. A family organizes people and books; joining a family does not mean every private book becomes public.
- A book defines a recording and reporting scope. Owners manage access; editors record transactions; viewers read permitted records.
- A funding account records where money moved. Personal/shared ownership is separate from whether a book is shared.
- The same funding account can pay entries in different books. Book assignment changes the reporting view, not account ownership.

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

Open Bear assistant (or AI assistant in the minimal theme) to ask about authorized data. Choose the current book, selected books or all accessible books. Queries use ledger tools and can produce interactive charts and saved reports. Click a supported chart category/time point to inspect matching entries. Asset scope describes wallet ownership; a difference from a book total is not itself a missing transaction. Recognition and chat run through durable jobs; closing a tab does not cancel them. The background worker, database and image storage must remain available.

The concurrency setting limits processing jobs; it is not a promise of unlimited provider requests. Provider limits, image support and tool-calling support still apply. Streaming model explanations appear only when returned by the provider; TallyBear does not manufacture a model's reasoning when none is supplied.

对话输入区可选择当前、多个或全部可访问账本，跨账本分析对关联事件去重。点击支持下钻的图表分类或时间点查看账单明细，分析可以保存成报告。资产按钱包归属统计，与账本范围不同不等于漏记。网页关闭后，已提交任务由 worker 继续处理。并发设置控制任务处理数量，仍受模型服务本身的速率限制影响。遇到失败先检查后台任务中的错误，再决定是否重试。

## Images / 图片保存

Receipt vouchers are optional. Extra transaction photos are separate from OCR inputs and can be attached without recognition. The server compresses supported images for storage; long-image recognition also prepares suitable model inputs. Higher resolution does not mean lossless storage. Keep source originals separately when exact archival fidelity matters.

原始凭证与额外生活照片可以分别选择是否保留。保存会进行压缩；识别所需的切片与压缩图不代表原始上传文件被无损归档。对档案保真有要求时，请自行保留原文件。

## Category order and moving records / 分类排序与账单移动

In **Book settings**, use **Reorder** to drag categories or move them with the arrow buttons, then save the order. Each category card has a delete action. Existing transactions keep their category label.

Open a saved transaction and choose **Move to book**. Select the destination book; the original funding account is preserved. The original purchase and linked refunds move together, including items, vouchers, photos and allocation settings. The operation removes the records from the source book; use **Record in another book too** to keep them in both. Recurring plans retain their original book settings.

在 **账本设置** 点击 **调整顺序**，拖动分类或使用前后箭头，完成后保存顺序。分类卡片可直接删除；历史账目保留原分类名称。

打开已保存账单，点击 **移动到账本**，选择目标账本，保留原来的实际付款账户。原消费和关联退款、商品明细、凭证、附图及分摊设置一起移动。移动后原账本不再保留该记录；若需要两本都保留，使用 **同时记入另一本账本**。周期计划继续使用原账本设置。

## Conversational actions / 对话确认卡片

Describe a purchase, subscription, preset, budget, allocation, installment or family transfer in the assistant. Add images through the attachment button. The assistant reads the evidence, looks up available entities and prepares a card. Edit the fields on the card or reply in conversation; then press **Confirm** to save. A reply alone does not press the confirmation button. Cards remain with the turn that created them.

用自然语言描述记账需求，附件按钮可添加图片。助手先准备卡片；缺少的钱包、分类、金额等可以直接在卡片中补充，商品明细可以增删改，也可以继续对话修改。点击确认才执行保存，卡片保留在生成它的对话轮次。

## Family transfers and personal books / 家庭往来与个人账本

1. Open **Record → Family transfers**, or describe the movement in the assistant.
2. Choose a purpose: transfer, gift, AA settlement, loan, loan repayment or shared-wallet contribution.
3. The sender selects their own wallet and the recipient, plus their personal display book. Shared contributions select the common wallet instead of a recipient.
4. For a member-to-member payment, the recipient selects their actual receiving wallet and personal display book when confirming receipt. These choices are private to each participant.
5. After confirmation the movement updates balances once. Find it in family history and each selected personal book's fund-movement section; it is excluded from income/expense totals.

在 **记一笔 → 家庭往来** 手动操作，或点击 **用 AI 记往来** 描述并上传截图。付款方选自己的钱包及收款人；收款方确认时选实际到账钱包，可以是微信、支付宝或银行卡。双方独立选择个人展示账本，系统记住默认值。选择“仅家庭往来”则不在个人账本展示。

**AA:** the original payer records the merchant expense once in the appropriate book, then assigns member shares that sum to the expense. Each member settles their share against that expense. The settlement is an internal transfer, not another rent or meal expense.

**Loans:** link repayments to the confirmed loan; partial repayments reduce the outstanding amount. **Shared contributions:** move money from a personal wallet into the common wallet; later purchases are recorded as expenses when paid to the merchant.

房租示例：一二给布布 1500 元是转账，布布给房东 3000 元才是房租支出。两人各给共同小荷包转入 500 元也属于内部转账；小荷包支付商家时再记消费。

Use **Display book** to assign older movements, change your display book, or remove only your display link. The movement and counterpart's view remain intact. Known payment references and similar transfers are checked; if the same receipt is received from both sides, use the existing pending movement instead of creating a second one. If no sender record exists yet, ask the sender to register it first.

通过“展示账本”补选旧记录、移动自己的展示位置或取消展示，不改变资金余额或对方记录。对同一转账的付款截图与收款截图，优先匹配已有待收款记录；付款方尚未登记时，先由付款方发起。

## Installments and repayments / 分期与还款

Use a credit/BNPL account for the purchase, record the expense once, and create a plan from it. Record actual partial or early payments against the plan. Principal is a transfer; explicit interest/fees are expenses. Plans can update future terms or reverse a mistaken repayment. Cost allocation is configured separately and does not change the debt balance.

购买时记消费、建立分期，之后记录实际还款。本金只减少负债，利息手续费另计支出；支持部分还款、提前结清与撤销误记还款。费用分摊独立配置，提前还清不代表费用覆盖期结束。

## Presets and consistent descriptions / 常用一笔与统一格式

Create a quick-entry preset from the entry workspace for fixed transit fares, everyday purchases or income. Scene fields keep stops, merchants, branches and product summaries consistent across presets, manual entry and AI cards. Optional history matching retrieves related examples to assist classification; current amounts and routes come from the current input.

在“常用一笔”新增、管理固定消费或收入预设；使用时可以再修改。交通、餐饮、购物和买菜共用场景字段。开启相关记账习惯参考后，用相关样例辅助分类与表达，本次金额和路线以本次提供的信息为准。
