# Sparx Platform — Navigation in the Builder

**Version:** 0.3 (P1 + migration + fallback removal BUILT; CMS-surface teardown deferred)
**Author:** Brandon Korous
**Last Updated:** 2026-06-05

> **Status: BUILT — UNPUSHED, gate-green.** Site **navigation** now lives on the
> Builder `NavMenu` node, not the CMS module: nav is site chrome, every site has
> it, and it works without the CMS module. Per-site falls out for free (Builder
> layouts are already `property_id`-scoped). Reverses the docs/45 §3 decision ("the
> Builder keeps no parallel nav"). **No CMS fallback remains** — existing data was
> migrated.
>
> **What shipped (2026-06-05):**
>
> - **Authoring (P1):** a shared `coerceNavLinks` normalizer
>   (`packages/builder-schemas/src/nav.ts`); the storefront renderer + editor
>   preview read node-owned `props.links`; a `navlinks` inspector control (label /
>   href / new-tab, add / remove / reorder); `site-ui` `NavMenu` honours
>   `openInNewTab`; the starter site layout seeds default node-owned links;
>   `NavMenu` is **non-bindable** (authors use the links editor, never a CMS
>   binding). Unit-tested (`nav.test.ts`).
> - **Migration (P2):** `20260706_nav_into_builder` converts every existing
>   CMS-menu-bound `NavMenu` node in `builder_layouts`/`builder_pages` trees
>   (draft + published) into node-owned `props.links`, mirroring the storefront's
>   exact resolution (top-level items, `external_url` else `/<slug>` for a
>   published non-deleted entry, else dropped; `open_in_new_tab` carried). Recursive
>   `jsonb` rewrite, looped per tenant with `set_config('app.tenant_id')` for
>   FORCE-RLS. **Verified end-to-end** against the local DB (seeded a real menu →
>   `migrate deploy` → 0 bound NavMenu nodes remain, links correct).
> - **Fallback removed (P2):** `loadSiteData` no longer resolves
>   `site.primaryNav`/`footerNav` (only identity + social); those two sources are
>   gone from `SITE_SOURCES`. The renderer's `coerceNavLinks` bound path stays only
>   as defensive normalization.
> - **CMS (P3, partial):** Navigation removed from the CMS module sidebar
>   (`@sparx/cms-editor` manifest); the `/cms/navigation` page is header-commented
>   DEPRECATED.
>
> **Still deferred (verified-in-prod teardown):** removing the dormant
> `/cms/navigation` page + `/v1/navigation/menus` routes + the
> `navigation_menus`/`navigation_items` tables (kept as a rollback net). **Open
> follow-on:** the marketplace **blueprints** still author `NavMenu` nodes bound to
> `site.primaryNav`/`footerNav`; with the fallback gone a fresh blueprint install
> renders empty nav (no regression — blueprints never created CMS menus, so their
> nav was already empty) and shows a blank links editor until re-authored. The
> blueprint definitions should seed node-owned `props.links` like the starter does.
> The phase table in §9 is the original plan; these inline notes are what's built.

---

## 1. Why — navigation is site chrome, not CMS content

Today navigation is **owned by the CMS module**. The data is `navigation_menus` /
`navigation_items` ([16-cms-navigation.prisma](../packages/db/prisma/schema/16-cms-navigation.prisma)),
the editor is `/cms/navigation`, and that whole surface is **gated behind the CMS
module** (`<ModuleGate module="cms">` in
[cms/layout.tsx](<../apps/dashboard/app/(dashboard)/cms/layout.tsx>)).

That's backwards. **A header/footer is site chrome — every site needs one
regardless of which modules it runs.** The clinching case:

> A **commerce-only tenant** (CMS module off) still needs a nav bar. Today they
> _cannot author one_ — `/cms/navigation` 404s for them, because nav is locked
> behind a module they don't pay for. Chrome can't depend on an _optional_ module.

The right home is the **Builder** — the site presentation layer that **every**
site has by definition (storefront, CMS-only, commerce-only, B2B — all author their
site in `/builder`). Re-homing nav there also makes it **per-site for free**:
Builder layouts already carry `property_id` (docs/49 Phase 1B), so a per-site nav is
just a per-site layout, which already exists.

This also fixes the original multi-site gap: under docs/49 the chrome nav was still
tenant-wide (one `navigation_menus` row per `(tenant, location)`), so every site of
a tenant rendered the **same** header/footer. Builder-owned nav is per-site by
construction.

---

## 2. Where navigation lives today — two structures

Navigation reaches the storefront through **two** different structures, and that
split is the problem:

### 2.1 The CMS menu (data + authoring) — CMS-owned, tenant-wide, module-gated

- **Tables:** `navigation_menus` (`id`, `tenant_id`, `location`, `name`; `@@unique([tenantId, location])`)
  - `navigation_items` (`label`, `entry_id` **xor** `external_url`, `parent_item_id` tree).
- **Editor:** `/cms/navigation` → per-location editor, **CMS-module-gated**.
- **Write API:** `PUT /v1/navigation/menus/:location`
  ([navigation/menus.ts](../services/api-rest/src/routes/v1/navigation/menus.ts)).
- **Read API:** `GET /v1/public/content/navigation/by-location/:location`
  - `…/navigation/:id` ([public/content.ts](../services/api-rest/src/routes/v1/public/content.ts)).
- One menu per `(tenant, location)` → **tenant-wide**.

### 2.2 The Builder `NavMenu` node (binding + render) — already exists

The Builder **already has a `NavMenu` node** (a leaf), and the starter **site
layout** already places it in the header/footer
([starters.ts](../packages/builder-schemas/src/starters.ts) `siteLayoutTree`):

```ts
node('NavMenu', { props: { orientation: 'row' }, bind: 'site.primaryNav' }); // header
node('NavMenu', { props: { orientation: 'row' }, bind: 'site.footerNav' }); // footer
```

The `NavMenu` node has **two** data paths
([builder-renderer.tsx](../apps/site/components/builder-renderer.tsx) `case 'NavMenu'`):

1. **Bound** to `site.primaryNav` / `site.footerNav` — an `array` source declared in
   [binding.ts](../packages/builder-schemas/src/binding.ts) `SITE_SOURCES`. The
   **data** for those paths is fetched per render by
   [loadSiteData](../apps/site/lib/builder-data.ts) → `getNavByLocation(tenant.slug, …)`
   → the CMS `navigation_menus` above. **This is the coupling to the CMS.**
2. **Unbound** — falls back to `props.links`, a **freeform textarea** (`Label|/url`,
   one per line, `parseNavLinks`). This path is _already_ Builder-native, per-site,
   and module-independent — but it's crude.

`binding.ts` says the quiet part out loud (docs/45 §3):

> "The SHAPE is fixed here; the DATA is fetched per tenant … from the platform's
> existing stores (TenantBrand, **NavigationMenu**) — the Builder keeps no parallel
> nav/brand."

**That decision is what we're reversing — for nav.** (Brand identity + social stay
bindings; see §3.4.)

