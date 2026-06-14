# Builder Tenant Components — user-authored components without a deploy

**Version:** 1.2.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-04

---

## 1. Purpose & relationship to other docs

System components in the `/builder` tier are **code** — entries in the in-code registry
(`apps/dashboard/app/(dashboard)/builder/_builder/registry.tsx`), each carrying a
`renderLeaf` React function. Tenants need to build, save, and reuse their **own**
components — a branded CTA, a spec table, a “feature trio” — without a deploy and without
writing JavaScript (which on a multi-tenant SSR surface is remote-code-execution).

This document specifies **tenant components** for the new builder tier: what they are, how
they’re stored, validated, rendered, parameterized, and versioned, and how they’re authored.

It descends from and refines:

- [docs/51 — Content Architecture](51-content-architecture.md) §4.2: components are the
  Tier-1 primitives + Tier-2 data-aware nodes a template composes from. This doc adds the
  **tenant-authored** kind (docs/51 Phase 5+).
- [docs/40 — Composition model](40-sitebuilder-composition-model.md): the node tree, the
  box/layout/props shape, per-node binding + cardinality. A tenant component is a saved,
  parameterized **subtree** of that model.
- [docs/47 — Class-first authoring](47-class-first-authoring.md): components store
  brand-governed `class` strings, not arbitrary CSS.
- [docs/38 — Extensible sections](38-sitebuilder-extensible-sections.md): the **legacy
  `/sitebuilder` tier** already shipped a full declarative custom-section system
  (`TenantSectionDefinition` + a JSON AST interpreter). That tier is **retiring**; this doc
  is the node-tree-tier successor. We reuse its _principles_ (declarative-only, server-side
  validation, snapshot/pin for determinism) but **not** its AST — the builder tier already
  has a richer node model (`@sparx/builder-schemas`), so a tenant component is just a saved
  node tree, not a second template language.

Where this doc and others disagree on builder-tier components, **this doc wins**.

---

## 2. The model

Two kinds of component live in **one catalog** (`/builder/components`) and **one palette**:

|               | **System**                                                    | **Tenant**                           |
| ------------- | ------------------------------------------------------------- | ------------------------------------ |
| Source        | in-code registry (`DEFS`/`PALETTE`)                           | `builder_components` table (RLS)     |
| Render        | `renderLeaf` function                                         | **expands** a saved node tree        |
| Mutable       | **read-only** (UI hides edit/delete; API rejects defensively) | full CRUD (owner/admin)              |
| Copy          | **yes** — seeds a tenant component                            | yes                                  |
| Parameterized | via `props` (code)                                            | via a declared **propSpec**          |
| Versioned     | by deploy                                                     | **explicit versions**, pages pin one |

A **tenant component** is a declarative, versioned, parameterized **node subtree**:

```
ComponentDefinition          (identity, per tenant)
  key, name, group, icon, description, surfaces
  latestVersion ──────────────┐
ComponentVersion (1..n)        │  pages pin a specific version
  version, tree (BuilderNode), propSpec[]
```

It renders by **expanding its stored tree** — the canvas and the publish step already walk
node trees, so there is **no new execution path** and **no user code**.

---

## 3. Data model

Two RLS-isolated tables, builder-owned (mirroring `builder_pages`/`builder_layouts`, never
the retiring `sitebuilder_*` tier):

**`builder_components`** — component identity, one row per (tenant, key):

- `id` uuid, `tenant_id` uuid, `key` varchar(63) (unique per tenant, `^[a-z][a-z0-9_]*$`),
  `name`, `group` (`layout|content|data`), `icon` varchar (lucide name), `description`,
  `surfaces` jsonb (`['page','site']`), `latest_version` int, timestamps.

**`builder_component_versions`** — immutable version snapshots:

- `id` uuid, `tenant_id` uuid, `component_id` uuid (FK, cascade), `version` int,
  `tree` jsonb (a `BuilderNode`), `prop_spec` jsonb (`PropSpec[]`), `created_at`.
- `@@unique([component_id, version])`.

Both `ENABLE`+`FORCE` RLS with the standard `tenant_isolation` policy on `current_tenant_id()`
(hand-edited migration SQL — Prisma generates neither RLS nor partial indexes).

**Instance reference (in a page/layout tree).** A placement is an ordinary `BuilderNode`
whose `type` is the namespaced key and which pins a version + carries instance prop values:

```jsonc
{ "type": "custom:hero_cta", "props": { "$ref": { "version": 2 }, "headline": "…", "image": "…" },
  "box": { … }, "binding": { … }? }
```

`custom:` prefix (≤63 incl. key, so `key` ≤ 56) namespaces tenant components away from system
types. The pinned `version` and instance prop values live under a reserved `props.$ref`.

---

## 4. Rendering & expansion

The builder already has two tree consumers; a tenant component touches only these:

1. **Editor canvas (preview).** When the canvas meets a `custom:<key>` node, it resolves the
   tenant component, loads the **pinned version**’s tree, **merges instance props**, and
   renders the expansion in place. Editing a component (a new version) updates every editor
   preview that has re-pinned to it. A dangling ref (deleted component / missing version)
   renders a clear placeholder, never a crash.
