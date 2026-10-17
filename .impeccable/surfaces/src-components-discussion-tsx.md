---
version: 1
slug: "src-components-discussion-tsx"
primary_target: "src/components/Discussion.tsx"
related_targets: ["src/components/DiscussionInbox.tsx","src/components/discussion.css","src/components/FamilyMovementDetails.tsx","src/components/ChartTransactionDetail.tsx","src/components/CostProjects.tsx","src/components/CostSchedules.tsx","src/components/Workspace.tsx"]
---

# Account discussion extension

## Scope and authority

Mode: Operate. Personal and household members discuss an existing transfer, shared-book entry, cost project, recurring plan or individual cycle inside its existing detail surface. `PRODUCT.md`, the incumbent `DESIGN.md` and global design sidecar remain authoritative. This code-led extension introduces no new global tokens, imagery, typography or independent chat page.

## Context and reading order

Keep the original record context ahead of the discussion. Show the discussion heading, refresh action and explicit audience names before chronological messages. Transfer discussions identify the sender/recipient audience; shared entries identify members with record access; projects and plans identify participants. Preserve current membership permissions. The original shared transfer note has its own labeled block; private movement notes and attachments remain in their private detail area and are not discussion content.

Messages show author, timestamp, optional single-level quoted reply, body and reply action. Reuse `Avatar` from `ManagementPages` in authors (34px), quoted authors and reply previews (24px), composer identity (30px), and home cards (36px). Identity remains readable beside the avatar; avatar appearance does not imply permissions. Reply selects a quotation and focuses the labeled composer; the preview can be canceled. Plain text preserves line breaks, wraps long content and is limited to 2,000 characters. The send action remains disabled for blank text or while sending. Keep the adjacent explanation that a message does not confirm receipt or change allocations.

## Placement and behavior

Recurring plans retain separate plan and dated cycle discussions, with scope selection and cycle-history entry points. A cycle payment's cost project has its own discussion. Preserve these distinctions in headings, dates and source navigation rather than merging their message histories.

Home Account messages uses the existing inbox row vocabulary, showing author/avatar, source, scope where applicable, unread count and message preview. Viewing opens the existing `Sheet` pattern with an action to open the original record. Discussion pages hold 20 messages and inbox pages five discussions, with visible ranges and navigation. Only viewing the latest page while the discussion section is visible marks its displayed messages read; older pages do not clear newer messages. Visible pages poll every 30 seconds and refresh on focus; local posting/reading refreshes the inbox. Preserve loading, empty, error, refresh and sending states.

## Visual and responsive treatment

Inherit cream surfaces, warm ink, muted supporting text, established buttons, fonts and `Sheet` behavior. A top rule separates discussion from accounting details; light dividers separate flat message rows. Quotes and the original shared note use the existing paper surface, with a restrained left rule for quotes. Avoid chat bubbles, new illustration assets or another visual identity.

On desktop, author/time and composer helper/action share wrapping rows. At 600px and below, stack the helper and full-width send action; stack inbox content and its action. Keep avatars from shrinking, allow names and message text to wrap, and retain horizontal identity alignment in the composer label. Quote text has a bounded scrollable area; home previews use three lines.

## Evidence and disposition

Source: the targets above and `docs/account-discussions.md`. Direction: `/home/yao/artifacts/tallybear/discussions-20261017/direction.md`. Final synthetic-data render evidence: `/home/yao/artifacts/tallybear/discussions-20261017/screenshots`, containing seven desktop and six mobile captures of home, transfers, shared bills, cost projects, allocated costs, cycle scope, composers and preserved private notes. `result.json` records 13 captures, success and no browser/server errors; debug `failure.png` and `failure.txt` are excluded.

The finish reviewer returned ship with no material fixes, including avatar reuse, audience/private-note separation, distinct plan/cycle scopes and desktop/mobile layouts. This is local synthetic-data evidence, not production deployment or physical-device acceptance. No unresolved surface-direction decision was reported. Root design documentation remains unchanged because this is an ordinary extension of the incumbent system.
