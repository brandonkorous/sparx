# Sparx `/builder` — Evaluation Findings

> **Version:** 1.1 · **Author:** Brandon Korous · **Last Updated:** 2026-06-15
> Evaluation brief: [builder-eval-prompt.md](builder-eval-prompt.md). Driven against the locally-running stack (dashboard `:3001`, api-rest `:3100`, site `:3004`) as the seeded `e2e-staff@sparx.test` user, tenant **E2E Store**, with the active site set to the non-primary **Ironleaf Tattoo Co.** property for most of the pass. Screenshots under [assets/builder-eval/](assets/builder-eval/).

---

## 1. Executive summary

**Verdict — does it work?** **Mostly yes.** Every builder surface loads, the core authoring loop (select → edit → autosave → reload → persist) works and was verified end-to-end, and the architecture is genuinely strong: one class-first node-tree model shared across page/site/email, a single component registry (35 components), real per-tenant theme compilation, and a binding system with proper cardinality. The five surfaces feel like one product.

**Verdict — is it good UX?** **Good, with real gaps for power users and a few rough edges.** The everyday path is clean, well-labelled, and discoverable. But the product owner's stated bar — _"full Tailwind-level design control for every element"_ — is only ~70–75% met from the UI, several expected editor affordances are absent (undo/redo, multi-select, canvas drag, alignment guides), and there are concrete canvas↔live divergences plus a publish path that is **blocked in local dev**.

### Top 5 strengths

1. **Unified node-tree architecture across all five surfaces.** Page/site/email share one model, one registry, one inspector, one import/export. Binding resolution (`resolvePath`/`cardinalityOf`) is a shared pure function in `@sparx/builder-schemas` — no drift in the core.
2. **The brand/theme surface is excellent and now fully per-site.** Live component showcase + the new **Components | Site** live-preview toggle (re-themes the real storefront on every keystroke), per-site identity/brand isolation (DB-verified), responsive editing.
3. **Email editor is email-faithful and polished.** Full From/To envelope, merge tags (`{{…}}`), auto-applied branded header + legal footer, per-site customization, brand-correct rendering.
4. **The Inspector's responsive + structured-control model is more sophisticated than it first looks.** Container-query per-breakpoint arrangement, a clean common/advanced split, arbitrary-value escape hatches in length fields, and a raw-class card as the ultimate hatch.
5. **Strong empty/onboarding states and labelling.** The `/builder` landing, blueprint CTA, site-layout Outlet ghost ("Page content renders here"), and inspector helper copy all read clearly.

### Top 5 things that hurt most

1. **Publish is blocked in local dev for any post-onboarding tenant** (Blocker for the dev/eval loop). `requireVerifiedEmail` reads `prisma.user` on the base client, which the `users`-table RLS returns null for under the `sparx_app` role → the gate trips even though the user _is_ verified. This blocked the canvas↔live publish-diff entirely.
2. **The properties panel falls short of "full Tailwind for every element"** (Properties, High). No UI for gradients, filters, text-decoration, truncate/line-clamp, flex-wrap, grid-rows/auto-flow, ring, mix-blend, per-side borders, transform-origin/skew, transition duration/delay. Full skin + state-variant editing is **component-builder-only**, not reachable on the page builder.
3. **No undo/redo, no multi-select, no canvas drag-to-move, no alignment guides** (Missing, High). Autosave-only with no history stack; a mis-edit can't be reversed. Reordering is layers-tree-only.
4. **Canvas↔live divergence on commerce atoms and buttons** (Bug/Design, High). BuyBox/VariantPicker/Quantity/AddToCart/PriceTag/ImageDisplay render _static mocks_ in the canvas; Button is an inert `<span>` in canvas vs an interactive `<a>/<button>` live. Authors design against a baseline that isn't what ships.
5. **Custom-CSS raw class doesn't round-trip with structured controls** (Properties/Bug, Medium) and a scatter of smaller rough edges (Site "Preview" button hard-disabled with no tooltip; Blueprints pager "1–17 of 17" over an empty installed list; three stray "Untitled component" customs).

### Resolution status (2026-06-15)

**All 12 findings are now addressed.** Most were closed by the Builder v2 phases; the remaining tail landed in a dedicated follow-up. Verified against the code on the `builder-overview-endpoints` branch (dashboard build green). The findings below are kept verbatim as the original evaluation record; this table is the closure overlay.