2. **Publish.** `page-service.publish` copies `draftTree → publishedTree`. We wrap that copy
   with an **expand pass**: every `custom:<key>` node is replaced by its pinned version’s tree
   with instance props merged, producing a tree of **pure primitives**. The site
   renderer (`apps/site`) therefore needs **no change** — published artifacts never contain
   `custom:*` nodes.

**Why publish-expand, not live-ref on the site:** nothing in the builder is “live”
without a publish — `publishedTree` is the artifact. Pinning controls _which version_ the
editor/publish expands; re-pinning + republish pushes an upgrade live. This keeps the
site read path untouched and makes published pages fully deterministic.

---

## 5. Parameterization (propSpec)

A component version declares `propSpec: PropSpec[]` — the instance-fillable slots:

```ts
PropSpec = { key, label, kind: 'text'|'richtext'|'url'|'image'|'number'|'boolean', default? }
```

Inside the version `tree`, a slot is a sentinel **prop value** `{ $prop: '<key>' }` placed on
any node prop (e.g. a Heading’s `text`, an Image’s `src`, a Button’s `href`). At expand time
the walker replaces each `{ $prop: k }` with the instance’s `props[k]` (falling back to the
propSpec `default`, then to empty).

`propSpec → zod` (`propSpecToZod`) derives the instance-config validator (mirrors the legacy
`fieldSpecToZod`); the expander runs `coerceInstanceProps` from it so each filled value is
coerced to its declared kind and an invalid one is dropped (the slot’s default shows through)
— **publish bakes the coerced values into the published tree**, so a published placement can
never carry a slot value in a shape the component rejects.

**Per-instance binding overrides (4b).** A data-aware component’s internal bindings are
authored against a `$bind:<key>` sentinel on a node’s `binding.path` (the binding analog of a
`$prop` slot). Each placement maps the slot to a real data path under `props.$ref.bindings`,
and the expander substitutes it (no override ⇒ the binding is dropped and the node falls back
to static). Encoding the slot in the path string keeps the `BuilderNode` schema — and the
site renderer — untouched: published trees only ever carry concrete `{ path }` bindings.
The slot list is **derived from the tree** (`collectBindingSlots`), so there’s no second spec
to persist (and no migration). A component placed inside an iterating scope still resolves its
remaining (non-slot) bindings against that scope, since the expansion is inlined in place.

---

## 6. Versioning & upgrades

- Editing a component’s tree/propSpec creates a **new `ComponentVersion`** and bumps
  `latest_version`. Old versions persist (pages pinned to them keep rendering).
- A placement pins `props.$ref.version`. New placements default to `latest_version`.
- The inspector surfaces **“Update to vN”** per placement, and the component detail page
  surfaces a bulk **“Update all placements to vN”** (`upgradeAllPlacements` re-pins every draft
  page/layout in one transaction; the detail page enables it only when some placement is behind,
  using `ComponentUsageDto.pinnedVersions`). Upgrading re-pins; the change goes live on each
  surface’s next publish. A version diff/summary is a later nicety.
- **Delete** is gated by where-used impact analysis (scan tenant draft pages/layouts for
  refs) behind a `useConfirm` ([[destructive-actions-confirm]]) — never a silent break.

---

## 7. Validation (server-side on save; shared client-side via `@sparx/builder-schemas`)

A component (and each version) must pass, before persistence:

- **Schema valid** — the tree is a `BuilderNode`; `propSpec` is well-formed; `key` matches the
  pattern and is unique per tenant.
- **Known types** — every node `type` in the tree resolves to a system component **or** an
  existing tenant component.
- **Nesting** — container/leaf + `acceptsChildren` respected.
- **No cycles, bounded depth (4a)** — a tenant component MAY reference other tenant components,
  but the reference graph must stay **acyclic** (no transitive self-reference) and within
  `MAX_COMPONENT_NESTING` (5) levels. The service builds the dependency graph from every other
  component’s latest tree and runs `checkNestingGraph` on save; the expander + canvas carry a
  matching depth backstop. Every referenced component must also exist.
- **Prop refs resolve** — every `{ $prop: k }` names a `propSpec` entry.
- **Classes bounded** — `class` strings stay within the Surface vocabulary (enforced when the
  docs/47 versioned class contract lands; today bounded by length, as elsewhere).

---

## 8. Authoring surfaces

1. **Copy a system (or tenant) component** — materializes a starting tree into a new tenant
   component row (“start from Button → our brand CTA”). The seed UX.
2. **Save selection as component** — in the builder canvas, turn the selected subtree into a
   new tenant component (and optionally replace the selection with a reference to it).
3. **Component editor** (`/builder/components/<key>`) — edit identity, the tree (reusing the
   builder canvas surface), the propSpec, and versions.

System components show **read-only** with a **Copy** action; tenant components show full CRUD
for owner/admin (dashboard module gating + role checks already in place).

---

## 9. Security

Declarative-only: a tenant component is **data** (a node tree + a prop schema), never code.
It renders through the same trusted registry renderers the platform ships — a tenant can only
_compose_ existing components, never introduce a new `renderLeaf`. No functions, no string
templating grammar, no inline styles/CSS (class vocabulary only). RLS isolates every row and
the API rejects any mutation of a system type defensively (never trust client provenance).

