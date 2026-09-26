# Using TallyBear / 使用指南

## Start with the structure / 先设置账户关系

**User → family membership → book permission → funding account.** These represent different things:

- A user signs in independently. A family organizes people and books; joining a family does not mean every private book becomes public.
- A book defines a recording and reporting scope. Owners manage access; editors record transactions; viewers read permitted records.
- A funding account records where money moved. Personal/shared ownership is separate from whether a book is shared.
- The same funding account can pay entries in different books. Book assignment changes the reporting view, not account ownership.

用户独立登录；家庭组织成员和账本；账本决定记录与统计范围；资金账户说明钱实际从哪里来、到哪里去。个人账户可以支付公账消费，共享账本不会自动把付款钱包变成家庭共有。不要把不同人的支付宝或银行卡关联为同一个钱包。

Account actions are available from the profile/navigation area. On mobile, open the navigation drawer and choose **Sign out**; TallyBear flushes pending local draft changes before ending the current session. / 账户相关操作位于个人资料与导航区域。手机端打开导航抽屉即可直接选择 **退出登录**；系统会先尝试同步当前本地草稿，再结束会话。

## Receipt workflow / 账单识别流程

1. Open Record and choose AI text/screenshots. Upload one or several images; overlapping screenshots and long receipts are supported.
2. The worker extracts candidate orders, combines complementary evidence and checks item totals. Possible duplicates and unresolved differences stay reviewable.
3. Check merchant/title, payment date, paid total, category and line items. Explicit fees are positive; checkout discounts are negative. Unknown item amounts remain unknown.
4. Check the actual funding account. Explicit balance/bank/suffix evidence can preselect one owned wallet. A visible WeChat/Alipay payment channel selects automatically only when exactly one matching personal wallet exists; several candidates remain unselected. OCR does not require a wallet to prepare a draft.
5. Resolve duplicate suggestions and refund links. Choose whether to retain receipt vouchers, then confirm saving.

上传图片后先生成草稿，不会因为识别完成就自动扣款或转账。一个订单可以保留多个商品明细，但整单实付只记一次。原图编号用于跨图关联与核对，不等于资金来源。明确的余额、银行卡或尾号证据可预选唯一的本人钱包；仅看到微信／支付宝渠道时，只有一个匹配钱包才自动选择，多个候选不猜。票面不足时可以手动补充，不应编造折扣来强行配平。

Order IDs and payment/refund reference IDs are optional in manual entry and review cards. When legible in an image, recognition can fill them automatically. Keep them for later duplicate checks or statement reconciliation; do not invent an ID when a screenshot does not show one. / 手动记账和识图草稿中的**订单号**、**交易／退款流水号**均为选填；截图清晰可见时可自动提取。它们有助于以后查重和账单核对；截图没有展示时不必补造编号。

## Refunds and reused entries / 退款与复用

A received refund reduces spending and can link to the original purchase. An application for a refund is not money received. Keep the original purchase and refund as separate dated records.

Use “Record in another book too” to preserve the shared event identity. Cross-book totals deduplicate linked copies. Separately typing the same purchase twice does not establish that link. Linked amount/date edits affect associated entries; book-specific notes/categories remain local. Removing one book's copy does not erase the whole event from every book.

退款到账才记退款；退款申请中不当作收入。通过“同时记入另一本账本”复用，系统才有可靠的关联用于跨账本去重。独立重复录入的两笔记录需要另行核对。

在 **记一笔 → 手动记账 → 退款 → 关联原消费** 打开统一搜索。默认查询全部可访问账本，支持标题、商家、商品明细、分类、备注、订单号、流水号、日期和金额，也可按账本、日期区间、金额区间筛选；空格分隔的关键词须全部命中，结果分页展示。选择后自动填入标题、商家、商品摘要、分类、平台、原订单号和可用钱包；请核对实际到账钱包，本次退款日期、金额和退款流水号保持独立。跨账本选择会把退款记入原单所在账本，不搬动原消费。支持多次退款及返现，累计可超过原支付；目标净支出允许输入负数。退款按到账日冲减支出，钱包增加实际到账金额。

### Repeat purchases / 复购记忆

