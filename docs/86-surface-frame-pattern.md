> **SUPERSEDED (2026-08-01).** This document describes `apps/dashboard`, which was
> **deleted** in the workbench cutover (`b86797b0`), and the `SurfaceFrame` primitive it
> specifies has now been deleted from `@wizeworks/ui` along with the rest of the dashboard-era
> composition set. Nothing in this file describes shipping code. It is kept as the design
> rationale for the F layout — identity once, lifecycle in the frame header, Cancel leftmost,
> explicit-save-only — which `sparx/apps/workbench` re-implements in its own idiom. For the
> workbench pattern read [docs/123-workbench.md](123-workbench.md) and
> [sparx/apps/workbench/CLAUDE.md](../apps/workbench/CLAUDE.md); for what `@wizeworks/ui` still
> contains read [sparx/packages/ui/CLAUDE.md](../packages/ui/CLAUDE.md).

# sparx Platform — Form Surface Layout Pattern (`SurfaceFrame`)

**Version:** 3.8
**Author:** Brandon Korous
**Last Updated:** 2026-07-08

---

## 1. Purpose

One layout language for every **form surface** in the platform — create and edit forms, the few genuinely sequential flows that remain multi-step (onboarding, blueprint/new-site install), and any future setup sequence. (The record-builder "wizards" — Product, Quote, Order, Customer, B2B Account, Document, … — are **collapsing to single-page** per the 2026 strategy below; they still use this frame, just with one `step`.)

The primitive is **`SurfaceFrame`** (formerly `WizardFrame` — that name wrongly implied wizard-only and is retired). It is **single-step by default**; the `steps`/stepper machinery is an **opt-in** feature for multi-step flows (a wizard), never the identity. **Create and edit both use it.** Two edit sub-cases — getting this wrong nests a frame inside tabs:

- **The detail view IS a single edit form** (e.g. category — its `[id]/_content.tsx` renders only the form) → render the edit form as a `SurfaceFrame` so create + edit are symmetric. The host chrome supplies the title + window controls; the frame supplies the module-card body + Save/Cancel toolbar.
- **Editing is one tab/panel of a tabbed detail view** (e.g. collection Metadata, product Edit) → do **not** nest a `SurfaceFrame` inside the tabs. Bring the panel onto the design system: fields in `<Card variant="module">`, a consistent Save + saved/error feedback, no bespoke `<CardFooter>` toolbar.

It ships in **two presentations of the same model**:

1. **The in-app form surface (the "F layout")** — the default for every form/wizard launched _inside_ the dashboard. A working pane on the dashboard's normal surface language, with a compact progress strip and an optional **live summary** column. It renders **inside the app chrome** (sidebar + header stay put), so "full page" never means "escape the app." The same frame backs a full page, a drawer, and a modal — _learn one, know all_.
2. **The immersive rail** — a full-bleed two-pane frame with a flat module-colored **left rail**, owning the whole viewport. Reserved for **first-run onboarding / blueprint install**, where there is no app chrome yet and the branded moment fits.

This doc owns the **layout**. The **flows** inside it (which steps, which fields, validation) are owned by their feature docs — onboarding by [docs/15](15-merchant-onboarding-prd.md), the create-wizards by [docs/68](68-wizards-import-export-bulk.md). The **wiring** of a form into the drawer/modal/full-page system is the [`form-surface`](../.claude/skills/form-surface/SKILL.md) skill.

> **v3 change:** the in-app presentation moved from a dark left rail (v1) → a horizontal numbered top stepper (v2) → the **F layout** (v3): a compact segmented progress strip, a form column, and an optional live **summary** column that earns the width instead of leaving it empty. Cancel moved into the bottom toolbar; the embedded full page became a contained, centered sheet. The numbered top stepper survives only in the self-owned `modal` variant (any stand-alone dialog wizard not wired to the detail panel). The immersive rail (onboarding) is unchanged.

---