---

## 10. Phasing (each slice independently deployable)

**P-A → P-E all built 2026-06-04** (gate-green: typecheck + lint + format across
`@sparx/builder-schemas`, `@sparx/builder`, `@sparx/api-rest`, `@sparx/dashboard`; UNPUSHED;
migration-free after P-A).

- **P-A — Foundation ✅:** the two tables + RLS migration; `@sparx/builder-schemas` component /
  version / propSpec / instance-ref schemas + validators; `component-service` CRUD + version
  bump; `/v1/builder/components` routes; catalog union (System + Custom badges); the
  `/builder/components` list + detail; **Copy** (system → tenant).
- **P-B — Use on pages (core loop) ✅:** custom components in the Add palette ("Your
  components"); insertion adds a pinned `custom:<key>` reference (`makeCustomNode`); the canvas
  expands the latest version for a live, selectable-as-one-unit preview (`expandComponentTree`);
  **publish expansion** (`expandTreeForPublish` in page + layout `publish` → concrete nodes via
  the pinned version) so the site renderer never sees a `custom:*` type; **delete-impact**
  (`usages` where-used scan blocks delete + the detail "Used on" panel). Layers/inspector label
  - handle custom nodes.
- **P-C — Author from canvas ✅:** "Save as component" (inspector → `copyComponent` + replace
  selection with a placement, `editor.replaceNode`); the component **tree editor** at
  `/builder/components/[key]/edit` (`ComponentBuilderApp`, 4th Builder surface) reuses
  `useBuilderEditor` + `BuilderWorkspace` with `autosave:false` — **Save version** commits a new
  immutable version (no version-per-keystroke).
- **P-D — Parameterization ✅:** the propSpec editor ("Fields" rail tab = `PropSpecPanel`);
  `{ $prop }` slots created from a node's text prop via the inspector's **Make a field**
  (`slotEditor`); per-instance config form in the custom-node inspector; merge at expand
  (`expandComponentTree` fills slots from instance props, default fallback).
- **P-E — Versioning UI ✅:** per-placement pin shown + **Update to vN** (re-pins `props.$ref`)
  when latest > pinned; version history table on the detail page.

The data model (version table + `prop_spec` column) is built in **P-A** so later phases add
**no migrations** — and the gap work below stayed migration-free too (binding slots ride the
existing `props.$ref` jsonb; binding-slot specs are derived from the tree, not stored).

### Gaps filled (2026-06-04, after P-E) — also migration-free, gate-green

- **Exact-pinned-version preview (Gap 1):** the canvas now expands each placement’s **pinned**
  version, not just the latest. `useComponentVersions` scans the tree for placements pinned
  below latest, lazily fetches those exact versions (`getComponentVersion` →
  `/versions/:version`), and provides a `VersionResolver` (React context) the canvas reads;
  it falls back to latest until the fetch lands. _Remaining edge: a placement of an OUTER
  component whose own tree pins an OLDER version of an inner component previews the inner at
  latest (only top-level pins are prefetched). Publish is always faithful — it loads every
  version._
- **propSpec → zod (Gap 2):** `propSpecToZod` + `coerceInstanceProps`; the expander coerces +
  drops invalid instance values, so published placements are always well-shaped (see §5).
- **Bulk upgrade (Gap 3):** `upgradeAllPlacements` + `POST …/upgrade-placements` + the detail
  page’s **Update all placements to vN** (see §6).
- **Nesting (Gap 4a):** custom-in-custom allowed with a cycle + depth guard (see §7); the
  expander recurses (`expandCustomNodes`), publish loads ALL components (not just top-level
  refs) so nested placements resolve, the component editor offers other components in its
  palette (self excluded), and "Save as component" no longer rejects subtrees that nest a
  component.
- **Binding overrides (Gap 4b):** `$bind:<key>` sentinel + per-placement `props.$ref.bindings`
  (see §5). Authored from the component-editor binding box (**Make instance field**); filled
  from the placement inspector’s **Data** group.

---

## 11. Open questions

- **Per-instance binding overrides** — ✅ shipped (Gap 4b, §5). Still open: overriding a node’s
  `box.backgroundImageBinding` (only `node.binding` is slot-able today), and labelling/ordering
  binding slots from a dedicated rail (they’re derived from the tree + node names for now).
- **Custom-in-custom nesting** — ✅ shipped (Gap 4a, §7), bounded by a cycle check + depth limit.
  Still open: the editor palette only excludes SELF, so a deeper cycle is caught by the
  server reject rather than pre-filtered; and a deeply-nested OLDER pin previews at latest
  (Gap 1 edge).
- **Marketplace components** (`sparx.market`, vetted platform code) — docs/38 Phase D; out of
  scope here (per-tenant arbitrary React in SSR stays banned).
- **Server-side type-resolution validation** — the validator predicates (`isKnownType` /
  `acceptsChildren`) still aren’t wired (needs a server-safe registry mirror); low ROI while
  the only writer is the trusted dashboard composing from its own registry.