### 2.3 Are they "two completely different structures"? Yes

|                    | CMS menu                                             | Builder nav                                            |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| Storage            | `navigation_menus` / `navigation_items` (relational) | nodes in the layout `draftTree`/`publishedTree` (JSON) |
| Authoring          | `/cms/navigation` (CMS-gated)                        | `/builder` (every site)                                |
| Scope              | `(tenant, location)` → tenant-wide                   | per `property_id` → per-site                           |
| Module             | requires CMS                                         | module-independent                                     |
| Reaches render via | `site.primaryNav` binding → resolver → CMS read      | the node's own `props.links`                           |

One is a normalized menu referenced by location; the other is Builder nodes authored
in place. Different tables, editor, ownership, scope.

---

## 3. Target architecture — the Builder `NavMenu` node owns its links

The `NavMenu` node becomes the **single source of truth** for chrome navigation. Its
links live in the node's own `props` (per-site, in the layout tree), authored in
`/builder` with a real link editor, rendered directly — no CMS, no `site.primaryNav`
binding.

### 3.1 Decisions (locked)

- **D1 — Nav is owned by the Builder `NavMenu` node, not the CMS.** Reverses
  docs/45 §3 for nav. The node's `props.links` is the source of truth; there is no
  `site.primaryNav`/`site.footerNav` binding anymore.
- **D2 — Links are a structured `props.links` array, not child nodes and not a
  freeform string.** Nav links are simple (label + target + new-tab, optional one
  level of children for dropdowns); a structured array is the right grain. Keeping
  `NavMenu` a **leaf** (not a container) avoids turning every link into a full
  styled node — nav styling is the node's job, not per-link.
- **D3 — A link target is a freeform `href` first** (exactly like the existing
  `Button.href`: `/about`, `/products/model-3`, `https://…`), plus `label` and
  `openInNewTab`. A structured **page/collection/product picker** is a follow-on
  (§11) — it needs the same target-picker the Button will eventually get, so we
  build it once, for both.
- **D4 — Migrate, don't strand.** Every tenant's existing CMS header/footer menus
  are backfilled into the `NavMenu` nodes of their **primary site's active layout**
  (§8), so no live site loses its nav.
- **D5 — Retire the CMS nav surface** after migration: `/cms/navigation`, the
  `navigation_menus`/`navigation_items` tables, the `/v1/navigation/menus` routes,
  the public nav read routes, the `site.primaryNav`/`site.footerNav` binding
  sources, and `getNavByLocation`/`loadSiteData`'s nav half (§9).

