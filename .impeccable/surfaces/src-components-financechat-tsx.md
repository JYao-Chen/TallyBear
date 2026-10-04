---
version: 1
slug: "src-components-financechat-tsx"
primary_target: "src/components/FinanceChat.tsx"
related_targets: ["src/components/ChatActionEditor.tsx","src/components/ChatActionCards.tsx","src/components/PersonalProfile.tsx","src/components/VisualSelect.tsx"]
---

# Unified assistant and destination-book rules extension

## Scope and authority

Mode: Operate. This brief records the existing assistant's unified book access, destination-book editing, and the related explicit profile rule. `PRODUCT.md`, the incumbent root `DESIGN.md`, and the personal-profile design documentation remain authoritative. The implementation is code-led and reviewed through rendered screens; there is no approved visual comp. This extension establishes no new identity, palette, imagery, typography, or global composition rule.

## Assistant and action order

Keep the familiar conversation, report library, readable answers, action cards, and composer. The assistant no longer asks users to choose a manual search scope. Switching the workspace book preserves the open conversation and its turns rather than starting a new conversation. Available data and writable destinations still follow the user's actual book permissions.

An action card keeps its destination visible. Editing an entry, template, schedule, or budget exposes the labeled “记入账本” / “Destination book” selector before the remaining action fields. Offer writable books through the existing `VisualSelect`, using the familiar book names and icons. Changing the destination reloads its available wallets and other editor options. “更新卡片” / “Update card” stays disabled until the loaded options belong to the selected destination. Updating the card prepares the revised action; the existing explicit confirmation remains the step that saves the bookkeeping operation.

## Explicit destination rule

Within Personal profile → Habits & rules, the rule editor includes “记入账本” / “Destination book” as a preference field. Its value selector shows the available book names rather than asking for a raw identifier. Preserve the existing matching conditions, rule state, edit/delete actions, and explanatory hierarchy: explicit rules take priority over learned habits, while current input takes priority over rules. This field extends the incumbent rule form and does not add a separate settings page.

## Visual and responsive treatment

Preserve the incumbent cream canvas, warm paper panels, warm ink, muted supporting copy, and green profile/action cues, along with existing theme behavior and title/body fonts. Reuse labeled controls and their established focus, selected, disabled, and error states. Book selection opens through the existing picker pattern: dialog on desktop and bottom sheet on mobile, with its existing close and dismissal behavior.

On mobile, put the action-card status badge on its own row before the title and supporting destination line. Give the heading the card's available width so English words wrap naturally rather than being compressed by a badge beside them. Retain the title's ordinary readable word wrapping and the existing mobile card/editor spacing. This is a local card-header adjustment, not a new application-wide heading rule.

## Evidence and disposition

Source: the component targets listed above and their incumbent styles. Ground truth: `/home/yao/artifacts/tallybear/assistant-books-20261004/screenshots/manifest.json`, containing (20) synthetic-data captures across Chinese/English, desktop (1440 × 1000), and mobile (390 × 844). Each language/device combination covers the unified assistant, destination editor, book choices, updated card, and profile destination rule. The captures use seeded assistant/OCR drafts without live model calls; their names and amounts are layout evidence rather than product defaults.

The detector returned an empty finding list once. Full visual review identified one issue: the English mobile action-card title was compressed by the adjacent status badge. The separate badge row resolved it, and the final review disposition was ship. These captures establish the reviewed layouts, not an assertion that every physical device or live-model outcome has been tested. The root design document and global sidecar remain unchanged because this extension introduces no new system tokens or primitives.
