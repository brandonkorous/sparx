---
name: form-surface
description: Build or convert a dashboard form (create or edit) so it renders through the drawer / modal / full-page detail-view system and wears the F layout (form column + optional live summary). Use when adding a "New X" / edit flow, converting a full-page form or a single-step form into the overlay system, building a multi-step wizard, or when a form looks inconsistent (double header, dead side gutters, empty vertical void, Cancel in the wrong place). Encodes the three-registries-in-sync footgun and the summary↔width coupling.

The killer footgun: a create overlay is wired in THREE places that must stay in sync (`createComponents` in detail-slot, the `*_CREATE_TYPES` sets in detail-registry, the manifest `entityTypes` entry). Miss one and the "New" button silently hard-navigates to `/new` instead of opening the overlay, or the modal opens empty, or the maximize/title chrome is wrong — all with a green typecheck.
---

# Wire a form into the drawer / modal / full-page surface

Design spec: [docs/86](<../../../docs/86-surface-frame-pattern.md>) (the F layout). This skill is the **procedure**; docs/86 is the **why**. Apply both.

## 0. Decide what you're building

`SurfaceFrame` is the ONE layout for every form surface — **create or edit, single field-set or multi-step**. Steps are an opt-in feature, not the identity: pass one step and the stepper hides itself. (It used to be called `WizardFrame`; that name wrongly implied wizard-only and is gone.) Pick the shape:

| Kind | How | Full-bleed? | Example |
| --- | --- | --- | --- |
| **Single-step form** (one screen of fields) | `SurfaceFrame` with ONE step (no stepper) | **yes** | category create, tax zone |
| **Multi-step wizard** (≥2 steps, or a record you build up) | `SurfaceFrame` with `steps`/`current` (stepper shows) | **yes** | product, quote, order |

There is ONE form surface. The old "render a `<Card>` with a `<CardFooter>` toolbar in the host's padded body" pattern is retired (double headers, in-card toolbars, inconsistent chrome — docs/86): chrome title + window controls + pinned floor toolbar come from the frame; fields sit in a `<Card variant="module">`; the toolbar is Cancel + primary (+ Back when multi-step).

**Create vs edit — both use `SurfaceFrame`:**

- **Create** writes the `?drawer=type:new` token (sentinel id `new`); the form takes `surface`/`presentation: 'page' | 'overlay'`. Covered end-to-end below.
- **Edit** is the record's detail-view body. Two sub-cases — get this right or you'll nest frames inside tabs:
  - **The detail view IS a single edit form** (e.g. category — its `[id]/_content.tsx` renders only the form) → render it as a `SurfaceFrame` so create + edit are symmetric. The drawer/modal/full-page chrome supplies the title + window controls; the frame supplies the module-card body + the Save/Cancel floor toolbar.
  - **Editing is one tab/panel of a tabbed detail view** (e.g. collection Metadata, product Edit) → do **NOT** nest a `SurfaceFrame` inside the tabs. Bring the PANEL onto the design system instead: fields in `<Card variant="module">`, a consistent Save (`color="module"`) + saved/error feedback, no bespoke `<CardFooter>` toolbar.

Then: **does the record have a natural running summary** (party, totals, counts, status)? If yes → pass a `summary` slot **and** join `SUMMARY_CREATE_TYPES` (wider modal). If no → omit it; the form fills the width.

## 1. Build the form component