默认分类现为 31 类（包含工资、奖金及其他）。新增零食水果、日用百货、数码家电、美容个护、通信网络、住宿、运动健身、宠物、母婴育儿、保险、手续费；已有用户也可使用，个人自定义图标、停用及删除选择保留。餐饮包含外卖，健身会员归运动健身，数字服务会员归会员订阅。旅行中的餐饮、交通、住宿按用途分类，再用活动账汇总；无法拆清的旅游套餐仍可归旅行。不会批量改动历史账单。AI 分类指引已同步，但历史分类习惯仍可能影响建议，确认前可调整并让系统学习。

会员服务使用 **会员订阅** 分类，例如 ChatGPT、iCloud、视频／音乐会员和软件订阅。该默认分类也适用于已有用户。AI 识别和助手会优先将明确的会员费用归入此类，不因旧记录属于娱乐／购物而改回旧分类；仍尊重手动指定的分类。不会自动修改历史账单，也不会仅因识别到订阅就创建周期扣款计划。

开启 **使用我的分类与复购习惯** 后，图片／文字识别和助手录入会从本人最近 2,000 条已确认、去重且仍可访问的历史交易中匹配同款。商家和商品名称／明细一致时复用规范名称、分类和缺失的稳定信息；只有店名、名称冲突或无法区分的候选不会强行匹配。当前图片／描述中的价格、日期、数量、订单号和流水号不被旧值覆盖。该匹配不是无限制的语义搜索；无法确认的不同叫法不强行关联。无需点击“再买一笔”入口，匹配和填充在 AI 识别／助手准备记账卡片时自动完成，确认前仍可修改信息或取消同款关联。未提供的新价格／数量保持待填写，不拿旧价格冒充。

明确识别为外卖的订单使用所购菜品／饮品作为标题，店名单独保留；堂食继续用店名标题。只有美团等平台名不代表一定是外卖，场景中的“就餐方式”可手动修正。

全局搜索的订单详情里点击 **查看同款购买**，可跨账本查看从关联建立起的同款记录及支出、退款和净支出汇总；不会按同款去重真实的多次购买。旧记录不会被批量重命名或自动归并。

Refunds and repeat-purchase selection share global search across accessible books. Multiple refunds/cashback can exceed the original payment. Repeat matching uses confirmed personal history without copying old payment identifiers or prices; food delivery uses food-led titles. All suggested fields remain editable.

## Cost allocation / 周期分摊

Record the actual payment first, then configure its coverage period. The allocation view distributes integer minor units over the selected days/weeks/months/years. Remainders are assigned without losing a cent. It does not manufacture extra payments or change the actual account balance. Recurring schedules and allocation are distinct: a schedule concerns future due dates; allocation describes the cost coverage of a payment.

先记录一次实际付款，再设置费用覆盖的起始日期与周期。分摊展示每月承担多少费用，不重复生成付款、不改变真实余额。“周期账单”管理何时应付款，“费用分摊”管理已经付款的费用覆盖多久。

## Assistant and background work / 助手与后台任务

Open Bear assistant (or AI assistant in the minimal theme) to ask about authorized data. Choose the current book, selected books or all accessible books. Queries use ledger tools and can produce interactive charts and saved reports. Click a supported chart category/time point to inspect matching entries. Asset scope describes wallet ownership; a difference from a book total is not itself a missing transaction. Recognition and chat run through durable jobs; closing a tab does not cancel them. The background worker, database and image storage must remain available.

The concurrency setting limits processing jobs; it is not a promise of unlimited provider requests. Provider limits, image support and tool-calling support still apply. Streaming model explanations appear only when returned by the provider; TallyBear does not manufacture a model's reasoning when none is supplied.

对话输入区可选择当前、多个或全部可访问账本，跨账本分析对关联事件去重。点击支持下钻的图表分类或时间点查看账单明细，分析可以保存成报告。资产按钱包归属统计，与账本范围不同不等于漏记。网页关闭后，已提交任务由 worker 继续处理。并发设置控制任务处理数量，仍受模型服务本身的速率限制影响。遇到失败先检查后台任务中的错误，再决定是否重试。

## Unified analysis and records / 收支分析与明细合并

