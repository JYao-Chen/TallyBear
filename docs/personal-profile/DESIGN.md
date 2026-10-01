---
name: TallyBear Personal Profile
description: The implemented private profile surface in TallyBear's warm cream and green theme.
colors:
  paper: "#faf7f2"
  surface: "#fffdfa"
  ink: "#453d38"
  muted: "#776c64"
  line: "#e9e1d8"
  accent: "#365f58"
  soft: "#eaf0eb"
  changed-ink: "#81602e"
  changed-surface: "#f5eddc"
  button-hover: "#665078"
  white: "#ffffff"
typography:
  headline:
    fontFamily: "'LXGW WenKai', 'PingFang SC', sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Geist, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "14px"
  insight-value:
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
  context:
    fontSize: "11px"
    lineHeight: 1.6
  navigation:
    fontSize: "13px"
  state:
    fontSize: "11px"
rounded:
  state: "4px"
  input: "9px"
  control: "10px"
  insight: "16px"
  companion: "20px"
  summary-detail: "16px"
spacing:
  filter-gap: "12px"
  insight-gap: "12px"
  insight-padding: "21px"
  detail-padding: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.button-hover}"
  button-secondary:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "9px 7px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "11px 13px"
  section-navigation:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.navigation}"
    padding: "14px 2px 13px"
  state:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.accent}"
    typography: "{typography.state}"
    rounded: "{rounded.state}"
    padding: "3px 7px"
  insight:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.insight}"
    padding: "21px"
  summary:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.companion}"
    padding: "30px 30px 34px"
---

# Design System: TallyBear Personal Profile

## Overview

**Creative North Star: "TallyBear's warm cream and green profile"**

The private profile uses the existing TallyBear identity: warm paper, quiet green actions, readable records, and familiar profile navigation. The page gives habits, explicit rules, and their sources room to be inspected and corrected. It keeps Chinese and English labels equally visible across desktop and phone layouts.

This is a code-derived record of the personal-profile surface, not a replacement for the repository's root design document. The normative sources are `src/app/globals.css`, `src/app/personal-profile.css`, `src/components/PersonalProfile.tsx`, `src/components/ProfileOverview.tsx`, and `src/components/ProfileLocation.tsx`; the surface also reuses the profile shell, product memory workspace, and memory history. The frontmatter records the default warm theme. Existing theme variables continue to control the alternate minimal theme.

**Key Characteristics:**

- Warm cream surfaces with green selection and action cues.
- Scene groups organize preferred values, matching context, weighted support, and evidence.
- One familiar companion introduces the overview beside global status shortcuts.
- Inline evidence and rule editing preserve the surrounding profile context.
- Seven named sections remain available on narrow screens.
- Privacy controls have persistent explanations beside native checkboxes.

## Colors

The default palette pairs warm neutrals with a restrained green accent and amber notices for uncertain or changing habits.

### Primary

`accent` marks selected navigation, evidence links, support bars, and primary controls. `soft` provides the activity summary, ordinary state badges, and secondary controls. These values come from the current global theme, even though the older root design prose still describes a purple accent.

### Secondary

`changed-ink` and `changed-surface` distinguish changed and tentative states. The inherited default button hover uses `button-hover`; this existing purple hover is documented as implemented, not promoted into a new profile accent.

### Neutral

`paper` is the canvas; `surface` is the card and detail background. `ink` carries primary content and `muted` carries explanations, conditions, dates, and counts. `line` separates lists and frames interactive cards. Disabled, rejected, and stale badges use paper and muted text. State text remains visible alongside color.

## Typography

Body text inherits Geist with Chinese system fallbacks. Profile headings inherit the declared LXGW WenKai stack; the declaration does not guarantee that every client has that font installed. The alternate minimal theme uses the body stack for headings too.

The page heading uses the headline role, shrinking to 25px at the profile's phone breakpoint. Section headings remain below it. An insight's field label is quiet (11px, regular), while its chosen value uses the larger insight-value role. Context wraps naturally below that value. State, source count, and evidence actions use compact text (11px), with support percentages written beside a thin bar. The companion heading uses 24px on desktop and 21px on phones. Global status counts use tabular numerals (23px on desktop, 22px on phones); valid-record totals and the date range remain a small supporting caption.

Do not introduce an uppercase eyebrow above the page title. The private visibility note is a functional lock-and-text label, not a decorative heading.

## Layout

The profile content is centered with a maximum width of 1240px inside the existing application workspace. Its heading, seven-section navigation, and current section follow one vertical flow. Overview insights are grouped by scene on the current page. The scene grid has three desktop tracks with 30px row gaps and 20px column gaps. Groups with multiple insights span two columns and `ceil(insight count / 2)` rows, and arrange their cards in two columns; an odd final card spans the group width. At 1000px or narrower the scene grid has two tracks. At 600px or narrower both groups and their cards use one column.

Desktop section navigation wraps horizontally when needed. At 600px or narrower it becomes a two-column grid so all seven labels remain discoverable without horizontal scrolling. The same breakpoint stacks the overview search and status filter, rule rows, alternatives, and editor fields. The overview introduction places its companion story beside three vertically arranged status shortcuts. At 1000px or narrower the story sits above a horizontal row of shortcuts; phone shortcuts retain their icons, labels, and counts while hiding the supporting descriptions. Desktop rule editor groups use three columns; phone groups use one.

Product memory filters become one full-width field per row at 600px or narrower. Their pagination places the current page and total across the full first row, with Previous and Next occupying equal columns below. Evidence pagination inside the detail panel also stacks its count and controls. Preserve these arrangements for both Chinese and English labels.

