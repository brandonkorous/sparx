# sparx `/builder` — Comprehensive Evaluation Brief

> Hand this entire document to the evaluating agent as its task prompt. It is self-contained.

## Your mission

You are evaluating the sparx **site builder** (`/builder` and its sub-surfaces) on two axes at once:

1. **Does it work?** — functional correctness. Every action a user can take should do what it claims, persist, and survive a reload / publish.
2. **Is it a good user experience?** — discoverability, friction, clarity, responsiveness, polish, and whether a real person could actually build a site without getting stuck.

You will drive the real running app as a user would (browser automation), exercise the full surface, and produce a single written findings report. You are an evaluator, **not** an implementer: do **not** fix code or change app behavior during this pass. The one thing you _may_ write is the findings document. Capture proposed fixes as recommendations in the report.

This is a production-quality product (no MVP/stub tolerance — see the house rules in `CLAUDE.md`). Judge it against that bar: a missing capability, a happy-path-only flow, or a placeholder counts as a finding, not an acceptable state.

---

## What the builder is (so your findings use the right vocabulary)

sparx is a modular content + commerce platform. The builder lets a tenant compose their **site, pages, email, brand/theme, and reusable components** out of a recursive node tree. Core model:

- A document is a tree of nodes: `{ id, type, name?, class?, props, binding?, children? }`.
- **`class` is the only styling surface** — Tailwind-native utility strings, compiled per-tenant and scoped to `.bx-canvas` in the editor (class-first authoring, docs/47, docs/61). There is no separate box/layout object persisted.
- Two component tiers: **Tier-1 primitives** (Section, Grid, Stack, Heading, Text, Button, Image, Divider, Icon, NavMenu, Outlet, …) and **Tier-2 data-aware** components that bind to data (PriceTag, ImageDisplay, ProductForm, Signup, FAQ, …). Plus **custom** tenant components (`custom:<key>`).
- **Bindings** resolve paths (`cms.posts`, `item.title`, `commerce.products[0]`, `recipient.email`, `site.identity`, …) with cardinality: scalar (render once), object (scope children), array (repeat children per item).
- **Canvas == production**: the editor canvas (`apps/dashboard/.../builder/_builder/canvas.tsx`) and the live storefront renderer (`apps/site/components/builder-renderer.tsx`) share binding-resolution logic and apply the same `class` strings. The canvas uses **mock/sample data**; the live site uses real records. A known risk area is **canvas↔live divergence** — explicitly test that what you build in the canvas looks the same when published.

### Route surface to cover (all under `apps/dashboard`, route group `(dashboard)/builder`)

| Route                             | What it edits                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/builder`                        | Landing / surface picker (Brand, Site, Page, Email, Components, blueprint teaser)                    |
| `/builder/brand`                  | Brand & theme: colors, type, rounding, logo, favicon, saved-theme catalog, Light/Dark, Save, Publish |
| `/builder/site`                   | Site chrome shell (header/footer/nav) every page renders inside; layout catalog, one `isActive`      |
| `/builder/page`                   | Page templates (singleton + collection); `?page=<id>` deep link; SEO panel                           |
| `/builder/email`                  | Email templates; subject/preheader; merge tags; per-site customization                               |
| `/builder/components`             | Component catalog (system primitives + custom), faceted, card/table views                            |
| `/builder/components/<type>`      | Component detail / reference                                                                         |
| `/builder/components/<type>/edit` | Custom component editor (shape, props, versions)                                                     |
| `/builder/blueprints`             | Install a ready-made starter (site + pages + content + emails) to a draft                            |

Core editor parts you will interact with: the **left rail** (Layers tree + Fields tab), the **center canvas** (click-to-select, live preview), the **right Inspector** (Content / Style / Layout / Motion / Advanced), the **Add palette** (insert nodes), import/export JSON controls, undo/redo, autosave (debounced ~500ms), and the publish flow.

---

## Setup — get to a logged-in builder locally

Run these from the repo root (`g:\code\@wizeworks\sparx.works`). The shell is PowerShell; a Bash tool is also available.

1. `pnpm db:up` — start docker Postgres (port 5544).
2. `pnpm db:seed` — seed the **E2E Store** tenant. Login: `e2e-staff@sparx.test` / `e2e-test-password`. Idempotent.
3. Ensure `apps/dashboard/.env` exists (copy from `apps/dashboard/.env.example`); verify `SPARX_API_REST_URL` points at the local api-rest.
4. `pnpm install` (first run only; also generates the Prisma client).
5. `pnpm dev` — launches the stack (dashboard on **http://localhost:3001**, api-rest on 3100). Persistent process — run it in the background and poll readiness, don't block on it.
6. Open `http://localhost:3001`, sign in with the seeded staff credentials, then go to `/builder`.