Open **Spending analysis** for both charts and records. The record filters below the charts—date range, type, wallet, category and keyword—update the totals and charts as well as the paginated list. CSV export uses the same result set. Switch from **Current book** to **My personal wallets** to aggregate your own wallets across books; there is no separate Records navigation entry.

This scope follows money through accounts, not book membership:

- It includes only personal wallets owned by the signed-in user, across all books. Family/shared wallets and other members' wallets are excluded.
- One event reused in several books is counted once. Moving an entry between books does not change its funding wallet.
- Income, expenses and received refunds affect cash flow; transfers are shown as transfers and do not become income or spending. Credit purchases and repayments keep the debt semantics described below.
- Current balances include archived personal wallets. Date filters control period flows, not a reconstructed historical closing balance.

进入 **收支分析** 即可同时使用图表和明细。下方的日期、类型、钱包、分类与关键词筛选会同步更新汇总、图表、分页明细和 CSV 导出结果；无需再进入单独的“收支明细”。把范围从 **当前账本** 切换到 **我的个人钱包**，即可跨全部账本查看本人钱包的真实资金收支。这一范围只认当前用户本人持有的个人钱包，排除家庭共同钱包与其他成员钱包；关联复用到多本账本的同一事件只计算一次。转账会展示但不计入收支，退款冲减支出。当前余额包含已归档的本人钱包；日期范围用于期间流水，不代表历史期末余额。

In **Assets**, choose **My assets** or a family asset scope. Balance distribution, daily spending, daily income and category charts use the selected wallet ownership scope and date range; the wallet cash-flow table remains available below. Family scope includes only that family's shared wallets, not members' personal wallets. / 在 **资金资产** 中选择“我的资产”或某个家庭资产范围，余额分布、每日支出、每日收入和分类图表会按所选钱包归属及日期统计，下方仍保留钱包收支表。家庭范围只包含该家庭的共同钱包，不会混入成员个人钱包。

## Activities across books / 跨账本活动账

Open **Activities → Create activity** for a trip, gathering or other event. Choose a name and type, optionally set dates and a budget, and decide whether it is personal or attached to a family. The type can be your own text, not just a preset. An activity is a grouping of existing transactions, not a book or wallet: each entry stays in its original book and keeps its original funding account.

To record into an active activity, use **Home → Active activities → Add an entry to this activity**, select the activity in manual entry or receipt review, or add an existing transaction from its activity detail. Linked copies of the same event are counted once. Family members can contribute from books they may edit; another member's private book does not become visible merely because the activity belongs to a family. Activity totals can therefore differ between members.

Search the activity list by name, type, family or description; filter by type and ownership. The activity detail shows category, wallet, book and daily breakdowns plus filtered, searchable, paginated transactions. **Archived activities** have a separate view: old entries remain readable, but new entries require **Reactivate** first. The creator or family owner can edit, archive, reactivate or delete. Deletion removes activity links only; it never deletes the underlying transactions. The assistant can look up activities and propose a transaction with an activity selected, but does not create, archive or delete activities on its own.

在 **活动账 → 创建活动** 中填写活动名称、可自定义的类型，以及可选的日期和预算；归属可以选个人或某个家庭。活动不是新的账本或钱包，只是对原交易的归集，原账本、付款账户及余额都不变。

要把支出记入进行中的活动，可从 **首页 → 记一笔到活动** 进入，也可在手动记账、识图草稿中选择活动，或在活动详情里 **加入已有交易**。同一关联交易复用到多本账本时只统计一次。家庭活动允许成员从其有权编辑的账本参与；活动挂到家庭不会让其他成员自动看到私人账本，所以不同成员的可见合计可能不同。

列表支持名称、类型、家庭和说明搜索，以及类型、归属筛选；详情有分类、付款钱包、账本、每日支出图表和可搜索分页明细。**归档活动**在独立视图查看，旧记录仍可阅读，重新启用前不能加入新账目。创建者或家庭负责人可编辑、归档、重新启用、删除活动；删除仅解除活动关联，不删除原交易。助手可查询活动并准备指定活动的交易确认卡，不会自行创建或删除活动。

## Statement reconciliation / 智能核对账单

