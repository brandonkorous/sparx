# sparx Platform — Form Surface Layout Pattern (`SurfaceFrame`)

**Version:** 3.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-21

---

## 1. Purpose

One layout language for every **form surface** in the platform — create and edit forms, the multi-step create-wizards (Product, Quote, Order, Customer, B2B Account, Document, Content, …), onboarding, blueprint installs, and any future setup sequence.

The primitive is **`SurfaceFrame`** (formerly `WizardFrame` — that name wrongly implied wizard-only and is retired). It is **single-step by default**; the `steps`/stepper machinery is an **opt-in** feature for multi-step flows (a wizard), never the identity. **Create and edit both use it.** Two edit sub-cases — getting this wrong nests a frame inside tabs:

- **The detail view IS a single edit form** (e.g. category — its `[id]/_content.tsx` renders only the form) → render the edit form as a `SurfaceFrame` so create + edit are symmetric. The host chrome supplies the title + window controls; the frame supplies the module-card body + Save/Cancel toolbar.
- **Editing is one tab/panel of a tabbed detail view** (e.g. collection Metadata, product Edit) → do **not** nest a `SurfaceFrame` inside the tabs. Bring the panel onto the design system: fields in `<Card variant="module">`, a consistent Save + saved/error feedback, no bespoke `<CardFooter>` toolbar.

It ships in **two presentations of the same model**:

1. **The in-app form surface (the "F layout")** — the default for every form/wizard launched _inside_ the dashboard. A working pane on the dashboard's normal surface language, with a compact progress strip and an optional **live summary** column. It renders **inside the app chrome** (sidebar + header stay put), so "full page" never means "escape the app." The same frame backs a full page, a drawer, and a modal — _learn one, know all_.
2. **The immersive rail** — a full-bleed two-pane frame with a flat module-colored **left rail**, owning the whole viewport. Reserved for **first-run onboarding / blueprint install**, where there is no app chrome yet and the branded moment fits.

This doc owns the **layout**. The **flows** inside it (which steps, which fields, validation) are owned by their feature docs — onboarding by [docs/15](15-merchant-onboarding-prd.md), the create-wizards by [docs/68](68-wizards-import-export-bulk.md). The **wiring** of a form into the drawer/modal/full-page system is the [`form-surface`](../.claude/skills/form-surface/SKILL.md) skill.

> **v3 change:** the in-app presentation moved from a dark left rail (v1) → a horizontal numbered top stepper (v2) → the **F layout** (v3): a compact segmented progress strip, a form column, and an optional live **summary** column that earns the width instead of leaving it empty. Cancel moved into the bottom toolbar; the embedded full page became a contained, centered sheet. The numbered top stepper survives only in the self-owned `modal` variant (e.g. New site). The immersive rail (onboarding) is unchanged.

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

