# Site Builder P-D — Unified Layouts Surface

**Version:** 1.0.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-01

> Implementation spec for **P-D** of the PageLayout tier (the revised Phase 4 in
> [docs/36-sitebuilder-layering-model.md](../36-sitebuilder-layering-model.md) §11). Builds on P-A
> (rename), P-B (target registry), and P-C (assignment & resolver). Architecture contract:
> [docs/30-sitebuilder-redesign.md](../30-sitebuilder-redesign.md); layering model: doc 36;
> tracker: [sitebuilder-redesign-plan.md](sitebuilder-redesign-plan.md).

---

## 1. Goal

Fold the four per-scope nav entries (Homepage / Product pages / Collection pages / Pages) into **one
Layouts surface organized by target** that lists the tenant's `PageLayout`s, lets a tenant **begin
from a Page Template** (the code-first catalog, doc 36 §10), and exposes the **per-target default**
control. This is what makes P-C's assignment picker non-thin: until now a target had only its single
`default` layout to pick; P-D lets a tenant create **many named layouts per target**, so the per-item
override (P-C, set from the item editor) and the per-target default (set here) both have alternates
to choose between.

**No migration.** Every FK to `PageLayout` (`SiteSection`, `SiteLayoutDefault`,
`SiteLayoutAssignment`) is already `onDelete: Cascade`, and multi-layout-per-target already snapshots
and resolves end to end (P-B `readDraft` stamps each section with its layout's `targetId` + `key`;
P-C `setDefault`/`readAssignmentSnapshot` already expose the default). P-D is a surface + the
service/route verbs it needs.

---

## 2. The model recap (what was already true)

- A **layout target** is an addressable kind of page (`site:home`, `commerce:product`,
  `commerce:collection`, `cms:content-page`, `cms:content-type:<id>`), with an optional `binding`
  (`product` | `collection`) that says what data its bound sections resolve against (doc 36 §4, P-B).
- A **`PageLayout`** is `(targetId, key)` → an ordered section list. `key` is `default` for a
  target's single layout, a slug for a standalone page, or a generated slug for a named alternate.
- The **resolver cascade** (site `resolveTemplateSections`): per-item override → per-target
  default → `default` key → code `DEFAULT_TEMPLATES` → empty (doc 36 §6, P-C).
- A **Page Template** (preset) is platform-authored; instantiating one produces an editable
  `PageLayout` (doc 36 §3). `DEFAULT_TEMPLATES` is the built-in product/collection composition.

---

## 3. What shipped

### 3.1 Schemas (`@wizeworks/sitebuilder-schemas`)

- **NEW `page-templates.ts`** — the code-first Page Template catalog (doc 36 §10):
  - `PageTemplate { id, name, description, binding: TargetBinding | null, sections: DefaultTemplateSection[] }`.
  - `PAGE_TEMPLATES`: `product-default` (→ `DEFAULT_TEMPLATES['commerce:product']`),
    `collection-default` (→ `['commerce:collection']`), `blank` (`binding: null`, empty).
  - `getPageTemplate(id)`; `pageTemplatesForTarget(targetId)` — a null-binding template fits every
    target, a bound template only its matching binding.
  - The two "standard" entries reuse the exact `DEFAULT_TEMPLATES` arrays, so a layout begun from
    them renders identically to today's seeded default.
- **`inputs.ts`** — `InstantiateLayoutInput { targetId, templateId, name?, key? }`,
  `RenamePageLayoutInput { name }`.

### 3.2 Service (`@wizeworks/sitebuilder`)

- `pageLayoutService`:
  - `getById(ctx, id)` → view | `NotFound` (RLS scopes to tenant).
  - `instantiate(ctx, rawInput)` — validate the template + binding-fits-target **inside** the tenant
    transaction (so a mismatch rejects, never throws synchronously), generate a unique `key`
    (`slugify(name)`, suffixed `-2`, `-3`, … on collision; or the explicit `key`), create the
    `PageLayout`, copy the template's sections into real `SiteSection` rows. Audit
    `sitebuilder.page_layout.instantiated`.
  - `rename(ctx, id, rawInput)` — label only; `key` is immutable (the snapshot/resolver identity).
  - `remove(ctx, id)` — delete; cascade removes sections + any default/assignment rows pointing at
    it, so the site cleanly falls back to the cascade.
- `assignmentService.listDefaults(ctx)` → `{ targetId, pageLayoutId }[]` (the surface's default
  badges).

### 3.3 api-rest

- `page-layouts.ts`: `POST /instantiate` (→ `{ pageLayout, sections }`), `GET /:id`, `PATCH /:id`
  (rename), `DELETE /:id`. Bodies validated by the service-layer Zod schemas — api-rest keeps **zero**
  `@wizeworks/sitebuilder-schemas` dep (the established route ↔ service boundary).
- `assignments.ts`: `GET /assignments/defaults`.

### 3.4 Site

- `resolveTemplateSections(snapshot, targetId, itemRef?, forcedKey?)` — `forcedKey` (preview only)
  renders a **specific** layout directly, bypassing the cascade, so the dashboard canvas can preview
  an alternate layout as itself. The code-default fallback now applies **only** to the canonical
  `default` key — a named alternate with no sections previews as **empty** (the tenant is building
  it), never as the seeded default. (Behaviour for the default key is unchanged → exact parity.)
- PDP + PLP pass `sparxLayoutKey` **only when a `sparxSitePreview` token is present** — a public
  visitor cannot pin a layout via query string.

### 3.5 Dashboard