From **Analysis → Reconcile statements**, the assistant opens with a prepared request. Attach payment-statement screenshots and send the message; the shortcut does not automatically attach images. For each batch, the assistant compares visible reference IDs, order IDs and exact times first, then transaction order and neighboring entries. It can flag possible missing or duplicate entries, but matching remains evidence-dependent and is not an automatic proof that two same-price charges are identical. Review any proposed edit or new entry before confirming it.

在 **收支分析 → 智能核对账单** 点击快捷入口后，仍需把支付账单截图附到助手对话并发送；按钮本身不会代替上传。助手优先比对流水号、订单号和精确时间，再结合前后顺序与相邻交易分析可能漏记、重复记账。相同名称和金额不等于同一笔，结果仍需人工核实；任何新增或修改都要确认卡片后才入账。

## Personal category learning / 个人分类习惯学习

**Use my category habits** is enabled by default for new receipt drafts and assistant conversations and can be turned off from the input options. The matcher runs on the TallyBear server; personal history is not appended to the model prompt.

The evidence and decision rules are:

- Only the current user's confirmed entries, saved presets and later category corrections across books they can access participate. Another member's habits in a shared book do not become this user's habits.
- Transfers and refunds are not auto-classified. WeChat and Alipay are payment channels, not merchant identities.
- Exact transport routes are strongest context; merchant plus item/product context separates multipurpose stores; merchant-only and similar-scene matches are fallback levels.
- Presets and direct corrections carry more weight than routine confirmations. Recent evidence carries more weight than old evidence.
- The top category must have enough support and a clear margin. Weak or conflicting history leaves the recognizer/model category unchanged. A category explicitly chosen by the user is never overridden.

When a suggestion is applied, the review card shows its basis, match confidence and personal evidence count. Selecting a different category marks a correction; it receives priority only after the card is saved. Changing the merchant, items, scene or transaction type clears a stale explanation. There is currently no separate learning-record administration page: correct habits from the normal review card, or disable the option for a run.

“使用我的分类习惯”对新的识图草稿和助手对话默认开启，也可在输入选项中关闭。匹配完全在 TallyBear 服务端进行，不会把个人历史拼接进模型提示词。系统只学习当前用户本人确认过的记录、常用预设和后续分类修正；共享账本中其他成员的习惯不会混入。路线、商家、商品／明细和消费场景按层次匹配，预设与主动纠正权重更高，旧证据会衰减；支持不足或分类冲突时不覆盖模型结果，用户明确指定的分类永远优先。草稿会展示依据、匹配度与个人证据数量；改分类并保存后才形成高权重纠正。目前没有单独的学习记录管理页，日常在确认卡片中纠正，或按次关闭该选项。

[Detailed matching and feedback design / 详细匹配与反馈设计](category-learning.md)

## AI model scopes / AI 模型配置范围

Administrators configure two independent OpenAI-compatible scopes in **Book settings**:

| Scope | Uses |
|---|---|
| Receipt recognition | Quick receipt text/images, OCR extraction, cross-image merge, amount verification and recognition connection tests |
| AI assistant | Assistant chat, tool decisions, images attached in chat, receipt reading initiated by the assistant, delegated/nested assistant calls and assistant connection tests |

Each scope stores its own base URL, API key, text model and vision model. Configure a tool-calling/streaming text model for the assistant and an image-capable vision model for every scope that receives images. The shared queue concurrency controls background jobs but does not merge the model settings.

管理员在 **账本设置** 中分别配置 **账单识别模型** 和 **AI 助手模型**。快速识图、跨图归并与金额复核走识别配置；助手文字对话、助手附件图片、由助手发起的账单读取及内部委派调用全部走助手配置。两套配置各自保存服务地址、API Key、文字模型和视觉模型，连接测试也分别执行；后台队列并发为共用设置，但不会混用模型。

## Images / 图片保存

Receipt vouchers are optional. Extra transaction photos are separate from OCR inputs and can be attached without recognition. The server compresses supported images for storage; long-image recognition also prepares suitable model inputs. Higher resolution does not mean lossless storage. Keep source originals separately when exact archival fidelity matters.

原始凭证与额外生活照片可以分别选择是否保留。保存会进行压缩；识别所需的切片与压缩图不代表原始上传文件被无损归档。对档案保真有要求时，请自行保留原文件。

