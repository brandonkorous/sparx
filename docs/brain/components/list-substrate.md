---
title: SelectionList — the one list substrate (table ⇄ cards)
node: components
type: rule
status: active
applies-to: [dashboard]
sources:
  - packages/ui/src/components/data/selection-list.tsx
  - apps/dashboard/app/(dashboard)/_shell/preferences-types.ts
  - apps/dashboard/app/(dashboard)/_components/entity-row-link.tsx
  - apps/dashboard/app/(dashboard)/_components/entity-create-button.tsx
  - docs/34-dashboard-working-area-standard.md
---

When you list records, you use **`SelectionList`** — the ONE substrate that renders **both** a **table** and a **card grid** from the same `columns` + `card` definition. Not hand-rolled card rows.

This is the **twin of [[surface-frame]]**: the same *"the user picks the surface"* philosophy. Surfaces honor `defaultDetailView` (drawer / modal / full-page / new-tab); lists honor **`defaultListView`** (table / cards). Both preferences are set from the shell's global `⋯` **ActionsMenu**, applied platform-wide.

**The List archetype, assembled ([[page-archetypes]]):**

- `<PageHeader actions={<EntityCreateButton …/>}>` — the create action resolves `defaultDetailView` (so "New" opens as the user's chosen surface). Never a bespoke "New" button/modal.
- `<ListToolbar enableViewToggle />` — the Table ⇄ Cards switch + search/filter furniture.
- `view = ?view= ?? prefs.defaultListView` computed **server-side**; the page hands `rows + view` to a small `'use client'` `<XList>` that calls `SelectionList`.
- Row → detail via **`EntityRowLink`** (honors `defaultDetailView`), plus a trailing right-aligned `id: 'actions'` column ("Open"/"Manage").
- `<EmptyState>` when empty · `<ListPager total/>` for paging · `bulkActions` opt in the checkbox column + `BulkActionBar`.

`SelectionList` is a **pure `@sparx/ui` primitive** — it knows nothing about routing; the consumer injects links via `columns[].cell` / `card.title`. Canonical example: `crm/segments/_components/segments-list.tsx`; also `inventory/lots`.

**Why:** every list behaves identically (view toggle, selection, paging, empty state) and the operator's one preference reskins them all. Hand-rolled rows are how a list starts looking "off" even when the components are on-system.

**Known drift → migrate:** `settings/sites`, `settings/domains`, `settings/ai-integrations` hand-roll bespoke `Card`-row lists and skip this substrate entirely — no view toggle, no `defaultListView`, no `EntityRowLink`. Same *composition-level* drift as [[partner-pages-drift]]. Bring them onto `SelectionList` + `ListToolbar` + `EntityCreateButton`. Tracked in [[open-punch-list]].

**How to apply:** copy `segments-list.tsx`; define `columns` (SelectionColumn) + `card` (SelectionCard); keep the page a server component that computes `view` and renders the toolbar.

Related: [[surface-frame]], [[page-archetypes]], [[three-registries-footgun]], [[partner-pages-drift]]