| #   | Finding                                       | Status | Resolved by                                                                                                                                                               |
| --- | --------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Publish email-gate (RLS)                      |   ✅   | Builder v2 — [01-publish-gate-fix](../builder/01-publish-gate-fix.md): the guard reads `emailVerified` from the JWT, not a base-client read                               |
| 2   | Properties ≠ "full Tailwind"                  |   ✅   | Builder v2 — [04-inspector-full-design-surface](../builder/04-inspector-full-design-surface.md): Effects card + the missing controls + page-builder skin/state/breakpoint |
| 3   | No undo/redo                                  |   ✅   | Builder v2 — [05-editor-affordances](../builder/05-editor-affordances.md): history stack + keymap                                                                         |
| 4   | Canvas↔live divergence                        |   ✅   | Builder v2 — [02-canvas-live-renderer-unification](../builder/02-canvas-live-renderer-unification.md): one `@sparx/builder-render` path                                   |
| 5   | No drag / multi-select / guides / copy-styles |   ✅   | Builder v2 (drag · multi-select · copy-styles) **+ this follow-up** — alignment guides during canvas drag (§2.4)                                                          |
| 6   | Site Preview button dead                      |   ✅   | Builder v2 — unified-studio Preview with contextual tooltips                                                                                                              |
| 7   | Canvas overflows on mobile                    |   ✅   | **This follow-up** — canvas zoom-to-fit + a manual zoom control                                                                                                           |
| 8   | Blueprints pager over empty list              |   ✅   | **This follow-up** — installed-only API filter; the pager is bound to the installed list and never shows over the empty state                                             |
| 9   | Stray "Untitled component" customs            |   ✅   | **This follow-up** — a required-name dialog on component create                                                                                                           |
| 10  | Custom-CSS doesn't round-trip                 |   ✅   | Builder v2 — conflict detection + "Tidy up" in the Custom CSS card                                                                                                        |
| 11  | Welcome subject uses `tenant.name`            |   ✅   | Builder v2 — the default email subject now reads `{{site.name}}`                                                                                                          |
| 12  | Stuck file-chooser modals                     |   ✅   | Builder v2 — the hidden file input fires only on a user click                                                                                                             |

---

## 2. Setup & environment

| Item        | Result                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack       | Already running and re-confirmed: dashboard `:3001`, api-rest `:3100`, site `:3004`. (api-rest restarted mid-eval — "dev just started" — and came back cleanly.) |
| Auth        | Logged in as `e2e-staff@sparx.test` (E2E Staff), tenant **E2E Store** (`e2e-store`).                                                                             |
| Active site | **Ironleaf Tattoo Co.** (a non-primary property) for most of the pass; also exercised the primary "Default" site.                                                |
| DB reads    | docker Postgres `:5544`; tenant-scoped tables need `SET app.tenant_id` (RLS), or connect as `sparx_owner` (owner) to bypass.                                     |

> **Caveat — the tree under test is not pristine.** This same session previously implemented fixes to `/builder/brand` and multi-site (4 media bugs, per-site identity, the Components|Site toggle, a site-switch remount fix). Those uncommitted changes are part of what was evaluated. The brief's "do not modify code" rule was honored _during this evaluation pass_ — the only writes are this report and its screenshots.

**Method.** Four read-only code-analysis agents mapped the route/capability surface, the Inspector control inventory, the canvas↔live render paths, and missing functionality; their conclusions are cited inline with `path:line`. The live app was then driven with Playwright to confirm behavior, capture evidence, and resolve conflicts between agents (notably the per-breakpoint question, settled against the source).

---

## 3. Coverage matrix

Legend — Works: ✅ yes · ⚠️ partial/caveat · ❌ no/blocked. UX: Good / OK / Painful.