## 1A. Form strategy (2026) — one form · three USER-picked surfaces · single-page · editor ≠ form

Locked 2026-06-28 after a 2026 form-UX research pass (drawers are the converging admin-CRUD default; modals are for short input/confirmation; full-page for genuinely complex; explicit-save is the default for transactional records; multi-step wizards only when the flow is sequential/branching **and** infrequent). Three product decisions now govern which shape any surface takes — the remaining migration is tracked as **WS1–WS5** in [docs/105](105-form-modal-surface-inventory.md):

1. **Three surfaces, the USER picks — and that's the differentiator.** Every create/edit honors the operator's `defaultDetailView` preference (drawer / modal / full-page / new tab), resolved by `EntityCreateButton`. Most design systems force the container by field-count; sparx lets the operator choose their working surface and applies it platform-wide. It's safe across all three because the `modal` variant is a **large ~920×680 canvas**, not a cramped dialog — so the documented "complex form crammed into a tiny modal" failure mode is largely neutralized. We **keep and lean into** this integration; it does not get traded away for a complexity-driven auto-picker.
2. **Single-page by default; a wizard must be EARNED.** A form is **one well-structured scroll** — grouped `<Card variant="module">` sections plus its live summary — **not** a stepper. The `steps`/MiniProgress machinery is reserved for flows that are genuinely **sequential/branching and infrequent**: **first-run onboarding, blueprint/new-site install, and product creation.** Product is the canonical _earned_ in-app wizard — a **progressive-draft** flow, not a flat form: Basics creates a real draft, then each later step (Variants, Media, Fitment, Organization) attaches relations to the **real** product via the same endpoints as the detail tabs, it **branches** by fulfillment type, and Review publishes; it is sequential-dependent, so it stays a stepper. The other record-builder "wizards" (quote, order, purchase-order, transfer, billing-document, customer, b2b-account) **collapse to single-page** (WS1) — which is also what lets them render well in a drawer or modal (a stepped wizard only really works full-page), so collapsing is precisely what makes decision (1) pay off across all three surfaces.
3. **Editors are not forms.** Visual canvases — the page builder, the automation flow canvas, the broadcast composer, the configurator template editor, the CMS schema-editor and menu-editor, the scheduling availability editor — are **out of the form system**. They keep their own purpose-built chrome and are excluded from the migration backlog (WS3); never wrap one in a `SurfaceFrame` or a wizard.

Unchanged by the strategy: the **save model** (explicit Save + the `useUnsavedGuard` leave-guard — §5) and the F-layout itself. What changes is only _how many steps a form has_ (one, unless earned) and _who chooses the container_ (the user, always).

---

## 2. The F layout (in-app default)

```
┌──────────────────────────────────────────────┬───────────────┐
│  New quote                          ⤢  ▢  ✕   │               │ ← header
├──────────────────────────────────────────────┤  Draft        │
│  ▰▰▱▱   Bill to · step 1 of 4                  │  summary      │ ← MiniProgress
│                                                │               │
│   Step headline                                │  Quote for —  │ ← summary
│   Supporting line                              │  Currency USD │   (optional,
│   ┌────────────────────────────────────────┐  │  Line items 0 │    full height,
│   │  the step's fields                      │  │  ─────────────│    module tint)
│   └────────────────────────────────────────┘  │  Total  $0.00 │
│                                                │               │
├──────────────────────────────────────────────┤  ● Draft —    │
│  Cancel                          [ Continue ]  │    editable   │ ← toolbar (form col)
└──────────────────────────────────────────────┴───────────────┘
```