The inherited application breakpoint at 730px provides 16px form inputs and a 48px minimum input height. Profile section buttons keep a 48px minimum height; inherited ordinary buttons keep at least 44px. Empty, loading, failure, and saved states occupy normal document flow.

## Elevation & Depth

The new profile summary, insights, and inline detail panels use tonal separation and thin borders rather than added shadows. Existing product memory panels retain the shared panel shadow (`0 3px 20px #453d3806`). Selection changes an insight's whole border to the accent; it does not add a left stripe or lift the card.

Insight border and background changes use the implemented 180ms transition. Ordinary controls inherit the 150ms background transition. The scene grid enters with a 300ms, five-pixel vertical movement. Reduced-motion styles remove this entrance animation and transitions and restore automatic scrolling. Opening evidence or editing brings the inline panel into view; it does not create a new overlay.

## Shapes

Small status badges use compact corners; controls and inputs use gently rounded corners; insight cards and larger summary/detail containers use progressively broader corners, as recorded in frontmatter. Lists and rules use horizontal separators with open backgrounds. Section navigation has square corners and a three-pixel bottom indicator for the current section. Support bars are four pixels high with two-pixel corners.

## Components

### Navigation

The profile remains inside the existing personal-details entry. Its seven sections are Overview / 画像总览, Habits & rules / 场景与规则, Products & services / 商品与服务, Arrangements / 长期安排, Review / 待确认, History / 学习记录, and Learning & privacy / 学习与隐私. Each pairs a small line icon with text. The current section uses an accent underline, accent text, and a 650 font weight. Switching sections clears the previous section's search, page, selected evidence, and editor.

### Buttons and inputs

Primary buttons save or add; secondary buttons edit, cancel, or move through records; text and icon buttons expose supporting actions. Reuse the current global hover behavior instead of inventing a separate profile control theme. Keyboard focus is a two-pixel accent outline with a three-pixel offset. Busy controls are disabled with the inherited reduced opacity.

Fields retain visible labels. The overview search has an icon and accessible name inside a bordered search shell; rule and area fields use standard inputs or selects. Phone controls expand to available width. Saved-area selection remains usable without successful geolocation.

### Insight cards and evidence

Scene headings pair a line icon with the scene name and an explicitly labeled current-page count. Read a card from status and source count, through the field icon and suggested value, to matching context, weighted support, and View evidence. Wallet preferences reuse the existing account-logo resolver; other fields use their matching line icons. A recent change with a distinct previous value shows the earlier value struck through, an arrow, and the current value. The bar is a compact representation of the written percentage, not a prediction-accuracy score. The section explanation states that evidence fades over time.

Opening a card shows an inline detail panel with alternatives, recent versus earlier counts, support shares, and paginated source records. The user can confirm a choice as a rule, correct the preference, exclude an option, or disable filling in that context. Current explicit input takes priority over explicit rules, which take priority over learned habits; the rules section states this hierarchy directly.

### Overview companion and status shortcuts

The introduction uses two existing library stickers not assigned to other fixed application scenes: `public/stickers/bubu-yier-087.gif` (reading a book) before the first record, and `public/stickers/bubu-yier-171.gif` (typing at a keyboard) once records exist, with matching `.png` fallbacks. Neither contains language-specific captions. Only one companion GIF appears at a time. Playback automatically stops after 4.5 seconds and a labeled 44px play/pause control allows another play or an earlier pause. Reduced-motion preference selects the static PNG and disables automatic playback. The minimal theme displays a compass icon with no GIF or playback control.

The three status shortcuts show global established, changed, and tentative counts. Selecting one filters the overview; selecting it again clears that status filter. These global counts are distinct from each scene heading's count of insights on the current page. The valid-record total and observed date range remain in the companion caption.

### Rule editing

The inline editor separates matching conditions from the suggested field, value, and rule state using fieldsets and legends. Add-condition and remove-condition actions sit with the relevant fields. Conflict replacement is an explicit checkbox. Save and Cancel remain together beneath the form. No modal or separate editing page is implied.

### Products, arrangements, and history

These sections reuse the existing memory tools instead of creating a second product-management interface. Product records retain attribute, alias, source, edit, split, and forget actions. Arrangements explain that they reference existing plans. The History section presents rule/privacy changes and the existing memory history; undo appears only for eligible changes. Growing collections keep their counts and pagination visible.

### Privacy and location

Privacy settings are separated rows, each with a title, explanatory text, and a native checkbox. The three controls govern learning from confirmed entries, on-demand location assistance, and retained purchase-area links. The retention checkbox is disabled when location assistance is off. Do not describe these controls as custom sliding switches: the implemented affordance is a checkbox.

Saved areas have names, brief location-status text, and separate delete actions. The location helper expands beneath its trigger and includes a manual selector, a locate action, explanatory copy, and an explicit confirmation that the purchase occurred in the selected area. Export and clear-location actions remain visibly separate from ordinary setting rows. A failed location request leaves a readable status and the manual path available.

## Do's and Don'ts

### Do:

- Do bind profile surfaces and controls to the existing theme variables.
- Do keep context, weighted support, and source access beside each learned habit.
- Do preserve all seven section labels and full-width product filters on phones.
- Do show privacy explanations and explicit location confirmation beside their controls.
- Do keep inline correction, source pagination, and visible keyboard focus.

### Don't:

- Don't add decorative eyebrow text above the profile heading.
- Don't add a selected left stripe to insight cards or memory rows.
- Don't label weighted support as prediction accuracy.
- Don't present learned habits as confirmed personal rules.
- Don't replace the implemented native privacy checkboxes with undocumented custom switches.