| Route / capability                                               | Works? |   UX    | Notes / evidence                                                      |
| ---------------------------------------------------------------- | :----: | :-----: | --------------------------------------------------------------------- |
| `/builder` landing (surface picker, blueprint teaser)            |   ✅   |  Good   | Clear grid + CTA. `01-builder-landing.png`                            |
| `/builder/brand` — identity, colors, type, logo/favicon          |   ✅   |  Good   | Fixed + verified this session; per-site isolation DB-proven           |
| `/builder/brand` — Components\|Site live preview toggle          |   ✅   |  Good   | Live re-theme via postMessage, both primary + non-primary             |
| `/builder/brand` — saved themes (create/apply/rename/delete)     |   ✅   |  Good   | Per-route agent confirmed full CRUD                                   |
| `/builder/brand` — **Publish**                                   |   ❌   | Painful | Blocked by email-verify gate in local dev (Finding 1)                 |
| `/builder/site` — layout catalog (create/rename/delete/activate) |   ✅   |  Good   | "Live" badge, switcher. `07-site-editor.png`                          |
| `/builder/site` — **Preview**                                    |   ❌   | Painful | Button hard-disabled, no tooltip (Finding 6)                          |
| `/builder/site` — edit chrome (header/footer/nav/Outlet)         |   ✅   |  Good   | Outlet ghost is a nice touch                                          |
| `/builder/page` — page catalog (create/rename/delete/slug/SEO)   |   ✅   |  Good   | SEO panel w/ health score. `02-page-editor.png`                       |
| `/builder/page` — select node + Inspector tabs                   |   ✅   |  Good   | Content/Style/Size/Spacing(+Layout for containers). `03/04`           |
| `/builder/page` — **edit → autosave → reload persist**           |   ✅   |  Good   | Verified: heading edit survived reload, "Saved" state                 |
| `/builder/page` — node retype ("change to…")                     |   ✅   |   OK    | Present; warns on lossy. `inspector.tsx:477`                          |
| `/builder/page` — Add palette (insert)                           |   ✅   |  Good   | Faceted, context-aware ("Insert into Product card"). `06`             |
| `/builder/page` — bindings (scalar/object/array)                 |   ✅   |   OK    | Sample data iterates; verified hero bound `cms.blog_post[0]`          |
| `/builder/page` — undo / redo                                    |   ❌   | Painful | Not implemented (Finding 3)                                           |
| `/builder/page` — copy / paste nodes                             |   ❌   |   OK    | Only "save as component"; no node clipboard                           |
| `/builder/page` — JSON import / export                           |   ✅   |   OK    | Toolbar Export/Import; per-route agent confirmed                      |
| `/builder/page` — canvas drag-to-move                            |   ❌   |   OK    | Layers-tree reorder only (Finding 5)                                  |
| `/builder/page` — **Preview / Publish**                          | ⚠️/❌  |   OK    | Preview opens live draft (needs slug); Publish blocked (F1)           |
| `/builder/email` — templates, subject/preheader, merge tags      |   ✅   |  Good   | Email-faithful. `08-email-editor.png`                                 |
| `/builder/email` — per-site customization                        |   ✅   |  Good   | "All sites" badge; `customize` action exists                          |
| `/builder/email` — preview / test-send                           |  ✅\*  |   OK    | Endpoints exist (`/preview`, `/test-send`); not driven this pass      |
| `/builder/components` — catalog (filter/search/views)            |   ✅   |  Good   | Faceted table. `09-components.png`                                    |
| `/builder/components/<type>/edit` — custom editor                |  ✅\*  |   OK    | Editor route exists; 3 stray "Untitled" customs (Finding 9)           |
| `/builder/blueprints` — list / empty state                       |   ⚠️   |   OK    | Empty state good; pager mismatch (Finding 8). `10`                    |
| Canvas ↔ live parity                                             |   ⚠️   |    —    | Commerce atoms + Button diverge (Finding 4); exact diff blocked by F1 |
| Responsive (builder on mobile 390px)                             |   ⚠️   |   OK    | Chrome collapses; canvas overflows horizontally (Finding 7). `12`     |
| Inspector — full-Tailwind reachability                           |   ⚠️   |   OK    | ~70–75% from UI (§5)                                                  |

**Explicitly not covered / skipped this pass (no silent omissions):**

- Email **test-send** and **preview-render** were not driven live (endpoints confirmed in code only).
- **JSON import** round-trip was not exercised (export/import controls confirmed present in code).
- **Collection page → published real records** could not be verified live because **publish is blocked** (Finding 1).
- **dnd-kit layers reorder** was confirmed in code but not drag-tested live (stepped-drag would be the method).
- Custom-component **version upgrade/usage** flows confirmed in code only.
- A11y was a light spot-check, not an audit.

---

## 4. Findings