If the seed or stack won't come up, that itself is **finding #1** — document the exact failure (command, output, what you tried) and continue evaluating whatever you can reach. Don't silently stop.

### Browser automation notes (these are real footguns — heed them)

- Use Playwright (the playwright MCP tools / `playwright-cli` skill). **Do not call `browser_resize`** unless you are deliberately testing a named viewport — and when you do test responsive, prefer separate runs; the user dislikes spurious resizes.
- The builder uses **dnd-kit** for drag/reorder/re-parent. Synthesize drags with a **stepped mouse** (mousedown → several small mousemoves → mouseup); a single drag event won't register.
- React controlled inputs need the **native-setter trick** to fire `input`/`change` properly when typing programmatically.
- Radix `select`/`switch` components need their open→option click pattern, not a raw value set.
- Take screenshots at each meaningful step — they are evidence for the report. Capture the console (`browser_console_messages`) and network panel; JS errors and failed requests are findings.

---

## Evaluation dimensions

Score and document each. Treat "works" and "good UX" as separate verdicts per item — a feature can function and still be painful.

### 1. Functional correctness (does it work)

For **each** route and each editor capability, verify the full loop: perform the action → see it reflected in the canvas → confirm it **autosaves/persists** → **reload** the page and confirm it survived → where applicable **publish** and confirm the live result matches. Specifically exercise:

- Create / rename / delete / duplicate / publish / set-default / set-active for pages, layouts, emails, components.
- Insert every primitive and a representative data-aware component from the Add palette; nest containers; reorder and re-parent in both the canvas and the Layers tree.
- Binding: bind a leaf to a scalar, scope a container to an object, bind a container to an array and confirm iteration. Test CMS, commerce, and site-source bindings.
- Collection page templates: target a record type, confirm iteration with sample data, confirm a published collection renders real records.
- Undo / redo, copy / paste, JSON import / export.
- Brand & theme: change tokens, switch Light/Dark, save a theme, publish, confirm pages pick up the change.
- Email: subject/preheader, merge tags, per-site customization, email-faithful rendering.
- Multi-site: if a second property can be created, confirm the breadcrumb site switcher and per-site scoping work.
- **Canvas↔live parity**: build a non-trivial page, publish, open the live storefront route, and diff it against the canvas. Log every visual or behavioral divergence.