- **Header — the constant identity.** The form's title on the left (e.g. "New quote"); window controls on the right with **Close last** (the corner): maximize → switch drawer/modal → close. In the `inline` (drawer/modal) presentation the **host chrome supplies this header**. The `embedded` full page renders the title plus, in a right-aligned **`headerActions`** slot, a **presentation switch** (open this record as a drawer/modal) — parity with the overlay so all three presentations can reach each other. **Close and Maximize stay off the full page**: the breadcrumb + back already close it, and it can't maximize what's already maximized. (Switching is dirty-guarded — see §5.)
- **MiniProgress (below header) — the progress.** A row of segments filled through the current step, then **"{label} · step _n_ of _N_"**. Display-only and compact; on a multi-step form it orients without competing. (Single-step forms omit it.)
- **Form column — the variable.** A left-aligned step headline + supporting line, the step body, then the action toolbar. The body **scrolls internally**; header, progress, and toolbar stay put. Content centers on a readable column (`max-w-3xl`). Fields are grouped in module-tinted **`<Card variant="module">`** cards (`bg-module bg-soft` — a subtle theme-aware tint, not a stripe) — the same on every create surface, so the active module reads at a glance and a cross-module flow shows which card belongs to which module. The tint is automatic via `<ModuleProvider>`; never bare fields or a plain neutral card.
- **Summary column — the quiet reference (optional).** A module-tinted right column that runs **full height** beside the form, building live as the user fills (e.g. a quote's party, line count, subtotal, total + a draft badge). It turns the horizontal space into something useful instead of a dead gutter. Omit it for forms without a natural summary — the form then fills the width.
- **Action toolbar (pinned, under the form column only).** **Cancel is ALWAYS the leftmost button** — the same anchor on every surface (create, edit, wizard) so a user never hunts for it — with **Back** beside it; **both frame-owned ghost `<Button>`s** (pass `onCancel`; never hand-roll a cancel `<button>`). An edit form's **destructive action (Delete)** rides the toolbar's **`destructive`** slot in the left cluster **after** Cancel/Back — danger-styled, left-of-center and away from the primary so it can't be mis-clicked, and **never** buried in the read-only summary aside. The primary advance is on the right (`color="module"`); Skip sits beside the primary when a step is genuinely optional. The summary column runs to the floor beside it.
- **Single-step forms are the same surface.** A one-screen create form is a **one-step `SurfaceFrame`**, not a different shell: pass a single `step`, the **MiniProgress auto-hides**, and the toolbar is **Cancel + the primary** (no Back). Title, window controls (↗ □ ✕, Close last), and the pinned floor toolbar all come from the frame — never a `<CardFooter>` toolbar inside the body and never a page-level title repeated under the chrome (the old double-header). Its `/new` page renders the form directly (no `Container`/`PageHeader`).

**Why the F layout:** a centered form in a wide modal/page leaves dead side gutters; a tall frame on a short step leaves a dead vertical void; a dark side-rail competes with the app's own nav. The F layout fixes all three — the form fills its column, the summary earns the rest of the width, and there is one cohesive header and one bottom toolbar.

---

## 3. The three in-app presentations (same F layout)

All three render the identical frame; only the host differs.

| Variant    | Host                                                                                                                  | Header                                                | Used by                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `embedded` | In-flow, fills the dashboard **content area** as a **contained, centered sheet** (capped width, page bg on the sides) | Title strip + presentation switch (no Close/Maximize) | The full-page `/new` and `/{id}` detail routes — the "full page" option |
| `inline`   | Fills a **drawer / modal detail panel** that supplies the chrome                                                      | Host chrome (title + window controls)                 | The create overlays (the `@detail` slot), picked by `defaultDetailView` |
| `modal`    | A **self-owned Radix dialog** (numbered top stepper, not the F layout)                                                | Own header                                            | Stand-alone dialog wizards not wired to the detail panel                |

### How a form chooses

Each form takes a `presentation` prop and renders one frame:

```
variant={presentation === 'overlay' ? 'inline' : 'embedded'}
```

- The `/new` route renders `presentation="page"` → `embedded`.
- The dashboard "New X" button (`EntityCreateButton`) resolves the user's `defaultDetailView` (drawer / modal / full page / new tab). Drawer + modal open the form as `inline` inside the `@detail` panel; "full page" navigates to `/new` (`embedded`); new tab opens it there. See [docs/24](24-dashboard-shell.md) and the detail-view registry.

### Modal width keys off the form, not a constant

The drawer/modal host sizes the dialog by purpose (`detail-registry`):

- **Create + has a summary** (`SUMMARY_CREATE_TYPES`) → wider dialog (`~960px`) so form + summary both fit.
- **Create, no summary** → tighter dialog (`~720px`) so a lone form never floats with gutters.
- **Single-form edit detail** (category, `isSingleFormDetail`) → `~960px` so the lone form doesn't stretch.
- **Tabbed record detail** → the full canvas (`~1200px`); when it carries a context rail (§5.2) it renders full-bleed and takes a **definite** `88vh` height so its inner tab column scrolls correctly (not the content-hug `max-h`).

A create form joins `SUMMARY_CREATE_TYPES` **only once it actually passes a `summary`** — otherwise the wide dialog frames a narrow form with empty gutters.

### Responsive — by CONTAINER width (the top-2 rule)

The split is a **container query (`@container` + `@[720px]`), not a viewport media query** — so a narrow drawer collapses even on a wide screen:

- **≥ 720px (modal, full page, wide drawer):** two columns — form + full-height summary aside.
- **< 720px (narrow drawer, small viewport):** one column — the summary **stacks as a card** after the fields; the toolbar stays pinned at the bottom.

---

## 4. The immersive rail — `variant="page"` (onboarding only)

```
┌──────────────┬───────────────────────────────────────┐
│   RAIL       │  Step headline                         │
│  (module     │  Supporting line                       │
│   color)     │                                        │
│  wordmark    │  ┌─────────────────────────────────┐  │
│  lede        │  │   WORKING PANE                   │  │
│  ① done      │  │                                  │  │
│  ② current   │  └─────────────────────────────────┘  │
│  context     │  [ Back ]               [ Continue ]   │
└──────────────┴───────────────────────────────────────┘
```

The full-bleed two-pane frame with a flat module-colored left rail (brand wordmark + a per-step lede + the vertical journey + a context blurb), owning the whole viewport (`340px` rail + `1fr` pane, `100vh`). Reserved for **first-run onboarding / blueprint install** — there's no app chrome to keep, and the branded, immersive moment fits the once-per-tenant setup.

- Rail color follows `<ModuleProvider>` (`--color-module`), a flat solid fill (no gradient). Onboarding is Builder Indigo. The wordmark "x" stays sparx Indigo (brand rule).
- Below ~940px the rail collapses to a slim top bar with dot progress (`RailTopBar`).
- The rail (`RAIL_BG`, `RailWordmark`) shares one source of truth with the auth split-panel via `brand-rail`.

### When to use the rail vs. the F layout

| Use the **immersive rail** (`page`)            | Use the **F layout** (`embedded`/`inline`)   |
| ---------------------------------------------- | -------------------------------------------- |
| User is not yet in the app (first-run setup)   | User is already working in the dashboard     |
| Once-per-tenant onboarding / blueprint install | Repeated, on-demand create/edit of an object |
| The flow _is_ the destination                  | The flow returns you to where you were       |

---

## 5. Shared rules (every presentation)

- **Progress is always visible** on a multi-step flow — MiniProgress (F layout) or the rail journey (onboarding). No floating "Step 2 of 4" badge invented elsewhere.
- **One headline pattern.** Left-aligned heading + muted supporting line at the top of the pane. No centered hero stacks; **no uppercase mono eyebrows** (no-eyebrows rule) — that includes the summary's heading.
- **One bottom toolbar.** **Cancel is the leftmost anchor** (same place on every surface), Back beside it, then any **destructive action** (Delete) in the `destructive` slot — danger-styled, after Cancel/Back, away from the primary; primary right (`color="module"`), Skip beside the primary. Never a second Cancel/Close in the body when the host chrome already has one; never a Delete in the summary aside.
- **The summary is a reference, not a step.** It never holds inputs **or actions** (no Delete) and never the primary action; it mirrors what the form is building — and for an edit, it's a **live summary of the record**: the same values you edit in the fields/tabs (handle, price, status, scope) plus derived rollups (counts, totals, low-stock). "Read-only" describes the **presentation, not the data** — the panel is non-editable, but everything in it is editable in its own field/tab; it's there for orientation, so the whole record stays in view while you work one part. It's an optional slot — present it only when the record has a natural running summary, and it's the **strongest** on complex entities (a product spanning pricing, variants, media, inventory, fitment, and multi-site scope) where the rollup is what makes the parts cohere.
- **Status + lifecycle actions live in the frame header, not an in-body card.** A detail surface's status badge and lifecycle actions (Publish / Unpublish / Archive / Restore, plus Preview / Revisions / Schedule) render in the frame header — the drawer/modal chrome or the full-page shell — via the **detail header-slot** (§5.1), never a bespoke "Status" card stacked atop the form. In the header the **status badge + the primary action keep their text label; secondary actions go icon-only with a tooltip** so the cluster fits one row. The bottom toolbar stays for form submission only (Save/Create + Cancel + Delete) — lifecycle is header-only.
- **Identity appears exactly once.** An entity's name/title (+ slug/handle) lives ONLY in its editable form field — never ALSO as a read-only heading atop the body (the duplication reads as "which one is authoritative?" and wastes the space). The drawer chrome's type label and the full-page back-link carry context; the field carries the value. Applies only where the redundancy exists — **read-only / transaction details** (orders, quotes, carts, inventory ops) have no editable name field, so their identity heading stays; it's the sole place the name lives.
- **Unsaved edits are guarded (edit surfaces).** A form that can hold unsaved changes registers ONE dirty-guard (its `dirty` check + a `useConfirm` discard dialog) via the dashboard's `UnsavedGuardProvider` / `useRegisterLeaveGuard`; **every** leave path consults it — the frame-owned Cancel, the overlay host's Close/Switch/backdrop-Esc, and the full-page presentation switch. Wired once on the platform, not per page (docs/105 platform gaps). Not covered: a hard browser nav (`beforeunload`).
- **Motion:** the working-pane content does a small `fadeUp` on step change (~0.3s); the progress/rail is static. Respect `prefers-reduced-motion`.
- **State is preserved on Back.** Going back never clears entered data.
- **Tokens only.** Geist; module color via `--color-module` (set by `<ModuleProvider>`); neutrals from `@sparx/brand/theme.css`, radii/spacing from `@wizeworks/ui` tokens — no hardcoded colors. The summary tint is the `bg-module bg-soft` treatment (theme-aware `color-mix`).

### 5.1 The detail header slot (teleport)

The detail BODY is server-rendered and mounts in three frames — the drawer chrome, the modal chrome, and the full-page shell — each of which owns the header bar. So the body declares its header content (status + lifecycle actions) ONCE and it renders in whichever frame is active, instead of restating the entity's name/handle as an in-body header (the duplication §5 forbids). The frame renders a `<DetailHeaderSlotTarget>` in its header bar; the body renders `<DetailHeaderSlot>{…}</DetailHeaderSlot>` anywhere and its children **portal** into the target (children-based, not a props API). A `<DetailChromeProvider>` wraps both and holds the portal node — two contexts (one for the setter, one for the node) keep the registering ref stable so a node change can't thrash it.

- **Drawer / modal:** the chrome ([`detail-panel.tsx`](<../apps/dashboard/app/(dashboard)/_components/detail-panel.tsx>)) renders the slot target between its type label and the window controls — backward-compatible, an empty slot is a zero-width flex child.
- **Full page:** [`DetailPageShell`](<../apps/dashboard/app/(dashboard)/_components/detail-page-shell.tsx>) is the equivalent host the full page otherwise lacks — a back-link to the list, the same slot target, and the drawer/modal presentation switch, all under the module tint + the unsaved-edits guard. `listHref`/`listLabel` override the back-link when `routePrefix` isn't the list route (e.g. CMS `page` lives at `/cms` but lists at `/cms/content`).

It serves **every** detail body — single-form edits (`SurfaceFrame`) AND tabbed detail bodies (product, collection, CMS). Source: [`detail-header-slot.tsx`](<../apps/dashboard/app/(dashboard)/_components/detail-header-slot.tsx>).

### 5.2 The detail footer slot + the context rail (tabbed records)

Two more pieces complete the detail frame, both on the same teleport substrate as §5.1.

**The footer slot (the floored toolbar).** A detail/edit body's primary action (Save) pins to the frame's **bottom edge**, not scrolling away with the form — and a `position: sticky` bar _inside_ the scroll body can't reach the modal floor. So the body renders `<DetailFooterSlot>{bar}</DetailFooterSlot>` and the bar **portals** to a `<DetailFooterSlotTarget>` the frame floors below the scroll body (zero-height until a form supplies one); the portaled submit button re-associates to its form via the HTML `form="<id>"` attribute. The target is wrapped in the entity's `<ModuleProvider>` so a `color="module"` Save reads the module hue — **CSS vars cascade by DOM, not the React tree**, so a target outside the body's own provider would fall back to `:root` indigo and mismatch the header's Publish. Lifecycle stays in the header (§5.1); the footer carries only Save + its result.

**The context rail (a tabbed record's summary).** A **complex tabbed record** — one spanning many panels (a product: pricing, variants, options, media, inventory, fitment, multi-site) — carries a persistent **context rail**: a full-height summary aside beside the tabs, built from the same `SurfaceSummary` / `SurfaceSummaryRow` / `SurfaceSummaryDivider` primitives and the same `bg-module bg-soft` tint as the create wizard's draft summary, so the whole record stays in view while you work one tab. It is a **non-editable presentation of editable state** — handle, price, counts, inventory totals, reach — mirrored read-only for orientation; every value is edited in its own tab, never in the rail (§5 "the summary is a reference"). A simple record (a few facts) doesn't need one; the rail earns its width on records whose rollup is what makes the parts cohere.

**Tabbed records render full-bleed so the rail fills.** The rail only fills its column edge-to-edge (instead of floating as a card) when the body is a **fixed-height two-pane**, which is what full-bleed provides. So a tabbed record with a context rail joins `FULL_BLEED_DETAIL_TYPES` (`detail-registry`): the host hands it the whole body edge-to-edge, and `_content` owns a `flex h-full` two-pane — a scrolling tab column on `--color-base-200` + the full-height tinted aside — collapsing to one column with the rail stacked under the tabs on a narrow host. Two consequences in the modal host ([`detail-panel.tsx`](<../apps/dashboard/app/(dashboard)/_components/detail-panel.tsx>)): a tabbed full-bleed detail keeps the **wide** canvas (`~1200px`, gated by `isSingleFormDetail` so single-form edits stay narrow at `960px`), and it takes a **definite height** (`h-[88vh]`, not the content-hug `max-h-[88vh]`) so the inner column has a real height to scroll against — without it the hug-content modal leaves the scroll height indefinite and the form runs _under_ the floored toolbar (the drawer is unaffected — its panel is already a definite `h-full`). Single-form full-bleed details and the create wizards manage their own internal scroll + toolbar, so they keep the content-hug. Source: [`detail-header-slot.tsx`](<../apps/dashboard/app/(dashboard)/_components/detail-header-slot.tsx>), [`detail-registry.ts`](<../apps/dashboard/app/(dashboard)/_shell/detail-registry.ts>).

---

## 6. Implementation shape

A single `@wizeworks/ui` primitive — [`SurfaceFrame`](../packages/ui/src/components/navigation/surface-frame.tsx) — backs all presentations so they cannot drift:

```tsx
<SurfaceFrame
  variant={presentation === 'overlay' ? 'inline' : 'embedded'} // | 'modal' | 'page'
  title="New quote" // shown by the embedded title strip / self-owned modal
  steps={[{ key, label, sublabel }]}
  current={current}
  onCancel={close} // F layout: frame renders a ghost Cancel Button in the toolbar
  summary={summaryNode} // F layout: the live right-hand column (optional)
>
  <SurfaceStep header={{ title, supporting }} actions={{ onBack, onNext, onSkip }}>
    …step body…
  </SurfaceStep>
</SurfaceFrame>
```

The summary is composed from exported primitives so every form's summary looks identical:

```tsx
const summary = (
  <SurfaceSummary
    title="Draft summary"
    footer={
      <Badge color="module" variant="soft" size="sm">
        Draft — editable after create
      </Badge>
    }
  >
    <SurfaceSummaryRow label="Quote for" value={party} />
    <SurfaceSummaryRow label="Line items" value={String(count)} />
    <SurfaceSummaryDivider />
    <SurfaceSummaryRow label="Total" value={money(total)} strong />
  </SurfaceSummary>
);
```

- `inline` / `embedded` render the F layout (`embedded` as a contained centered sheet; `inline` filling its host). `modal` renders the numbered top-stepper shell inside a Radix Dialog. `page` renders the immersive rail grid.
- `SurfaceStep` adapts to the frame: the F variants give it a **scrolling body + a pinned bottom toolbar** (the frame-owned ghost Cancel Button seated left, via `onCancel` in context) and stack the summary as a card when narrow; the `page` rail gives it a flowing centered column.
- Module color flows from the surrounding `<ModuleProvider>`; the wrapper carries `h-full` so the frame fills its host.
- **Who mounts what:** onboarding ([docs/15](15-merchant-onboarding-prd.md)) → `page`. The create-wizards (Product, Quote, Order, …) → `embedded` at `/new`, `inline` in the detail panel (with a `summary` for record-building wizards). The New-site wizard → `embedded` at `/settings/sites/new`, `inline` in the detail panel (via `EntityCreateButton` + the `@detail` create registry — it no longer self-owns a modal).

---

## 7. Cross-references

- [`form-surface` skill](../.claude/skills/form-surface/SKILL.md) — the step-by-step procedure to wire a form into drawer/modal/full-page and apply this layout.
- [docs/15](15-merchant-onboarding-prd.md) — onboarding, the canonical immersive-rail instance.
- [docs/68](68-wizards-import-export-bulk.md) — the create-wizard flows.
- [docs/24](24-dashboard-shell.md) — the dashboard shell + the `@detail` drawer/modal create overlays and `defaultDetailView`.
- [docs/34](34-dashboard-working-area-standard.md) — dashboard working-area archetypes (the form is the guided-flow archetype).
- [docs/23](23-frontend-component-architecture.md) · [docs/35](35-ui-variant-system.md) — component architecture and the four-axis variant system the chrome is built on.

## 8. Status

**Built.** `SurfaceFrame` (`@wizeworks/ui`) ships the F layout (`inline`/`embedded`) with the `summary` slot + `SurfaceSummary` primitives, the numbered self-owned `modal`, and the immersive `page` rail. Product and Quote create-wizards pass a live summary; the remaining line-item wizards (Order, PO, Transfer, Billing-document) render the form-only F modal until their summaries are wired. The **detail header-slot** (§5.1) + `DetailPageShell` are built and applied to product, collection, and the CMS page/entry editors — their in-body Status cards / identity headings removed, lifecycle actions teleported to the header. **Settings → Sites** (docs/49) now runs on the list substrate + a per-site tabbed detail (General / Domains / Modules, on the builder manifest), and the **New-site wizard renders through the surface system** — `embedded` at `/settings/sites/new`, `inline` in the drawer/modal via `EntityCreateButton` (no longer a self-owned modal).
