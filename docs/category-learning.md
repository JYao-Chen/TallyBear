# Personal category learning / 个人分类习惯学习

TallyBear uses a deterministic server-side recommender after receipt/assistant extraction. The model proposes transaction facts; the recommender may replace only the category when personal evidence is sufficiently clear. It does not send the user's ledger history to the model.

TallyBear 在识图或助手完成结构化提取后，再由服务端确定性算法匹配个人分类。模型负责提出本次账目信息；只有本人历史证据足够明确时，算法才会替换分类。账本历史不会作为模型上下文发送。

## Where it runs / 使用入口

- **Record → AI text/screenshots**: controlled by **Use my category habits**, enabled by default for a new saved draft.
- **AI assistant**: the composer exposes the same option, enabled by default. Direct entry action cards and assistant-initiated receipt reading use the same recommender.
- Manual forms do not need a pre-save recommendation, but their saved categories become personal evidence.

识图草稿和 AI 助手确认卡片共用同一算法。手动表单不在保存前自动改分类，但成功保存后的选择会成为本人证据。

## Eligible evidence / 可参与学习的数据

The server reads up to 2,000 recent, deduplicated transaction items for the signed-in user, plus their saved presets:

1. Saved quick-entry presets owned by the user.
2. Explicit corrections previously saved by the user.
3. Categories manually selected and saved by the user.
4. Suggested/model categories confirmed and saved by the user.
5. Older transactions created by the user before feedback tracking existed.

Evidence may come from books the user can access, but another member's feedback does not become this user's preference. Linked copies use `COALESCE(event_id, id)` and contribute once. Deleted entries, transfers and refunds are excluded. Only categories active in the user's personal catalogue can be suggested; that catalogue is shared across all of the user's books.

服务端最多读取当前用户最近 2,000 条去重交易证据，并额外读取本人常用预设；证据依次包括常用预设、本人纠正、本人手动分类、本人确认的建议，以及反馈表上线前由本人创建的旧账。证据可以跨本人可访问账本，但共享账本中其他成员的修改不会变成本人的习惯。关联复用记录按 `event_id` 去重；已删除账目、转账、退款不参与，目标分类必须仍在本人的个人分类库中启用；该分类库在本人所有账本中通用。

## Matching hierarchy / 匹配层级

The first available level is used:

1. **Exact route**: transport type, origin and destination.
2. **Merchant + context**: the same normalized merchant with at least two evidence items whose product/title/item tokens have similarity of at least `0.35`.
3. **Merchant**: same normalized payee or structured scene merchant.
4. **Context**: similar product/title/item tokens within the same scene type.

Merchant normalization ignores spacing and common punctuation. Product context uses Latin/alphanumeric words plus Chinese terms and two-character fragments. WeChat, WeChat Pay and Alipay are excluded from merchant identity because they are payment channels. A multipurpose merchant can therefore learn different categories when item context supplies enough evidence.

算法依次尝试：完全一致的交通路线、同商家与商品上下文、同商家、同场景相似商品。商家会去除空格和常见标点；商品上下文使用英文／数字词、中文词及中文二元片段。微信、微信支付和支付宝只属于支付渠道，不当作商家。对超市、电商等多用途商家，商品上下文有足够证据时可以学习多个不同分类。

## Weighting and acceptance / 权重与采纳门槛

Base evidence weights are:

| Evidence | Weight |
|---|---:|
| Saved preset | 6.0 |
| Saved correction | 4.0 |
| Manual category | 2.5 |
| Confirmed suggestion/model category | 1.5 |
| Legacy created transaction | 1.0 |

Weights are multiplied by semantic similarity and recency. Recency has a one-year half-life with a floor of `0.35`, so old habits remain available without dominating recent corrections.

The leading category is accepted only when one of these conditions holds:

- the leading category includes preset/correction evidence and has at least `67%` of the matching weight;
- at least three supporting items have at least `72%` share and a `30%` lead over second place; or
- at least two supporting items have at least `85%` share and a `50%` lead.

Otherwise the existing recognizer/assistant category remains unchanged. Explicit user categories, transfers and refunds bypass recommendation entirely. Confidence shown in the UI is an explanation of the accepted evidence, not a promise that the category is objectively correct.

基础权重依次为：常用预设 6、保存后的纠正 4、手动分类 2.5、确认的模型／建议分类 1.5、旧账 1。权重再乘以语义相似度和时间衰减；时间半衰期为一年，最低保留 0.35。只有强证据占比达到 67%，或多条普通证据同时达到数量、占比和领先幅度门槛时才采纳，否则保留原分类。用户明确分类、转账和退款完全跳过推荐。前端匹配度用于解释证据强弱，不代表客观正确率。

## Feedback lifecycle / 反馈闭环

`category_feedback` stores the category proposed at review time, the original category, final saved category, evidence basis/count/confidence, source and whether the user corrected it. Feedback is written only inside the successful transaction save/update path. Renaming a category updates feedback labels; moving an entry updates its feedback book reference; deleting an entry removes it from active evidence.

Review cards show:

- the selected personal-habit category;
- basis such as route, merchant + items, merchant or similar context;
- confidence and supporting-record count;
- a correction notice when the user selects another category.

Changing merchant, product/items, scene or transaction type clears a stale suggestion explanation. A saved correction receives higher weight on the next matching entry.

`category_feedback` 在成功保存／更新账目的同一事务内记录建议分类、原分类、最终分类、证据依据／数量／匹配度、来源及是否纠正。分类改名会同步反馈标签，移动账目会同步账本引用，删除账目后不再参与学习。草稿展示建议、依据、匹配度和证据数量；修改商家、商品／明细、场景或收支类型会清除已经过期的说明，修改分类并保存后则形成更高权重纠正。

## Current controls and limits / 当前控制与边界

- The option can be disabled per recognition/assistant run.
- There is no separate learning-record administration page yet. Users correct the normal review card; database operators can inspect `category_feedback` if needed.
- The recommender learns categories only. It does not copy amounts, dates, wallets, order IDs or other financial facts from history.
- It is intentionally conservative: unfamiliar or conflicting activity may keep the model category until enough personal evidence exists.

当前可以按次关闭分类习惯，但没有单独的学习记录管理页；日常纠正直接在确认卡片完成。算法只学习分类，不会从历史复制金额、日期、钱包、订单号等本次财务事实。陌生或冲突场景可能继续保留模型分类，这是为了避免少量历史造成稳定误判。

## Repeat-purchase enrichment / 同款信息复用

The same history toggle also enables conservative product matching before category suggestions. Confirmed personal transaction evidence (not preset IDs) supplies stable product names and a repeat-purchase group stored in `scene.purchaseGroup`. Exact normalized item names or product summaries identify candidates; merchant conflicts or ambiguous names prevent automatic fill. Current payment amounts, dates, IDs and visible item prices are preserved. Matching and filling run automatically during AI recognition and assistant entry preparation, without a separate buy-again entry point. Ambiguous names remain unlinked; users can edit the result or cancel the association before saving. History stays server-side; no extra model call is introduced. Grouping does not merge payments or change wallet totals. Delivery titles use actual food/drink names; dine-in uses merchant-led titles.

同款匹配先于分类建议；同款明确且用户未明确指定分类时可沿用该记录分类。分类习惯的通用权重规则仍适用于非同款场景。取消同款关联或关闭历史开关可停止复用；修改后的已确认记录会成为后续匹配依据。只归组新关联记录与选中的历史原单，不批量追溯归并旧账。