For every bug: record steps to reproduce, expected vs actual, severity, console/network evidence, and the likely culprit file (cite `path:line` when you can find it — but don't fix it).

### 2. The Inspector / properties panel — FULL design surface (priority dimension)

**Design intent from the product owner:** the properties panel must expose **full Tailwind-level design control for every element** — this is for power users. A **general/common** properties section for everyday users is welcome and expected, but it must **never be the ceiling**: a power user must be able to reach the complete design surface for any node, not just a curated subset.

Evaluate against that intent. For a representative set of node types (a container like Section/Grid/Stack, a text leaf, an image, a button, a data-aware component), determine **what is reachable from the UI** vs **what requires dropping to the raw class escape hatch**, across the full Tailwind surface:

- Typography (family, size, weight, leading, tracking, alignment, transform, decoration, color + opacity, truncation/clamp)
- Spacing (padding/margin per side, gap, space-between)
- Sizing (width/height/min/max, fractional + arbitrary values)
- Layout (display, flex direction/wrap/grow/shrink/basis, grid template/cols/rows/auto-flow, alignment & justification, order)
- Position (static/relative/absolute/sticky/fixed, inset, z-index)
- Backgrounds (color + opacity, gradients, image, size/position/repeat)
- Borders (width per side, style, color, radius per corner)
- Effects (box-shadow, ring, opacity, mix-blend, backdrop)
- Filters (blur, brightness, contrast, etc.)
- Transforms (scale, rotate, translate, skew, transform-origin)
- Transitions / animation
- **Responsive breakpoint variants** (sm/md/lg/xl/2xl) — can a power user set a property _per breakpoint_ from the UI?
- **State variants** (hover, focus, active, disabled, group/peer, dark) — reachable from the UI?
- Arbitrary values (`[…]`) and the raw-class escape hatch — present? ergonomic? does it round-trip cleanly with the structured controls?

Then assess the **two-tier model** the owner described: is there a clean separation between a **common/simple** section (for general users) and a **full/advanced** surface (for power users)? Is the advanced surface complete, discoverable, and not buried? Does editing in one tier stay consistent with the other (no clobbering, no drift)? Where the panel falls short of "full Tailwind for every element," that is a **gap finding** with a concrete recommendation for how to close it (which control group is missing, where it should live, how the common/full split should work).

### 3. Design quality

Visual hierarchy, spacing rhythm, alignment, token adherence (no hardcoded colors — should ride `--st-*`/role vars), consistency across the five surfaces, empty states, loading states, iconography, and overall craft. Flag anything that re-skins a control instead of using a `@sparx/ui` variant (house rule). Note where the editor chrome itself feels unpolished or inconsistent with the dashboard standard.

### 4. Missing / lacking functionality

What can't a user do that they'd reasonably expect from a site builder of this ambition? Examples to probe: keyboard shortcuts, multi-select, alignment guides/snapping, copy styles between nodes, find/replace, component overrides per placement, accessibility controls (alt text, aria), per-breakpoint preview, version history/rollback, draft vs published diff, search within the tree. Distinguish "genuinely absent" from "present but undiscoverable."

### 5. UX pain points & friction

Walk a realistic end-to-end task ("build a homepage with a hero, a feature grid, and a product collection, theme it, then publish") and narrate every moment of friction: confusing labels, hidden actions, lost work, surprising behavior, slow steps, dead ends, modal/focus traps, ambiguous binding pickers, anything that would make a real user hesitate or give up. Count clicks for common actions. Note where the onboarding/first-run experience leaves a new user stranded.

### 6. Responsiveness & accessibility (lightweight pass)

The platform requires the dashboard and builder to be usable on smaller screens (two-pane editors should collapse to one column). Do a deliberate check of the builder's own responsive behavior (one focused viewport run, per the resize caution above). Spot-check keyboard navigation and focus order in the editor chrome and inspector.

---

## Deliverable

Write a single markdown report to:

`docs/evaluations/builder-eval-findings-2026-06-14.md`

Structure it as:

1. **Executive summary** — overall verdict (does it work / is it good UX), top 5 things that are strong, top 5 things that hurt most.
2. **Setup & environment** — what you ran, what came up, any setup blockers.
3. **Coverage matrix** — table of every route × capability with a Works? (✅/⚠️/❌) and a UX rating (Good/OK/Painful) per cell, so gaps in _your_ coverage are visible too. If you had to skip something, say so explicitly — no silent omissions.
4. **Findings** — numbered, each with: title, category (Bug / Design / Missing / UX / Properties-panel), **severity** (Blocker / High / Medium / Low), repro steps, expected vs actual, evidence (screenshot refs, console/network), likely culprit file (`path:line`), and a **recommended fix** (described, not applied).
5. **Properties-panel deep-dive** — dedicated section answering the full-Tailwind-for-every-element question with a per-control-group reachability table (Reachable in common UI / Reachable in advanced UI / Raw-class only / Not possible) and a concrete proposal for the common-vs-full two-tier design.
6. **Canvas↔live parity report** — what diverged, with side-by-side screenshot refs.
7. **Prioritized recommendations** — ranked backlog of fixes/improvements, grouped by effort (quick wins vs larger work).

Save screenshots under `docs/evaluations/assets/builder-eval/` and reference them by relative path.

## Rules of engagement

- **Do not modify application code or behavior.** Your only write is the findings doc (+ its screenshots). Everything else is observation and recommendation.
- Report outcomes faithfully. If something is broken, say so with the evidence. If you skipped a step, say that. Don't claim a flow works unless you actually drove it and saw it persist.
- Be specific and concrete. "The binding picker is confusing" is weak; "Selecting a CMS array binding on a non-container leaf silently does nothing and shows no error (Layers → Heading → bind `cms.posts`) — see shot 14" is a finding.
- When you finish, post a short summary back to the requester: headline verdict, count of findings by severity, and the path to the report.