Severity: **Blocker** (stops a core flow) · **High** · **Medium** · **Low**.

---

### Finding 1 — Publish/rollback/schedule blocked in local dev for post-onboarding tenants

- **Category:** Bug · **Severity:** Blocker (dev/eval), High (product risk)
- **Repro:** As `e2e-staff@sparx.test` (a tenant that has finished onboarding), open `/builder/brand` (or any builder surface) → **Publish** → confirm. Save state flips to **"Save failed"**; the toast/tooltip reads _"Confirm your email address to use this feature."_
- **Expected:** Publish succeeds (the user's `email_verified` is `true` in the DB).
- **Actual:** Blocked. `requireVerifiedEmail` ([services/api-rest/src/lib/verified-email-guard.ts:39](../../services/api-rest/src/lib/verified-email-guard.ts#L39)) calls `prisma.user.findUnique(...)` on the **base** client (no tenant context). The `users` table is `ENABLE`-RLS, and api-rest connects as **`sparx_app`** (non-owner) in local dev (`services/api-rest/.env` `DATABASE_URL`), so that read returns **null** → `user?.emailVerified` is falsy → onboarding is finished → `forbidden()` thrown.
- **Why it matters:** In local dev _no one_ can publish a post-onboarding tenant, which blocks the canvas↔live parity test and any developer trying to ship a draft. In prod api-rest connects as the table owner and bypasses `ENABLE`-only RLS, so it works there — but relying on that asymmetry is fragile and hides the bug from local testing.
- **Evidence:** Save state `data-state="error"`, title = the verify-email message; DB shows `users.email_verified = t` for `e2e-staff@sparx.test`.
- **Likely culprit:** [verified-email-guard.ts:39-44](../../services/api-rest/src/lib/verified-email-guard.ts#L39) — the `prisma.user` read needs to run in a context that can see the row.
- **Recommended fix:** Read the verified flag through the request's already-authenticated identity (it's in the session/JWT used by `requireAuth`) instead of a fresh base-client DB read; or scope the read with the tenant context; or add a `users` RLS policy that lets the app role read its own row. Add a regression test that runs as the non-owner role.

---

### Finding 2 — Properties panel does not reach "full Tailwind for every element"

- **Category:** Properties-panel · **Severity:** High (it's the owner's priority dimension)
- **Summary:** The Inspector covers the common surface well but leaves a meaningful slice of Tailwind reachable only through the raw-class escape hatch or not at all. Full per-control detail is in **§5**. Headline gaps with **no structured control on any surface:** background **gradients**, **filters** (blur/brightness/contrast/…), **text-decoration**, **truncate/line-clamp**, **flex-wrap**, **flex grow/shrink/basis**, **grid-rows**, **grid-auto-flow**, **order**, **ring**, **mix-blend**, **transform-origin**, **skew**, **per-side border width**, **per-corner radius**, **transition duration/delay**.
- **Expected (owner intent):** A common section that is never the ceiling — a power user can reach the _complete_ Tailwind surface for any node from the UI.
- **Actual:** ~70–75% reachable from the UI; the rest needs the Custom CSS textarea (which itself has a round-trip problem, Finding 10).
- **Likely culprit:** control registry [apps/dashboard/app/(dashboard)/builder/\_builder/class-controls.ts](<../../apps/dashboard/app/(dashboard)/builder/_builder/class-controls.ts>) and the card composition in [inspector.tsx](<../../apps/dashboard/app/(dashboard)/builder/_builder/inspector.tsx>).
- **Recommended fix:** Add the missing `ClassControl`s (priority order in §7). Most are small enum/length controls that slot into existing cards (Typography, Layout, Borders, a new "Effects" subgroup).

---

### Finding 3 — No undo/redo (autosave-only, no history stack)

- **Category:** Missing · **Severity:** High
- **Repro:** Make any edit (move/delete/retype/style). There is no undo button and `Ctrl+Z` does nothing; the toolbar has only Preview/Export/Import/Save/Publish.
- **Actual:** `useBuilderEditor` holds a single `selectedId` + debounced autosave; mutations are immutable tree ops with no inverse stack ([\_builder/use-builder-editor.ts](<../../apps/dashboard/app/(dashboard)/builder/_builder/use-builder-editor.ts>)).
- **Why it matters:** A destructive edit (delete a section, bad retype) is unrecoverable except by manual re-authoring or re-importing JSON. For a visual builder this is a baseline expectation.
- **Recommended fix:** Add a bounded undo/redo stack in `useBuilderEditor` over the tree-op layer (each op already produces a new immutable tree — keep the previous N), wire `Ctrl+Z`/`Ctrl+Shift+Z` and toolbar buttons.

---

### Finding 4 — Canvas↔live divergence: commerce atoms and Button are mocked in the canvas

- **Category:** Bug / Design · **Severity:** High
- **Summary:** Several render paths differ between the editor canvas (`_builder/registry.tsx`) and the live renderer (`apps/site/components/builder-renderer.tsx`):
  - **BuyBox / VariantPicker / Quantity / AddToCart** — canvas renders static mock spans (`registry.tsx:1135–1198`); live wires real product state/variants/inventory (`builder-renderer.tsx:314–320`). A 3-option product shows the wrong control count in the canvas.
  - **PriceTag / ImageDisplay** — canvas hardcodes `amount={null}` / a "N images · gallery" badge (`registry.tsx:1041–1085`); live resolves the real bound value (`builder-renderer.tsx:342–352`). Confirmed visually: `04/05-inspector-*.png` show "$24.00" + "Add to cart" + "3 images · gallery" placeholders.
  - **Button** — canvas renders an inert `<span>` (selection-safe); live renders an interactive `<a>/<button>` (`builder-renderer.tsx:298–308`). CTAs/forms can't be exercised in the canvas.
  - **Carousel** — `CanvasCarousel` (centered dots, no autoplay) vs `BuilderCarousel` (arrows, pause-on-hover, autoplay). Authored autoplay has no visible effect in the canvas.
- **Why it matters:** The product's premise is "canvas == production." For Tier-1 primitives and content components that holds (both render the same `@sparx/site-ui` components); for the _data-aware commerce_ tier and buttons it does not, so authors design against a baseline that won't match the published page.
- **Recommended fix:** Where feasible, render the same live atom in the canvas fed by sample product data (the sample-data shape already exists in `apps/site/lib/sample-data.ts`); where a true interactive element would break canvas selection (Button), render the _real_ element but intercept clicks at the selection layer. At minimum, document the known-mock components in-UI so authors aren't surprised.

---

### Finding 5 — No canvas drag-to-move, multi-select, alignment guides, or copy-styles

- **Category:** Missing · **Severity:** Medium–High
- **Actual:** Reorder/re-parent works only in the **Layers tree** via dnd-kit ([\_builder/layers-panel.tsx](<../../apps/dashboard/app/(dashboard)/builder/_builder/layers-panel.tsx>)); the canvas is click-to-select only. Selection is single-node (no shift/ctrl multi-select). No snapping/alignment guides. No "paste style" between nodes.
- **Why it matters:** These are table-stakes for a visual builder targeting designers; their absence pushes all structural editing into the tree.
- **Recommended fix:** Phase them: (a) canvas drag-to-reorder reusing the tree's move logic; (b) multi-select + bulk move/delete; (c) copy/paste styles (serialize `node.class`); (d) alignment guides last (highest effort).

---

### Finding 6 — Site editor "Preview" button is permanently disabled with no explanation

- **Category:** UX / Bug · **Severity:** Medium
- **Repro:** `/builder/site` → the **Preview** button is greyed and `disabled` (confirmed via DOM: `disabled === true`), with **no** `title`/tooltip.
- **Expected:** Either a working preview of the active layout, or a disabled control that explains _why_ (e.g., "Preview a page to see this layout in context").
- **Actual:** Hard-disabled in code with no condition or hint ([\_builder/site-builder-app.tsx](<../../apps/dashboard/app/(dashboard)/builder/_builder/site-builder-app.tsx>)). The Page editor's Preview is conditionally disabled (needs a slug) — so behavior is inconsistent across surfaces.
- **Recommended fix:** Add a tooltip explaining the gate, or enable it to open the active site's home page draft (the layout always wraps the home route).

---

### Finding 7 — Builder canvas overflows horizontally on small viewports

- **Category:** UX / Responsive · **Severity:** Medium
- **Repro:** Page editor at 390×844 (`12-page-editor-mobile.png`). The chrome adapts well (hamburger, collapsed breadcrumb, tabbed single-pane "Build" view) but the **canvas content is cut off on the right** (hero "Built f…", CTA "Re…").
- **Expected (house rule):** Two-pane editors collapse to one column and remain usable on smaller screens (docs/59).
- **Actual:** Panes collapse, but the canvas itself renders at desktop width and overflows. Editing on a phone is inherently hard, but the canvas should at least fit-to-width or scale.
- **Recommended fix:** Fit-to-width / zoom-to-fit the canvas frame at narrow widths, or default the canvas device to "Mobile" when the viewport is mobile.

---

### Finding 8 — Blueprints pager shows "1–17 of 17" over an empty installed list

- **Category:** Bug · **Severity:** Low
- **Repro:** `/builder/blueprints` (`10-blueprints.png`): body says _"You haven't installed any blueprints yet,"_ but the footer pager reads **"1–17 of 17 · 50 / page · [1]"**.
- **Actual:** The pager count appears to reflect the marketplace catalog (17 available) rather than the installed list (0). Confusing — the two disagree on the same screen.
- **Recommended fix:** Hide the pager when the installed list is empty, or bind its count to the installed list.

---

### Finding 9 — Three stray "Untitled component" custom components in the catalog

- **Category:** Bug / Hygiene · **Severity:** Low
- **Repro:** `/builder/components` (`09-components.png`) lists three **"Untitled component"** customs (Component kind).
- **Actual:** Likely created by "Save as component" without a name (or seed/test residue). A custom component should require a name, or default to a meaningful one.
- **Recommended fix:** Require/auto-generate a name on save; offer rename-on-create; clean up the seed.

---

### Finding 10 — Custom-CSS raw class doesn't round-trip with structured controls

- **Category:** Properties-panel / Bug · **Severity:** Medium
- **Actual:** The "Custom CSS" card edits `node.class` directly. Typing e.g. `text-primary` there and then changing text color via a structured control does **not** reconcile — the two can conflict, and there's no warning or coalescing on read-back (per Inspector source review).
- **Why it matters:** The escape hatch is the _only_ way to reach the missing surfaces (Finding 2), so users will use it — and silently create conflicting class sets.
- **Recommended fix:** Detect tokens in the raw class that overlap structured control groups and surface a warning; optionally a "sync to controls" parse. Document the one-way nature in the card hint until then.

---

### Finding 11 — (Minor) Seeded Welcome email subject uses `{{tenant.name}}` not `{{site.name}}`

- **Category:** Design / Content · **Severity:** Low
- **Actual:** `08-email-editor.png` — subject `Welcome to {{tenant.name}} 👋`. Per the per-site model, `tenant.name` is the legal/billing name; customer-facing copy should read `site.name`. The email binding catalog exposes `site.*`.
- **Recommended fix:** Change the seeded default to `{{site.name}}`; consider lint/guidance that flags `tenant.name` in customer-facing email copy.

---

### Finding 12 — (Minor) Stuck file-chooser modal state navigating away from the brand page

- **Category:** Bug · **Severity:** Low (could not reproduce deterministically)
- **Actual:** Navigating from `/builder/brand` to `/builder` left six stacked OS file-chooser modal states (the brand image fields' hidden `<input type=file>`). Likely a Playwright/automation artifact rather than a user-facing bug, but six simultaneous choosers is worth a look at how `BrandImageField` wires its file inputs.
- **Recommended fix:** Verify the hidden file inputs aren't being programmatically clicked on mount/navigation.

---

## 5. Properties-panel deep-dive (priority dimension)

**Question:** Can a power user reach the _full_ Tailwind surface for _every_ element from the UI, with a clean common-vs-full split?

**Answer:** Partially — roughly **70–75%** of the Tailwind surface is reachable from the UI. The architecture is good (a `ClassControl` registry + a context selector for responsive/state), and the common/advanced split is mostly clean, but a meaningful set of properties has no structured control, and full skin/state editing is gated to the component builder.

### Inspector structure (from source)

- **Tabs/cards** (`inspector.tsx`): Content, Style (Color/Emphasis recipe + effects), Layout (containers), Size, Spacing, Position, Typography (leaf), Borders, Motion, **Custom CSS** (raw class). The **component builder** adds an **Appearance** card with free background/text color, type, border, shadow, transform — and the **state/dark/breakpoint** context selector.
- **Responsive / state:** a `ContextSelect` pill ([inspector.tsx:548](<../../apps/dashboard/app/(dashboard)/builder/_builder/inspector.tsx#L548>)) re-targets controls per context. `ARRANGEMENT_CONTEXTS` (base + breakpoints) drives the Layout card on **all** surfaces; `SKIN_CONTEXTS` (base + hover/focus/active + dark + breakpoints) drives **Appearance** — **component-builder only** ([inspector.tsx:2639](<../../apps/dashboard/app/(dashboard)/builder/_builder/inspector.tsx#L2639>)). Breakpoints are **container-queries** (`@md:`, keyed on the node's own width, docs/61), not viewport `md:`.

> **Resolved conflict:** one analysis pass reported "no per-breakpoint editing"; the source disproves that for _arrangement_ (Layout card, all surfaces) and for _full skin_ (Appearance, component builder). The accurate statement: **per-breakpoint _layout_ is reachable on the page builder; per-breakpoint/per-state _skin_ is reachable only in the component builder.** This is a deliberate design choice but it _is_ a ceiling a page-builder power user will hit.

### Reachability table

Status: **(a)** common UI control · **(b)** advanced/nested UI control · **(c)** raw-class only · **(d)** not possible without Custom CSS.

| Surface                                                             | Page builder                                      |               Status               |
| ------------------------------------------------------------------- | ------------------------------------------------- | :--------------------------------: |
| **Typography** family/size/weight/leading/tracking/align/case/color | Typography card (leaf) / Appearance (component)   |                (a)                 |
| Text decoration (underline/line-through)                            | —                                                 |                (d)                 |
| Truncate / line-clamp                                               | —                                                 |                (d)                 |
| Whitespace / word-break                                             | —                                                 |                (d)                 |
| Text color **+ opacity**                                            | arbitrary only                                    |                (c)                 |
| **Spacing** padding/margin per-side, gap                            | Spacing + Layout cards                            |                (a)                 |
| **Sizing** w/h/min/max, aspect, fractional, arbitrary               | Size card (LengthField + custom)                  |              (a)/(b)               |
| **Layout** display+direction ("Arrange as"), columns, align-items   | Layout card                                       |                (a)                 |
| Justify-content                                                     | Layout (4 options only: start/center/end/between) |                (b)                 |
| Flex-wrap, flex grow/shrink/basis, order                            | —                                                 |                (d)                 |
| Grid-rows, grid-auto-flow, justify-items, align-content             | —                                                 |                (d)                 |
| Row/col gap independently                                           | —                                                 |                (c)                 |
| **Position** static/relative/absolute/sticky, inset, z-index        | Position card                                     |                (a)                 |
| **Background** color                                                | Appearance (component) / recipe (page)            |              (a)/(c)               |
| Background gradient / image / size / position / repeat              | —                                                 |                (d)                 |
| **Borders** width (3 presets), style, color, radius (5 presets)     | Borders card                                      |                (a)                 |
| Per-side border width, per-corner radius                            | —                                                 |              (c)/(d)               |
| **Effects** opacity, shadow (4), transition (4)                     | Style card                                        |                (a)                 |
| Filters (blur/brightness/…), ring, mix-blend, backdrop              | —                                                 |              (c)/(d)               |
| **Transforms** scale/rotate/translate                               | Style card (LengthField)                          |                (a)                 |
| Skew, transform-origin                                              | —                                                 |                (d)                 |
| **Motion** entrance × trigger, stagger                              | Motion card                                       |                (a)                 |
| Transition duration / delay                                         | —                                                 |                (d)                 |
| **Responsive** per-breakpoint (arrangement)                         | Layout ContextSelect                              |                (a)                 |
| Per-breakpoint **skin** + state variants (hover/focus/active/dark)  | component builder only                            |           (b) page → (d)           |
| **Arbitrary `[…]`** + raw-class hatch                               | LengthField custom + Custom CSS card              | (a)/(c) — doesn't round-trip (F10) |

### Two-tier split — assessment & proposal

The existing split (common cards open by default; Size/Spacing/Position/Typography/Borders collapsed; Custom CSS muted) is sound. Two concrete improvements:

1. **Bring the "Advanced style" surface to the page builder.** Today free color/type/per-state/per-breakpoint _skin_ lives only in the component builder. Add an **Advanced** disclosure on the page builder's Style card that exposes the same `SKIN_CONTEXTS`-driven controls for the selected node — so the common recipe stays the default but is _not the ceiling_.
2. **Add an "Effects" subgroup** (filters, ring, mix-blend, backdrop, gradient) and fill the typography/layout gaps (decoration, truncate, flex-wrap, grid-rows). These are small `ClassControl` additions; see §7 priority order. Pair with the Custom-CSS round-trip fix (F10) so the hatch and the structured controls stop fighting.

---

## 6. Canvas↔live parity report

**What's shared (no drift):** binding resolution (`resolvePath`/`cardinalityOf` in `@sparx/builder-schemas`), iteration/scope, class compilation + per-tenant token application, and the Tier-1 primitives + content components (Heading, Text, Image, Divider, Icon, NavMenu, FAQ, FeatureGrid, EditorialSection, Logo, Wordmark, SocialLinks) — both sides render the same `@sparx/site-ui` components.

**What diverges (ranked):**

1. **Commerce atoms** (BuyBox/VariantPicker/Quantity/AddToCart) — canvas static mocks vs live wired components. **Critical** for commerce pages.
2. **Button** — inert `<span>` (canvas) vs interactive `<a>/<button>` (live).
3. **PriceTag / ImageDisplay** — canvas ignores the bound value (null / gallery badge) vs live real data.
4. **Carousel** — different component + no autoplay/pause in canvas.
5. **Email leaves** — canvas reads site theme vars as fallback; live resolves the email brand independently (fonts/accent can differ).
6. **Class scope** — canvas scopes utilities under `.bx-canvas`; live is unscoped — only an issue if a `node.class` contains a `.bx-*` chrome class (unlikely).

**Evidence & limitation.** Canvas mocks are visible in `04/05-inspector-*.png` ("$24.00", "Add to cart", "3 images · gallery"); the live renderer producing real, themed output is in `11-live-storefront.png`. A **true same-draft pixel diff was not possible** because publishing the edited (Ironleaf) draft is blocked by Finding 1, and Ironleaf has no published version. The divergence list above is therefore grounded in the shared/diverging _render code paths_ (`registry.tsx` vs `builder-renderer.tsx`) plus the canvas screenshots, not a published A/B. Once Finding 1 is fixed, a build→publish→diff of one commerce page is the recommended confirmation.

---

## 7. Prioritized recommendations

### Quick wins (small, high value)

1. **Fix the publish email-gate read** (Finding 1) — unblocks dev publishing + the parity test. Read `emailVerified` from the authenticated identity, not a base-client DB read.
2. **Add a tooltip to / enable the Site Preview button** (Finding 6).
3. **Fix the Blueprints pager** over an empty list (Finding 8); **require a name** for custom components (Finding 9).
4. **Seeded email subject → `{{site.name}}`** (Finding 11).
5. **Add the small missing `ClassControl`s**, in impact order: text-decoration, truncate/line-clamp, flex-wrap, transition duration/delay, per-corner radius (Finding 2 / §5).

### Medium

6. **Undo/redo stack** over the existing immutable tree-op layer + `Ctrl+Z` (Finding 3).
7. **Effects subgroup** (gradients, filters, ring, mix-blend, backdrop) + grid-rows/auto-flow/justify-items (Finding 2).
8. **Custom-CSS ↔ structured-control reconciliation** (warn on overlap; optional parse-to-controls) (Finding 10).
9. **Bring full advanced skin/state/breakpoint editing to the page builder** via a Style → Advanced disclosure (§5 proposal #1).
10. **Canvas fit-to-width on small viewports** (Finding 7).

### Larger

11. **Canvas drag-to-move + multi-select + copy-styles**, then alignment guides (Finding 5).
12. **Render real commerce atoms in the canvas** fed by sample product data, and make Button render its real element behind the selection layer (Finding 4).
13. **Version history / rollback / draft-vs-published diff UI** — the backend already has versions + a rollback endpoint; expose it in the editor.

---

### Appendix — screenshots

`01-builder-landing` · `02-page-editor` · `03-inspector-heading` · `04-inspector-container` · `05-inspector-section` · `06-add-palette` · `07-site-editor` · `08-email-editor` · `09-components` · `10-blueprints` · `11-live-storefront` · `12-page-editor-mobile` — all under [assets/builder-eval/](assets/builder-eval/).