- Take a presentation prop: a wizard uses `presentation?: 'page' | 'overlay'`; a single-step form uses `surface?: 'page' | 'overlay'`.
- Wrap in `<ModuleProvider module="<module>" className="h-full">` so the chrome adopts the module accent and the height carries through.
- **Wizard:** render [`SurfaceFrame`](<../../../packages/ui/src/components/navigation/surface-frame.tsx>) with `variant={presentation === 'overlay' ? 'inline' : 'embedded'}`, `onCancel={close}` (the frame renders a ghost Cancel **`<Button>`** in the bottom toolbar — NEVER hand-roll a `<button>` cancel link; that drift is the whole reason docs/86 made Cancel frame-owned), `steps`/`current`, and `<SurfaceStep header actions>` per step. Compose every step's content; commit in one action on finish; on success `router.push('/.../{id}')` (navigation clears the overlay token). `close()` clears `drawer`/`modal` params in the overlay, or `router.push('/list')` on the page. Copy the shape from [`product-wizard/index.tsx`](<../../../apps/dashboard/app/(dashboard)/commerce/products/_components/product-wizard/index.tsx>) or [`quote-wizard.tsx`](<../../../apps/dashboard/app/(dashboard)/crm/quotes/new/_components/quote-wizard.tsx>).
- **Single-step:** the SAME `SurfaceFrame` with one `step` (MiniProgress auto-hides), `onCancel={cancel}`, and a single `<SurfaceStep header actions={{ onNext: submit, nextLabel: 'Create …' }}>` whose body is a `<Card variant="module">` of fields. Use controlled state (not `FormData`) so `onNext` submits; on success close the overlay / return to the list. Copy [`category-create-form.tsx`](<../../../apps/dashboard/app/(dashboard)/commerce/categories/_components/category-create-form.tsx>) — and the page route renders `<XCreateForm surface="page" />` with **no** `Container`/`PageHeader` (the embedded frame supplies the title).
- **Step bodies** (both kinds): group fields in **`<Card variant="module">`** — the 3px module stripe is the standard on every create surface (it's automatic via `<ModuleProvider>`, so it reads the active module and disambiguates cross-module surfaces). Don't render bare fields or a plain neutral card.

## 2. The summary slot (wizards with a natural summary)

Compose it from the exported primitives so every summary looks identical — never hand-roll the styling:

```tsx
const summary = (
  <SurfaceSummary title="Draft summary" footer={<Badge color="module" variant="soft" size="sm">Draft — editable after create</Badge>}>
    <SurfaceSummaryRow label="Quote for" value={party} />
    <SurfaceSummaryRow label="Line items" value={String(count)} />
    <SurfaceSummaryDivider />
    <SurfaceSummaryRow label="Total" value={money(total)} strong />
  </SurfaceSummary>
);
// …then <SurfaceFrame summary={summary} … >
```

It builds live from form state, holds **no inputs and no primary action**, and uses `strong` on the total row. The frame renders it as the full-height right column when wide and **stacks it as a card** when narrow (drawer) — automatically.

## 3. Wire it into the overlay system — THREE places, kept in sync

These three live next to each other and MUST agree. The footgun: a green typecheck hides any mismatch.

1. **[`detail-slot.tsx`](<../../../apps/dashboard/app/(dashboard)/_shell/detail-slot.tsx>)** — register the create component in `createComponents[typeId]`. If it needs server data (option lists, session), write a thin **async server wrapper** that fetches then renders the client form with `presentation="overlay"`. Also set `detailModules[typeId]` to the owning module (the slot renders OUTSIDE any module layout, so without this the accent defaults to storefront indigo).
2. **[`detail-registry.ts`](<../../../apps/dashboard/app/(dashboard)/_shell/detail-registry.ts>)** —
   - add the type to **`CREATE_VIEW_TYPES`** (so `EntityCreateButton` knows a drawer/modal create exists; absent → it falls back to hard-navigating `/new`),
   - add to **`FULL_BLEED_CREATE_TYPES`** — every create surface is now a `SurfaceFrame` (multi- or single-step), so they all fill the body edge-to-edge and pin their own floor toolbar,
   - add to **`SUMMARY_CREATE_TYPES`** ONLY once it actually passes a `summary` (this widens the modal; adding it without a summary frames a narrow form with empty gutters).
3. **Manifest `entityTypes`** (the module's `manifest.ts`) — an entry with `id`, `label`, `routePrefix`, and `hasDetailView: true` **only if** it also has a detail-view drawer. This drives the chrome title (`describeTarget`) and the maximize href (`routePrefix/<id>`). A create-only overlay (no detail view) still needs the entry, without `hasDetailView`.

## 4. Wire the launchers + the page route

- List "New X" button → [`EntityCreateButton`](<../../../apps/dashboard/app/(dashboard)/_components/entity-create-button.tsx>) (`entityType` + `newHref="/.../new"`), NOT a bare `<Button asChild><Link>`. It honors `defaultDetailView` (drawer/modal/page/new-tab) and the Alt/Shift/Cmd modifiers.
- The `/new` route renders the form with `presentation="page"` (a shared `wizard-data.ts` loader can feed both the page and the slot wrapper).

## 5. Design rules (don't re-skin — apply the system)

- **F layout, never a bespoke shell.** One header (title left, window controls right with Close last — supplied by the host chrome for `inline`). MiniProgress for multi-step. One bottom toolbar: Cancel left, Back, primary right (`color="module"`).
- **No eyebrows** (incl. the summary heading); left-aligned heading + muted supporting line. **Tokens only** — module color via `--module-active`; no hardcoded colors. Use `@sparx/ui` components/variants, never a hand-built fill+foreground control. See [docs/23](<../../../docs/23-frontend-component-architecture.md>) §1/§15 and [docs/35](<../../../docs/35-ui-variant-system.md>).
- **Responsive is automatic** via the frame's container query (2-col → 1-col stack). Don't add viewport media queries for the columns.

## 6. Verify — in ALL THREE presentations

Typecheck + lint are necessary but not sufficient; layout regressions only show on screen.

```bash
pnpm --filter @sparx/ui typecheck && pnpm --filter @sparx/dashboard typecheck
pnpm format && pnpm lint   # max-lines warnings never block; fix errors only
```

Then screenshot the live form (the user owns `pnpm dev` — don't start it) at each surface and check: no double header, no side gutters, no vertical void, summary builds/stacks correctly, Cancel in the toolbar:

- modal: `/<list>?modal=<type>:new`
- full page: `/<…>/new` (must be a **contained, centered sheet** — not edge-to-edge)
- drawer: `/<list>?drawer=<type>:new` (summary **stacks** below the fields when narrow)