- **Header — the constant identity.** The form's title on the left (e.g. "New quote"); window controls on the right with **Close last** (the corner): maximize → switch drawer/modal → close. In the `inline` (drawer/modal) presentation the **host chrome supplies this header**; the `embedded` full page renders just the title (the breadcrumb owns nav, so no window controls).
- **MiniProgress (below header) — the progress.** A row of segments filled through the current step, then **"{label} · step _n_ of _N_"**. Display-only and compact; on a multi-step form it orients without competing. (Single-step forms omit it.)
- **Form column — the variable.** A left-aligned step headline + supporting line, the step body, then the action toolbar. The body **scrolls internally**; header, progress, and toolbar stay put. Content centers on a readable column (`max-w-3xl`). Fields are grouped in module-tinted **`<Card variant="module">`** cards (the 3px module stripe) — the same on every create surface, so the active module reads at a glance and a cross-module flow shows which card belongs to which module. The stripe is automatic via `<ModuleProvider>`; never bare fields or a plain neutral card.
- **Summary column — the quiet reference (optional).** A module-tinted right column that runs **full height** beside the form, building live as the user fills (e.g. a quote's party, line count, subtotal, total + a draft badge). It turns the horizontal space into something useful instead of a dead gutter. Omit it for forms without a natural summary — the form then fills the width.
- **Action toolbar (pinned, under the form column only).** **Cancel** and **Back** on the left — **both frame-owned ghost `<Button>`s**, so Cancel always matches Back (pass `onCancel`; never hand-roll a cancel `<button>`). The primary advance is on the right (`color="module"`); Skip sits beside the primary when a step is genuinely optional. The summary column runs to the floor beside it.
- **Single-step forms are the same surface.** A one-screen create form is a **one-step `SurfaceFrame`**, not a different shell: pass a single `step`, the **MiniProgress auto-hides**, and the toolbar is **Cancel + the primary** (no Back). Title, window controls (↗ □ ✕, Close last), and the pinned floor toolbar all come from the frame — never a `<CardFooter>` toolbar inside the body and never a page-level title repeated under the chrome (the old double-header). Its `/new` page renders the form directly (no `Container`/`PageHeader`).

**Why the F layout:** a centered form in a wide modal/page leaves dead side gutters; a tall frame on a short step leaves a dead vertical void; a dark side-rail competes with the app's own nav. The F layout fixes all three — the form fills its column, the summary earns the rest of the width, and there is one cohesive header and one bottom toolbar.

---

## 3. The three in-app presentations (same F layout)

All three render the identical frame; only the host differs.

| Variant    | Host                                                                                                                  | Header                                | Used by                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `embedded` | In-flow, fills the dashboard **content area** as a **contained, centered sheet** (capped width, page bg on the sides) | Title strip (no window controls)      | The full-page `/new` (and `/{id}/edit`) routes — the "full page" option |
| `inline`   | Fills a **drawer / modal detail panel** that supplies the chrome                                                      | Host chrome (title + window controls) | The create overlays (the `@detail` slot), picked by `defaultDetailView` |
| `modal`    | A **self-owned Radix dialog** (numbered top stepper, not the F layout)                                                | Own header                            | Stand-alone wizards not wired to the detail panel (e.g. New site)       |

### How a form chooses

Each form takes a `presentation` prop and renders one frame:

```
variant={presentation === 'overlay' ? 'inline' : 'embedded'}
```

- The `/new` route renders `presentation="page"` → `embedded`.
- The dashboard "New X" button (`EntityCreateButton`) resolves the user's `defaultDetailView` (drawer / modal / full page / new tab). Drawer + modal open the form as `inline` inside the `@detail` panel; "full page" navigates to `/new` (`embedded`); new tab opens it there. See [docs/24](24-dashboard-shell.md) and the detail-view registry.

### Modal width keys off the form, not a constant

The drawer/modal host sizes the dialog by purpose (`detail-registry` `SUMMARY_CREATE_TYPES`):

- **Create + has a summary** → wider dialog (`~960px`) so form + summary both fit.
- **Create, no summary** → tighter dialog (`~720px`) so a lone form never floats with gutters.
- **Record detail** → the full canvas (`~1200px`).

A form joins `SUMMARY_CREATE_TYPES` **only once it actually passes a `summary`** — otherwise the wide dialog frames a narrow form with empty gutters.

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

- Rail color follows `<ModuleProvider>` (`--module-active`), a flat solid fill (no gradient). Onboarding is Builder Indigo. The wordmark "x" stays sparx Indigo (brand rule).
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
- **One bottom toolbar.** Cancel left, Back beside it, primary right (`color="module"`), Skip beside the primary. Never a second Cancel/Close in the body when the host chrome already has one.
- **The summary is a reference, not a step.** It never holds inputs or the primary action; it mirrors what the form is building. It's an optional slot — present it only when the record has a natural running summary.
- **Motion:** the working-pane content does a small `fadeUp` on step change (~0.3s); the progress/rail is static. Respect `prefers-reduced-motion`.
- **State is preserved on Back.** Going back never clears entered data.
- **Tokens only.** Geist; module color via `--module-active` (+ `-tint`, `-content`); neutrals/radii from `@sparx/ui` tokens — no hardcoded colors. The summary tint is `color-mix(module 6%, surface)`.

---

## 6. Implementation shape

A single `@sparx/ui` primitive — [`SurfaceFrame`](../packages/ui/src/components/navigation/surface-frame.tsx) — backs all presentations so they cannot drift:

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
- **Who mounts what:** onboarding ([docs/15](15-merchant-onboarding-prd.md)) → `page`. The create-wizards (Product, Quote, Order, …) → `embedded` at `/new`, `inline` in the detail panel (with a `summary` for record-building wizards). The New-site wizard → `modal`.

---

## 7. Cross-references

- [`form-surface` skill](../.claude/skills/form-surface/SKILL.md) — the step-by-step procedure to wire a form into drawer/modal/full-page and apply this layout.
- [docs/15](15-merchant-onboarding-prd.md) — onboarding, the canonical immersive-rail instance.
- [docs/68](68-wizards-import-export-bulk.md) — the create-wizard flows.
- [docs/24](24-dashboard-shell.md) — the dashboard shell + the `@detail` drawer/modal create overlays and `defaultDetailView`.
- [docs/34](34-dashboard-working-area-standard.md) — dashboard working-area archetypes (the form is the guided-flow archetype).
- [docs/23](23-frontend-component-architecture.md) · [docs/35](35-ui-variant-system.md) — component architecture and the four-axis variant system the chrome is built on.

## 8. Status

**Built.** `SurfaceFrame` (`@sparx/ui`) ships the F layout (`inline`/`embedded`) with the `summary` slot + `SurfaceSummary` primitives, the numbered self-owned `modal`, and the immersive `page` rail. Product and Quote create-wizards pass a live summary; the remaining line-item wizards (Order, PO, Transfer, Billing-document) render the form-only F modal until their summaries are wired.