## Category order and moving records / 分类排序与账单移动

In **Book settings**, use **Reorder** to drag categories or move them with the arrow buttons, then save the order. Categories belong to your user account and the same catalogue is available in every book, including read-only shared books; another member's catalogue remains independent. Each category card has a delete action. Existing transactions keep their category label.

Open a saved transaction and choose **Move to book**. Select the destination book; the original funding account is preserved. The original purchase and linked refunds move together, including items, vouchers, photos and allocation settings. The operation removes the records from the source book; use **Record in another book too** to keep them in both. Recurring plans retain their original book settings.

在 **账本设置** 点击 **调整顺序**，拖动分类或使用前后箭头，完成后保存顺序。分类属于当前用户账号，在所有个人／共享账本中使用同一套；即使当前共享账本是只读，也可以管理自己的分类，其他成员的分类互不影响。分类卡片可直接删除；历史账目保留原分类名称。

Growing record, search, category, wallet, family, schedule and history views use page controls instead of extending indefinitely. Changing filters returns a list to its first page. / 收支明细、搜索、分类、钱包、家庭、计划和历史记录等增长型列表使用分页控件，不再无限延长页面；切换筛选条件后会回到第一页。

打开已保存账单，点击 **移动到账本**，选择目标账本，保留原来的实际付款账户。原消费和关联退款、商品明细、凭证、附图及分摊设置一起移动。移动后原账本不再保留该记录；若需要两本都保留，使用 **同时记入另一本账本**。周期计划继续使用原账本设置。

## Conversational actions / 对话确认卡片

Describe a purchase, subscription, preset, budget, allocation, installment or family transfer in the assistant. Add images through the attachment button. The assistant reads the evidence, looks up available entities and prepares a card. Edit the fields on the card or reply in conversation; then press **Confirm** to save. A reply alone does not press the confirmation button. Cards remain with the turn that created them.

用自然语言描述记账需求，附件按钮可添加图片。助手先准备卡片；缺少的钱包、分类、金额等可以直接在卡片中补充，商品明细可以增删改，也可以继续对话修改。点击确认才执行保存，卡片保留在生成它的对话轮次。

## Family transfers and personal books / 家庭往来与个人账本

1. Open **Record → Family transfers**, or describe the movement in the assistant.
2. Choose a purpose: transfer, gift, AA settlement, loan, loan repayment or shared-wallet contribution.
3. The sender selects their own wallet and the recipient, plus their personal display book. Shared contributions select the common wallet instead of a recipient.
4. For a member-to-member payment, the recipient selects their actual receiving wallet and personal display book when confirming receipt. These choices are private to each participant.
5. After confirmation the movement updates balances once. Find it in family history and each selected personal book’s daily records. Gifts count as personal income/expenses; household consolidation eliminates them. Other internal movements remain transfers.

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

Create a quick-entry preset from the entry workspace for fixed transit fares, everyday purchases or income. Scene fields keep stops, merchants, branches and product summaries consistent across presets, manual entry and AI cards. When personal category habits are enabled, presets act as strong personal evidence; current amounts, merchants, items and routes still come from the current input.

在“常用一笔”新增、管理固定消费或收入预设；使用时可以再修改。交通、餐饮、购物和买菜共用场景字段。开启个人分类习惯后，常用预设会作为高权重的本人分类证据；本次金额、商家、商品和路线仍以本次输入为准。

### Gift statistics and home receipt confirmation / 红包统计与首页收款

红包赠与确认后，在双方选择的个人账本日常流水中分别计为支出和收入，个人资产统计也采用同样口径。家庭合并视角抵消内部收支；借还款、AA 结算、共同钱包入金不当作消费。首页“待收款”显示所有家庭待确认转账，不受当前账本和月份限制；收款人直接选择自己的到账钱包与个人账本确认。

Confirmed gifts appear as personal expenses and income in each participant’s selected book and personal wallet reports. Household consolidation excludes internal income and expenses. Loans, repayments, AA settlements and shared-wallet contributions are not consumption. The home inbox shows pending receipts across families, independently of the current book or month; recipients select their own wallet and personal book there.