### 3.2 The nav-link data model (`props.links`)

`NavMenu.props.links` becomes a structured array (replacing the freeform string):

```ts
interface NavLink {
  label: string;
  href: string; // '/about' | '/products/x' | 'https://…' | '#'
  openInNewTab?: boolean;
  children?: NavLink[]; // one level of dropdown (optional; P1 renders flat)
}
// NavMenu.props: { orientation: 'row' | 'stack'; links: NavLink[] }
```

The renderer (`case 'NavMenu'`) reads `props.links` as a structured array. For
backward-compat it still accepts a legacy `string` (parse via `parseNavLinks`) and a
legacy bound array, so old/imported trees keep working through the transition.

### 3.3 Per-site, module-independent — for free

`NavMenu` links live in the layout `draftTree`/`publishedTree`. `BuilderLayout` is
already `property_id`-scoped and "one active per property" (docs/49 Phase 1B,
[51-builder.prisma](../packages/db/prisma/schema/51-builder.prisma)). So:

- **Per-site:** each site's active layout has its own header/footer `NavMenu` nodes.
  No new table, no `navigation_menus.property_id`, no per-site menu plumbing.
- **Module-independent:** authored in `/builder` (the Builder module, which every
  site has), never gated on CMS.

### 3.4 What stays a binding (NOT moving)

Only **nav** moves to node-owned. The other `site.*` sources stay bindings because
their data is genuinely platform-level, not Builder-authored:

- `site.identity` (brand name + logo) → `TenantBrand` (docs/30). The `Logo` node
  keeps `bind: 'site.identity'`.
- `site.social` → the tenant's social links setting. `SocialLinks` keeps
  `bind: 'site.social'`.

So `SITE_SOURCES` loses `primaryNav` + `footerNav`, keeps `identity` + `social`.

---

## 4. Authoring — the nav link editor (inspector)

The `/builder` inspector renders a node's editable fields from its registry
`props: PropSpec[]`, via control kinds that are currently **hard-coded**
(`text` / `textarea` / `select` / `buttongroup` / `switch` / `richtext` —
[inspector.tsx](<../apps/dashboard/app/(dashboard)/builder/_builder/inspector.tsx>)
`ComponentPanel`). There is no repeatable-list control yet.

**Add one new control kind: `navlinks`** — a small client editor for an ordered link
list:

- Rows of **label** + **target (href)** + **new-tab** toggle.
- **Add link**, **remove** (behind the standard `useConfirm`), **drag-reorder**
  (dnd-kit, the same pattern the Layers tree already uses).
- (Follow-on) **+ Add dropdown** to nest one level of children; **target picker** to
  choose a page/collection/product instead of typing an href (§11).

`NavMenu`'s registry def swaps its `links` prop from `textarea` → `navlinks`. This is
the one piece of genuinely net-new editor UI; it's deliberately scoped as the seed of
a general **repeater control** that future array props (FAQ, FeatureGrid) can adopt.

The editor edits the **active site's** layout already — the site switcher's
`x-sparx-property-id` flows through the Builder layout read/write, so a per-site nav
is automatic.

---

## 5. Storefront render — read the node, drop the CMS hop

- `case 'NavMenu'` ([builder-renderer.tsx](../apps/site/components/builder-renderer.tsx))
  renders from `props.links` (structured), keeping the legacy string/bound fallbacks
  during the transition. `@sparx/site-ui`'s `NavMenu` already takes
  `items: { label, url }[]` — P1 maps the structured links to that (flat; nesting is
  §11).
- [loadSiteData](../apps/site/lib/builder-data.ts) **stops** resolving
  `site.primaryNav`/`site.footerNav` (drops the `getNavByLocation` calls); it keeps
  `site.identity` + `site.social`.
- The fixed `SiteHeader`/`SiteFooter` fallback (used when a tenant has **no** Builder
  layout) keeps its collections-derived default nav — unchanged. Tenants with a
  Builder layout (the norm, seeded on first load) render the node-owned nav.

---

## 6. Migration — CMS menus → `NavMenu` nodes (no site loses its nav)

A one-time data migration (DB Migrate pipeline — `navigation_menus` is FORCE-RLS, so
loop tenants + `set_config('app.tenant_id')`, per the established backfill pattern):

For each tenant:

