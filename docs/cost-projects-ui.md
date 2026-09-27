# Cost projects: surface note

Recorded 2026-09-27 for the narrow cost-project extension. The existing [DESIGN.md](../DESIGN.md) remains the visual authority; this note introduces no global tokens, identity changes, or product commitments. `PRODUCT.md` is absent; this work extends the incumbent surface.

The implementation inherits the warm-neutral Operate UI, existing panels, typography, semantic colors, form controls, and chart presentation. Original payments, cost periods, participants, optional income offsets, and review are separate editor sections. Preview leads to an explicit confirmation action. Primary styling emphasizes preview/confirmation; navigation and selection use secondary buttons, with auxiliary actions using text buttons.

Cost attribution remains visibly distinct from actual wallet cash flow. Expected offsets are labeled separately from received offsets. The report states that it includes approved cost projects rather than ordinary unallocated spending, and exposes personal versus participating-project scope. Source-change warnings distinguish previous rules from currently valid totals. These are interface boundaries, not a substitute for backend validation.

The surface uses the existing planning and analysis destinations in `Workspace.tsx`; it adds no primary navigation destination. Growing editor/detail lists reuse `PagedList`; project and report lists retain previous/next controls and visible result ranges. At widths of 600px and below, form grids and editable labels stack, project rows become vertical, and toolbar buttons wrap. Buttons retain a 44px minimum height.

Implementation: `src/components/CostProjects.tsx`, `src/components/CostReport.tsx`, `src/components/cost-projects.css`, and `src/components/Workspace.tsx`.

Review evidence is stored under `/home/yao/artifacts/tallybear/cost-projects-20260927/`: `desktop.png`, `mobile.png`, `desktop-detail.png`, `mobile-detail.png`, `desktop-editor.png`, `mobile-editor.png`, `desktop-report.png`, and `mobile-report.png`. These captures cover the recorded list, detail, editor, and report surfaces; they do not establish validation of every data state or physical-device interaction.

Final review disposition supplied by the finish reviewer: **ship for this narrow scope**. Detector result: `[]` (one pass). Global `DESIGN.md` and its sidecar are unchanged.
