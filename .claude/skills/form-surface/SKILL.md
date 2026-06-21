---
name: form-surface
description: Build or convert a dashboard form (create or edit) so it renders through the drawer / modal / full-page detail-view system and wears the F layout (form column + optional live summary). Use when adding a "New X" / edit flow, converting a full-page form or a single-step form into the overlay system, building a multi-step wizard, or when a form looks inconsistent (double header, dead side gutters, empty vertical void, Cancel in the wrong place). Encodes the three-registries-in-sync footgun and the summary↔width coupling.

The killer footgun: a create overlay is wired in THREE places that must stay in sync (`createComponents` in detail-slot, the `*_CREATE_TYPES` sets in detail-registry, the manifest `entityTypes` entry). Miss one and the "New" button silently hard-navigates to `/new` instead of opening the overlay, or the modal opens empty, or the maximize/title chrome is wrong — all with a green typecheck.
---

# Wire a form into the drawer / modal / full-page surface

Design spec: [docs/86](<../../../docs/86-wizard-layout-pattern.md>) (the F layout). This skill is the **procedure**; docs/86 is the **why**. Apply both.

## 0. Decide what you're building

| Kind | Frame | Full-bleed? | Example |
| --- | --- | --- | --- |
| **Multi-step wizard** (≥2 steps, or a record you build up) | `WizardFrame` F layout (`inline`/`embedded`) | **yes** | product, quote, order |
| **Single-step form** (one screen of fields) | a plain `…CreateForm` with a `surface` prop, in the host's padded body | no | collection, segment, redirect |

Then: **does the record have a natural running summary** (party, totals, counts, status)? If yes → it's a wizard with a `summary` slot **and** joins `SUMMARY_CREATE_TYPES` (wider modal). If no → omit the summary; the form fills the width.

Create vs edit: both use the same frame. Create writes the `?drawer=type:new` token (sentinel id `new`); edit opens the record's detail view. This skill covers the create surface end-to-end; an edit form reuses the same `WizardFrame`/form component with `presentation`/`surface`.

## 1. Build the form component

- Take a presentation prop: a wizard uses `presentation?: 'page' | 'overlay'`; a single-step form uses `surface?: 'page' | 'overlay'`.
- Wrap in `<ModuleProvider module="<module>" className="h-full">` so the chrome adopts the module accent and the height carries through.
- **Wizard:** render [`WizardFrame`](<../../../packages/ui/src/components/navigation/wizard-frame.tsx>) with `variant={presentation === 'overlay' ? 'inline' : 'embedded'}`, a `footer={cancelButton}` (it seats in the bottom toolbar), `steps`/`current`, and `<WizardStep header actions>` per step. Compose every step's content; commit in one action on finish; on success `router.push('/.../{id}')` (navigation clears the overlay token). `close()` clears `drawer`/`modal` params in the overlay, or `router.push('/list')` on the page. Copy the shape from [`product-wizard/index.tsx`](<../../../apps/dashboard/app/(dashboard)/commerce/products/_components/product-wizard/index.tsx>) or [`quote-wizard.tsx`](<../../../apps/dashboard/app/(dashboard)/crm/quotes/new/_components/quote-wizard.tsx>).
- **Single-step:** a form that renders its own submit/cancel inside the host's padded body. Copy `collection-create-form.tsx`.

## 2. The summary slot (wizards with a natural summary)

Compose it from the exported primitives so every summary looks identical — never hand-roll the styling:

```tsx
const summary = (
  <WizardSummary title="Draft summary" footer={<Badge color="module" variant="soft" size="sm">Draft — editable after create</Badge>}>
    <WizardSummaryRow label="Quote for" value={party} />
    <WizardSummaryRow label="Line items" value={String(count)} />
    <WizardSummaryDivider />
    <WizardSummaryRow label="Total" value={money(total)} strong />
  </WizardSummary>
);
// …then <WizardFrame summary={summary} … >
```

It builds live from form state, holds **no inputs and no primary action**, and uses `strong` on the total row. The frame renders it as the full-height right column when wide and **stacks it as a card** when narrow (drawer) — automatically.

## 3. Wire it into the overlay system — THREE places, kept in sync

These three live next to each other and MUST agree. The footgun: a green typecheck hides any mismatch.

1. **[`detail-slot.tsx`](<../../../apps/dashboard/app/(dashboard)/_shell/detail-slot.tsx>)** — register the create component in `createComponents[typeId]`. If it needs server data (option lists, session), write a thin **async server wrapper** that fetches then renders the client form with `presentation="overlay"`. Also set `detailModules[typeId]` to the owning module (the slot renders OUTSIDE any module layout, so without this the accent defaults to storefront indigo).
2. **[`detail-registry.ts`](<../../../apps/dashboard/app/(dashboard)/_shell/detail-registry.ts>)** —
   - add the type to **`CREATE_VIEW_TYPES`** (so `EntityCreateButton` knows a drawer/modal create exists; absent → it falls back to hard-navigating `/new`),
   - add to **`FULL_BLEED_CREATE_TYPES`** if it's a `WizardFrame` (fills the body edge-to-edge; single-step forms are NOT full-bleed),
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