1. Read its `header` + `footer` `navigation_menus` (+ items, resolving `entry_id` →
   the entry's slug `href`, keeping `external_url`/`open_in_new_tab`).
2. Load the tenant's **primary** property's **active** `BuilderLayout` (seed the
   starter layout first if none exists).
3. In that layout's `draftTree` **and** `publishedTree`, find the header/footer
   `NavMenu` nodes and set `props.links` to the converted structured array; clear any
   `binding` to `site.primaryNav`/`site.footerNav`. (Top-level items map directly;
   children preserved in `links[].children` even though P1 renders flat — no data
   loss.)
4. Write the layout back.

Tenants with no menus, or no Builder layout, are no-ops (they keep the default
seeded links / the fallback header). The migration is **idempotent** (re-running
re-derives from the same CMS rows) until the CMS tables are dropped in §9.

> Why a migration and not "author fresh": live tenants already have curated menus;
> stranding them would be a regression. The conversion is mechanical.

---

## 7. Default for new tenants

Update the starter `siteLayoutTree` ([starters.ts](../packages/builder-schemas/src/starters.ts)):
the header/footer `NavMenu` nodes seed with **default `props.links`** (e.g. Home /
Shop / About) instead of `bind: 'site.primaryNav'`/`'site.footerNav'`. New sites get
a sensible editable nav out of the box, no CMS required.

---

## 8. Retirement (after migration ships + verifies)

**Delete:**

- `/cms/navigation` dashboard surface (page + per-location editor + menu actions).
- `services/api-rest/src/routes/v1/navigation/menus.ts` (the authenticated CRUD) +
  its app registration.
- The public nav read routes in `public/content.ts`
  (`…/navigation/by-location/:location`, `…/navigation/:id`).
- `getNavByLocation` / `getNavigationMenu` in `apps/site/lib/site.ts` and the
  `site.primaryNav`/`site.footerNav` resolution in `loadSiteData`.
- `site.primaryNav` + `site.footerNav` from `SITE_SOURCES` (`binding.ts`).
- The `navigation_menus` / `navigation_items` tables (final migration, once nothing
  reads them).

**Keep:** `SocialLinks` + `site.social`, `Logo` + `site.identity`, the `NavMenu`
node, the `@sparx/site-ui` `NavMenu` component.

**Sequencing:** drop the **tables** only in a _later_ migration, after the node-owned
path is verified in prod — so a rollback window exists where the CMS data still
exists even though nothing reads it.

---

## 9. Phasing

| Phase  | Scope                                                                                                                                                                                                                                               | Notes                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **P1** | The `NavMenu` node owns structured links: `NavLink[]` prop shape, the `navlinks` inspector control (label/href/new-tab, add/remove/reorder), renderer reads `props.links` (legacy string/bound fallbacks kept). Starter layout seeds default links. | No migration yet; no retirement. New + manually-edited navs are Builder-owned. Gate-green, shippable on its own. |
| **P2** | Storefront stops resolving `site.primaryNav`/`site.footerNav`; `loadSiteData` keeps identity/social. Data migration: CMS menus → `NavMenu` nodes on each tenant's primary active layout.                                                            | DB Migrate pipeline (tenant-loop backfill). After this, the live site renders node-owned nav.                    |
| **P3** | Retire `/cms/navigation`, the nav routes, the binding sources, the apps/site helpers; drop the tables in a final migration after a prod soak.                                                                                                       | Removal only — no behavior change if P2 verified.                                                                |

---

## 10. Open questions / out of scope

- **Dropdown nesting** — the data model carries `children`, but P1 renders flat
  (matching today's storefront `NavMenu`). One-level dropdowns are a fast follow:
  storefront `NavMenu` + `MobileNav` gain a nested render.
- **Target picker** — typing an href is P1. A page/collection/product picker is a
  shared follow-on with the `Button.href` picker (build once, use in both).
- **Per-link visibility / auth-gated links** (e.g. "Account" only when signed in) —
  out of scope; revisit with the customer-accounts chrome.
- **Mega-menus / promo columns** — explicitly not P1; if needed, a richer nav node or
  a container variant later.
- **Multiple custom menus** (beyond header/footer) — the CMS model allowed
  `custom_*` locations; in the Builder a "menu" is just a `NavMenu` node placed
  anywhere, so this need dissolves (drop a `NavMenu` wherever you want one).

---

## 11. Docs to update when this lands

- [45-builder-site-layout.md](45-builder-site-layout.md) §3 — reverse "the Builder
  keeps no parallel nav"; nav is now node-owned (identity + social stay bindings).
- [30-sitebuilder-redesign.md](30-sitebuilder-redesign.md) §8 — navigation ownership
  moves CMS → Builder.
- [16-cms-navigation.prisma](../packages/db/prisma/schema/16-cms-navigation.prisma) —
  mark the tables retired (and remove on the final drop migration).
- [49-multi-site-per-tenant.md](49-multi-site-per-tenant.md) — per-site nav is
  delivered via Builder layouts (not a `navigation_menus.property_id`); update the
  "per-site StorefrontSettings/nav still shared" caveat.
- [00-README.md](00-README.md) — index entry.