- **`editor-shell.tsx`**: `EditorCanvasApi += setLayoutKey(key | null)`; the iframe query gains
  `&sparxLayoutKey=`. `CANVAS_SCOPES` drops the four old scopes and adds `/sitebuilder/layouts`;
  `FULL_WIDTH_EXACT = ['/sitebuilder/layouts']` makes the **index** full-width while its `/:id`
  children show the canvas.
- **Manifest**: the four nav entries → one `{ id: 'layouts', label: 'Layouts', icon: Layers }`. The
  global action becomes `sitebuilder.layout.create → /sitebuilder/layouts`. `entityTypes` emptied —
  the site `page` entity is **CMS-owned** (the `cms-editor` manifest declares `page` + its
  detail view; the old SB `page` entityType was a dead collision pointing at a deleted route).
- **NEW routes**:
  - `/sitebuilder/layouts/page.tsx` — full-width grouped-by-target index (`LayoutsIndex`). Resolves
    the `site:home` layout on load (idempotent) so Homepage always has an editable row.
  - `/sitebuilder/layouts/[layoutId]/page.tsx` — the canvas editor (`PageLayoutEditor`).
- **NEW components**:
  - `layouts-index.tsx` (client) — one `Card variant="module"` group per static target, the SB
    bordered-row idiom, module-color **Default** badges, per-row Edit / Set-as-default / Rename /
    Delete, a Page-Template catalog modal ("New layout") for bound targets, a slug prompt ("New
    page") for `cms:content-page`, and a "Customize" affordance for a bound target still on the
    built-in default.
  - `page-layout-editor.tsx` (client) — generalizes the old `LayoutScopeEditor`: wires the shared
    canvas for the layout's target (sample-data + `setLayoutKey` for bound targets; `/` for home;
    `/<slug>` for a page), then wraps the shared `SectionBuilder`.
- **`_lib`**: `getPageLayout` / `listLayoutDefaults` (api); `instantiateLayout` / `renamePageLayout`
  / `deletePageLayout` / `setLayoutDefault` / `clearLayoutDefault` (actions); `LayoutDefaultDto`
  (types).
- **Deleted**: the `homepage/`, `products/`, `collections/`, `pages/` routes (+ `page-slug-form`)
  and `layout-scope-editor.tsx`. Overview "Manage pages" → "Manage layouts".

---

## 4. The Layouts surface, by target

| Target                | Group behaviour                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site:home`           | One **Homepage** row → editor. (Resolve-or-created on index load; the home route renders by `pageKey 'home'`, so a single layout is the model.)                                           |
| `commerce:product`    | Multi-layout. **New layout** (Page-Template catalog), per-target **default** badge + Set-as-default, **Customize** the built-in when no `default`-key layout exists yet, Rename / Delete. |
| `commerce:collection` | Same as product.                                                                                                                                                                          |
| `cms:content-page`    | Per-slug pages. **New page** (slug = key), each renders at `/<slug>`. Rename / Delete. No default control (each page is its own URL).                                                     |

`cms:content-type:<id>` targets are **deliberately not** on this surface yet — content-type pages
don't render through layouts until layout-driven CMS authoring lands (doc 36 §8). The P-C picker in
the CMS entry editor stays write-only until then.

---

## 5. The forced-key preview (why it's needed)

A bound target can now have several layouts, but the canvas previews **one** sample path
(`/products/sample`). Without a hint, `resolveTemplateSections` would resolve the sample item to the
target's _default_ layout — so editing "Spotlight" would preview the default. `setLayoutKey(key)` →
`&sparxLayoutKey=` → the site's `forcedKey` makes the canvas show exactly the layout being
edited. It is gated to the preview token (public visitors can't use it) and only meaningful for bound
targets — `site:home` and `cms:content-page` preview by **path** (the home route and the `[...slug]`
route resolve by `pageKey`, not the cascade), so the editor sets `setLayoutKey(null)` for them.

---

## 6. Decisions

- **One-click instantiate.** Picking a Page Template creates the layout with the template's default
  name and drops straight into the editor — fastest path to "gold" (doc 36 §3). Renaming is a
  per-row action, not a creation gate.
- **`key` immutable.** Rename changes the label only; the key is the snapshot/resolver identity, so
  changing it would orphan published sections and assignments.
- **Delete cascades, never blocks.** Deleting any layout (including a `default`-key one) is allowed —
  the cascade drops its sections + default/assignment rows, and the site falls back to the
  seeded code default. The UI confirms (danger tone).
- **"New page" reuses `instantiate`.** A `cms:content-page` page is `instantiate(blank, key=slug)`;
  if the slug already exists the index navigates to it instead of suffixing.
- **No back-link** on the editor route — the contextual "Layouts" nav entry returns to the index
  (the dashboard working-area standard, docs/34). The editor header shows `target label / layout
name` for context.

---

## 7. Gate

typecheck (db unaffected; schemas / sitebuilder / api-rest / site / dashboard) + lint (0
errors) + format + **31/31** sitebuilder integration tests (6 new: instantiate product-default /
binding-mismatch / blank, getById + rename + remove, unknown-id, listDefaults). **No migration.** Not
committed/deployed — user-triggered.

---

## 8. Acceptance

- A per-item override **and** a per-target default both resolve at render — proven by P-C's
  `getDraftSnapshot` test (kept) + the site cascade.
- A Page Template instantiates into an editable `PageLayout` — `instantiate` test.
- The seeded default renders identically to today — `forcedKey === 'default'` keeps the
  `DEFAULT_TEMPLATES` fallback; named alternates preview honestly (empty when empty).
