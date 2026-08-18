# Blueprint Updates — non-destructive reconciliation of an installed blueprint

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-19

---

## 1. Purpose & the problem

A tenant installs a blueprint (docs/54): it stamps a whole themed presence — brand, a
`SiteTheme`, content, a commerce catalog, builder pages + the site layout, tenant
components, and marketing emails. The tenant then **edits** some or all of it: re-colors the
theme, rewrites the home hero, renames products, edits a blog post. Later the blueprint's
**author ships a new version** — fixes a layout bug, adds an email, restyles a section. The
catalog now carries `v1.2` while the tenant installed `v1.0`.

**What happens to the tenant's edits?** Today: nothing good. There is no update path. The only
way to "get the new version" is **Reset → Install → Go-live**, which deletes everything the
install created and re-stamps it — **destroying every edit**. docs/54 §13 names this "the
genuinely hard part (a 3-way merge against a tenant's customizations)" and defers it. This
document specifies it, in full, and removes the destructive reset-as-upgrade workflow.

This is the classic **vendor-branch / three-way-merge** problem (the one `git merge`, distro
package managers, and config-management tools all solve): an upstream source changed, the
local copy diverged, and the two must reconcile **without losing local work**. The hard part
is never the algorithm — it is the **ownership contract**. We pick that first (§3), then the
mechanism follows (§5–§8).

It builds on:

- [docs/54 — Tenant Blueprints](54-tenant-blueprints.md): the manifest, the installer, the
  `tenant_blueprint_installs` row + its `result` id-map, the version-drift badge. This doc is
  the deferred §13 step 5, promoted to a first-class system. Where this doc and docs/54
  disagree on _update/reset_, **this doc wins**.
- [docs/53 — Builder Tenant Components](53-builder-tenant-components.md): the existing
  versioned-component model — placements **pin** a version and "Update to vN" **re-pins**.
  That is the _linked/synced_ pattern; it works because a placement keeps a `$ref`. Blueprint
  artifacts are **forked** (no live ref), so they need a true three-way merge instead of a
  re-pin. §7.4 reconciles the two so they compose rather than collide.
- [docs/36 — Layering model](36-sitebuilder-layering-model.md) / [docs/33 — Token Model
  v2](33-token-model-v2.md): a `SiteTheme` is `basePresetKey` + a `presentation` token overlay
  - a captured brand "look". That layered shape is what makes the theme merge (§7.1) clean.

---

## 2. What the competition does (and the principle they all share)

Both market leaders converge on one rule: **separate the layer the vendor updates from the
layer the user owns; updates only touch the vendor layer; the user layer either wins as an
overlay or is simply never touched. Nobody silently overwrites a user's edits.**

- **Shopify (Online Store 2.0).** A theme is **code** (Liquid sections) vs **settings/content**
  (`settings_data.json` + JSON templates). The updater **replaces code files but skips
  `settings_data.json` and the JSON templates** — so editor customizations survive while raw
  code edits are lost on conflict (the "code edits could not be included" notice). Store
  **data** (products, content) is a separate world a theme update never touches. Official
  guidance: **duplicate the live theme, test the new version, then publish** — the merge is
  staged and human-reviewed, never auto-applied to the live site.
- **WordPress.** Two mechanisms: **child themes** — overrides live in a layer that _wins_ over
  the parent, so a parent update can't clobber them (and Site-Editor changes are stored in the
  DB, separate from theme files, so they also survive); and **patterns** — the exact fork/link
  duality we have: **synced patterns** propagate on edit (linked), **non-synced patterns** are
  stamped copies edited independently (forked). Content is never touched by a theme update.

The lesson: **the architecture is the strategy.** Shopify's whole trick is that "customization"
mostly _means_ settings/content, which it can mechanically skip. We engineer the same
separation — a stored **baseline** (the merge ancestor) lets us tell "the tenant changed this"
from "the blueprint changed this" at field granularity, so we skip exactly the right things.

---

## 3. The contract (locked decisions)

| #   | Decision                                 | Choice                                                                                                                                                                                                             |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U1  | **Tenant edits always win**              | A blueprint update **never silently overwrites a tenant's change.** A conflict defaults to keeping the tenant's value.                                                                                             |
| U2  | **Opt-in, never auto-pushed**            | Drift surfaces an "Update available" affordance; the tenant initiates. No background mutation of a live tenant.                                                                                                    |
| U3  | **Non-destructive**                      | An update never deletes a tenant row. Upstream-removed artifacts are **kept and flagged**, never auto-deleted.                                                                                                     |
| U4  | **Field/node granularity**               | Merge at the smallest unit (token, node, field), not whole-record. A tenant who tweaked one theme token still gets every other upstream token update automatically.                                                |
| U5  | **Silent fast-forward of the untouched** | A field/node/artifact the tenant did **not** edit (current == baseline) is updated to the new version automatically — there is nothing to lose.                                                                    |
| U6  | **Baseline is the source of truth**      | The merge ancestor is the **stamped baseline captured at install** (§4), not the old manifest (which is not retained). The update is independent of manifest retention.                                            |
| U7  | **Reset becomes Delete**                 | The "Reset & reinstall" workflow is removed. The destructive action is a plain **Delete (uninstall)** — remove the install + what it created. Getting a new version is **Update**, not delete-then-reinstall. (§9) |
| U8  | **Detach is explicit**                   | A tenant can **detach** an artifact from blueprint management (the WordPress "eject"). A detached artifact is never offered updates again. Heavy divergence suggests, never forces, detach.                        |

> The one-sentence statement of the contract: **Your edits always win; updates are opt-in and
> reviewable; nothing is ever silently overwritten or deleted.**

---

## 4. The substrate — provenance + baseline (the missing piece)

A three-way merge needs three inputs: **base** (the common ancestor), **current** (the
tenant's live row), **incoming** (the new version). Today we store only the id-map (`result`),
which is _current's identity_ but not _base's content_. Without the base, the best we could do
is a two-way merge (incoming vs current), which **cannot distinguish a tenant edit from a
blueprint change** → every edited record looks like a conflict. So the keystone is storing the
**baseline**: the exact content each artifact was stamped with, captured at install.

Because **old manifests are not retained** (there is no `blueprint_versions` table; the catalog
row holds a single `version` + `definition`), the baseline must be **captured at install
time**, not reconstructed later. This also makes the baseline immune to upstream changes — it
is the ground truth of what _this tenant_ received.

### New table: `tenant_blueprint_install_artifacts`

One row per artifact an install created (or, on update, brought under management), RLS-isolated
(ENABLE + FORCE, `tenant_isolation` on `current_tenant_id()`):

```
id              uuid pk
tenant_id       uuid               -- RLS key
install_id      uuid  fk → tenant_blueprint_installs(id) on delete cascade
kind            varchar(20)        -- theme | brand | layout | page | email | component
                                   --  | product | content | category | collection
ref_id          uuid null         -- the created row id (null for tenant-level `brand`)
natural_key     varchar(255)       -- correlation key to the manifest:
                                   --  product/category/collection handle, content `typeKey:slug`,
                                   --  page slug|recordType|name, email name, component key,
                                   --  theme id, brand sentinel
baseline        jsonb              -- the stamped content = the merge ANCESTOR for this artifact
baseline_version varchar(20)       -- the blueprint version this baseline reflects
managed         boolean default true   -- false ⇒ orphaned (upstream-removed; kept, not updated)
detached        boolean default false  -- true  ⇒ tenant ejected it; never offered updates (U8)
created_at / updated_at timestamptz
unique (install_id, kind, natural_key)
index (tenant_id), index (install_id)
```

`result` (the id-map on the install row) is unchanged — go-live, the review surface, and
delete keep reading it. The artifact table is the **merge substrate** layered alongside it: it
adds `baseline` (what U6 needs), `managed`/`detached` (U3/U8), and a queryable per-artifact
provenance trail. The two are kept consistent by the installer writing both in the same
transaction-per-slice.

**Lifecycle of `baseline`.** Written at install (the stamped content). On a successful update
apply, `baseline` is **advanced to the incoming version's stamped content** (the new common
ancestor) and `baseline_version` to the new version — standard vendor-branch bookkeeping, so
the _next_ update correctly detects what the tenant changed _since this version_. The tenant's
kept-on-conflict value lives in `current` (the live row), so `base := incoming` still flags it
as a tenant edit next round.

---

## 5. The merge model — classification

For each artifact (and recursively, each field/node/token within it), the engine computes
three canonical values — `base`, `current`, `incoming` — and classifies:

| Case              | `current` vs `base` | `incoming` vs `base` | Outcome                                                                                                                                                                                        |
| ----------------- | ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unchanged**     | equal               | changed              | **Fast-forward** → take `incoming` (U5, automatic — nothing to lose).                                                                                                                          |
| **Tenant-only**   | changed             | equal                | Keep `current` (no-op).                                                                                                                                                                        |
| **Upstream-only** | equal               | equal                | No change.                                                                                                                                                                                     |
| **Conflict**      | changed             | changed              | **Keep `current` by default** (U1); surface as a reviewable conflict the tenant may flip to `incoming`. If `current == incoming` already, it's auto-resolved (both arrived at the same value). |
| **New**           | (no base)           | present              | **Add** the artifact/node/field.                                                                                                                                                               |
| **Removed**       | present             | (absent in incoming) | **Keep**, mark `managed = false` (orphaned); never auto-delete (U3).                                                                                                                           |
| **Detached**      | —                   | —                    | Skip entirely (U8).                                                                                                                                                                            |

Equality is **canonical structural equality** (stable-key JSON serialization; a bespoke helper
in `@wizeworks/blueprints` — no existing util in the repo to reuse). The crucial property: because
the merge recurses to the smallest unit, the **automatic** path (Unchanged → fast-forward)
fires for every field the tenant didn't touch, so the tenant receives almost all upstream
improvements with zero interaction, while the only things that ever stop for review are genuine
**Conflicts** (the tenant and the author both changed the _same_ field).

A whole update produces a **changeset**: per artifact, the list of fast-forwards (auto),
conflicts (review), adds, and orphans. **Preview** computes it without writing; **Apply**
executes it.

---

## 6. The update lifecycle

```
catalog publishes vN+  ──▶  drift detected (installed version < catalog version)
   ──▶  "Update available" (U2, opt-in)
   ──▶  PREVIEW: resolve incoming manifest, load baselines + current rows, build the changeset
   ──▶  tenant reviews conflicts (optional; default keep-mine)  ──▶  APPLY
   ──▶  per artifact: fast-forward auto, conflicts per resolution, add new, keep+flag orphans
   ──▶  re-publish (go-live parity)  ──▶  bump install.blueprint_version + advance baselines
```

- **Drift** is the existing signal: `GET /v1/blueprints` already stamps `update_available` when
  the installed version trails the catalog (docs/54 §9). A `blueprint.version_published` event
  (§10) lets the dashboard notify installed tenants, but the apply is always tenant-initiated.
- **Incoming** is resolved exactly as install resolves a manifest — `resolveBlueprint` →
  data-first artifact, else the in-code registry — at the **catalog's current version**. The
  engine runs `resolveBindingHandles(incomingTree, result)` on incoming trees first (using the
  install's id-map) so a binding's `category`/`product` handle is compared as the resolved id,
  matching how `base`/`current` already store it.
- **Apply** writes through the **same service layer** install uses (`pageService.update`,
  `savedThemeService.update`, `productService.update`, `tx.contentEntry.update` +
  `recordRevision`, …) — so every write is validated, audited, and event-emitting. The engine
  owns no write logic of its own (the docs/54 §2 principle, extended to updates).
- **Re-publish** mirrors `goLiveInstall`: if the install is `live`, apply re-publishes the
  touched pages/layout/products/content/emails and re-publishes the site theme
  (`publishService.publishNow`) so the merged result reaches the storefront; if the install is
  still `draft`, the merge lands in drafts and the tenant publishes on their own schedule.
- **Finalize:** `blueprint_version` on the install row advances; every touched artifact's
  `baseline`/`baseline_version` advances to the incoming version (§4).

Apply is **resumable and idempotent** like install: re-running a partially-applied update
recomputes the changeset from the (already-advanced) baselines and only finishes what's left.

---

## 7. Per-artifact strategy

Ownership semantics differ by type, so the merge granularity is matched to each. The
classification (§5) is identical everywhere; only the _unit of comparison_ changes.

### 7.1 Theme & brand (the named must-have — "update a theme without losing the tenant's data")

The `SiteTheme` is the cleanest case because it is _already_ layered (docs/36). Unit of
comparison:

- `basePresetKey` — scalar.
- `presentation` — the Token Model v2 overlay, a nested token map; merge **per token path**
  (deep). A tenant who changed `color.accent` keeps it; every other token the author changed
  (`radius.lg`, `space.section`, …) fast-forwards in automatically.
- `brand` (the saved "look": colors, fonts, shape tokens) — merge **per field**.

Apply writes the merged theme via `savedThemeService.update(ctx, themeId, { basePresetKey?,
presentation, brand, name })`, re-applies it to the working draft (`apply` +
`applyThemeBrandWithinTx`), and — if live — re-publishes (`publishService.publishNow`) so the
storefront's `--st-*` tokens refresh. **No tenant theme edit is lost**; the tenant's tweaks ride
through untouched while the author's improvements land — exactly U1+U5 at token granularity.

**Brand identity** (`TenantBrand`: `businessName`, brand colors, fonts, logos) is stamped at
install from `blueprint.brand` and is the kind of thing a tenant almost always personalizes, so
it is merged the same way and **defaults hard to keeping the tenant's value** — the author's
palette only fills fields the tenant never set.

### 7.2 Builder trees — pages, layout, emails, components

Trees merge **node-keyed by `BuilderNode.id`**. This is tractable because (verified): the
installer stamps manifest node ids **unchanged** (no re-mint), and blueprint authoring keeps
node ids **stable across versions** (one shared counter fixed by property order —
`marketplace-catalog/CLAUDE.md`). So `base`, `current`, and `incoming` share ids for
corresponding nodes; correlation is direct.

Algorithm `mergeTree(base, current, incoming)`:

- Index all three trees by node id. For each id present across versions, three-way-merge the
  node's **`type`, `props`, `class`, `name`, `binding`** per §5 (props/binding merged deep, per
  key).
- **Children** merge order-preservingly by child id: a child the author **added** (in incoming,
  not base) is inserted at its incoming position; a child the tenant added (in current, not
  base/incoming) is kept; a child the author **removed** (in base, not incoming) is kept iff the
  tenant edited its subtree, else dropped — **but only on the auto path; a removed node the
  tenant touched becomes a kept orphan, never silently deleted** (U3).
- A node the tenant **deleted** (in base, not current) stays deleted unless the author also
  edited it → surfaced as a conflict (re-add vs stay-deleted), default stay-deleted.

Write path by surface:

- **Pages / layout / emails** — `*.update(ctx, id, { tree })` mutates the draft in place. Apply
  writes the merged draft tree; go-live/publish parity pushes it live.
- **Components** are **versioned** (docs/53): `componentService.update` creates a _new_
  `ComponentVersion` and bumps `latestVersion`. So a blueprint-component update **creates a new
  version from the merged tree** and surfaces docs/53's existing **"Update to vN" / "Update all
  placements"** re-pin — the two systems compose: the blueprint merge produces the new
  component version; docs/53's re-pin rolls placements onto it. We do **not** auto-re-pin (U2);
  the tenant pins via the existing component UI.

### 7.3 Commerce & content (data rows)

- **Products** — field-level merge of the editable columns (`title`, `description`, `status`,
  `vendor`, `tags`, `productType`, `seoTitle/Description`, …) via `productService.update`;
  **variant prices** (`priceCents`, `compareAtPriceCents`, `costCents`) field-merged via
  `variantService.update`, correlated by **SKU**. Reconciled by **handle** (the install id-map
  already maps handle→id). A tenant's price edit is sacred (U1) — the author's price only lands
  if the tenant never touched it.
- **Categories / collections** — field-level merge (name, description, SEO, featured),
  correlated by handle.
- **Content entries** — `body` (jsonb) merged **per top-level field** against the type schema,
  plus `seoJson`; correlated by `(typeKey, slug)`. Writes go through the entry update path
  (`tx.contentEntry.update` + `recordRevision` + `syncReferences`), so every merged change is a
  revision the tenant can diff/rollback in the existing CMS history — a free audit trail and
  undo for the merge.
- **Media/assets** — hot-linked URLs (docs/54 §6): a changed asset URL in incoming fast-forwards
  if the tenant didn't swap the image; a tenant-swapped image is kept (U1).

### 7.4 New, removed, detached

- **New** artifacts (an email/page/product the new version adds; no baseline row) are **added**
  exactly as install creates them, and get a fresh artifact row + baseline. This is the single
  most common real case ("the author shipped a new welcome email") and is pure upside — it never
  endangers an edit.
- **Removed** artifacts (baseline row exists; absent from incoming) are **kept**, flipped to
  `managed = false`, and surfaced as "no longer part of this blueprint" — the tenant decides to
  keep or delete. Never auto-deleted (U3).
- **Detached** artifacts are skipped (U8).

---

## 8. The merge engine (where the code lives)

A pure, DB-free **`@wizeworks/blueprints` merge module** holds the algorithm — `canonicalEqual`,
`threeWayField`, `mergeTokens` (deep), `mergeTree` (node-keyed), and the per-kind
classifiers — returning a typed **changeset** (no I/O, fully unit-testable, mirrors how the
manifest validator already lives there). The **applier** lives next to the installer
(`wizeworks/services/api-rest/src/lib/blueprint-updater.ts`): it loads baselines + current rows, calls the
pure engine to build the changeset, and writes the result through the service layer — the exact
shape of `blueprint-installer.ts`, so it lifts into the async `template-installer` worker
unchanged later (docs/54 §5).

---

## 9. Reset → Delete (U7)

The "Reset & reinstall" framing is removed. `resetInstall` is renamed **`deleteInstall`** and
reframed as a plain **uninstall**: remove the install row and the artifacts it created. The
mechanics are unchanged where they must be — commerce rows still **soft-delete** (a SKU is
tenant-unique even when soft-deleted and a cart line pins the variant `onDelete: Restrict`, so a
SKU can never be _freed_, only reused; this is a data-integrity reality, not a reinstall
convenience), the live layout is still deactivated before removal — but it is no longer
positioned as the way to "get a new version." That is now **Update** (§6).

- Route: `POST …/installs/:id/reset` → **`DELETE /v1/blueprints/installs/:id`**.
- The install-route 409 (docs/54) changes from "Reset it to reinstall" to: if a newer version
  exists, "An update is available — **Update** to v*N*"; otherwise "Already installed —
  **Delete** to remove it."
- Dashboard: the destructive **Reset** button becomes **Delete (uninstall)**, behind the
  standard `useConfirm` naming the target + listing what is removed ([[destructive-actions-confirm]]).
- The natural-key reconcile in the _installer_ stays (it makes a fresh install after a delete
  resilient), but it is documented as resilience, not the update path.

---

## 10. API & events

**API** (admin-only for mutations, viewer for reads):

- `GET  /v1/blueprints/installs/:id/update` — **preview**: the changeset (per-artifact
  fast-forwards / conflicts / adds / orphans) for the catalog's current version. Read-only.
- `POST /v1/blueprints/installs/:id/update` — **apply**: body carries optional per-conflict
  resolutions (`{ artifactKey, unit, take: 'mine' | 'theirs' }[]`); unlisted conflicts default
  to keep-mine (U1). Returns the applied summary + new version.
- `POST /v1/blueprints/installs/:id/artifacts/:artifactId/detach` — detach (U8).
- `DELETE /v1/blueprints/installs/:id` — delete/uninstall (§9, replaces `…/reset`).

**Events** (`@wizeworks/events`):

- `blueprint.version_published` — `{ blueprintKey, version }` — catalog ingest emits; the
  dashboard may notify installed tenants (no auto-apply).
- `blueprint.update_applied` — `{ tenantId, installId, fromVersion, toVersion, counts }` — apply
  emits; analytics + the review surface listen.

---

## 11. Dashboard UX

The install detail surface (`/templates/installs/[id]`) gains an **Update** state above the
existing Review/Go-live/Delete actions:

- **Update available** banner (from drift) → **Review update** opens the changeset.
- The changeset groups by artifact, each showing **auto** changes (count, collapsed — "12
  improvements will apply") and **conflicts** (expanded), each conflict a compact
  **side-by-side**: _Your version_ (kept by default) vs \_Blueprint v_N — per-conflict **Keep
  mine / Take theirs**, mirroring docs/53's "Update to vN" affordance but for a forked artifact.
- **Orphans** ("no longer in this blueprint") list with Keep / Delete.
- **Apply update** runs it; live installs re-publish, draft installs stay draft.
- Per artifact, a **Detach** action ("stop syncing this from the blueprint").

Mobile: the side-by-side collapses to stacked panels ([[responsive-builder-mobile]]).

---

## 12. Build order (each slice independently shippable; all ship)

**✅ ALL SIX BUILT (2026-06-19).** Verified end-to-end against the live DB + service layer
(`wizeworks/services/api-rest/src/scripts/verify-blueprint-update.ts`): install the flagship blueprint,
edit theme + product + variant price, bump the version → the tenant's edits SURVIVE, untouched
fields fast-forward, conflicts keep the tenant's value by default. 30 merge unit tests +
15 live assertions green.

1. ✅ **Substrate** — `tenant_blueprint_install_artifacts` table + RLS migration
   (`20260914000000`); Prisma model; installer captures the per-artifact `baseline` at stamp;
   `delete` cascades the rows. (commit `18dbcce9`)
2. ✅ **Merge core + Theme & Brand** — the pure `@wizeworks/blueprints` merge module (`merge.ts`,
   unit-tested); the updater's theme (per-token) + brand path; preview + apply endpoints;
   re-publish parity; version bump + baseline advance. (commit `606741c3`)
3. ✅ **Trees** — `mergeTree` (node-keyed by id) for pages / layout / emails / components;
   components create a new version on change (docs/53), no auto-re-pin. (commit `9cc27f25`)
4. ✅ **Commerce & content** — products (+ variant price by SKU via `mergeByKey`),
   categories/collections, content entries; new/removed/orphan classification. (slice-4 commit)
5. ✅ **Delete rename** — `resetInstall` → `deleteInstall`; `DELETE /v1/blueprints/installs/:id`;
   install-route 409 messaging; dashboard Reset → Delete (+ "Delete & retry" for failed runs).
6. ✅ **Dashboard update surface** — `/marketplace/installs/[id]/update`: changeset review,
   per-conflict Keep-mine / Take-theirs, new + orphan sections, drift banner on the detail page.

**Remaining polish (not blocking):** per-artifact **Detach** (§13, U8) — the table column +
`POST …/artifacts/:id/detach` route + a per-artifact UI toggle; the async `template-installer`
worker lift (docs/54 §13 1b); and new-artifact CREATION on apply (currently surfaced in the
changeset as "new" and added on a fresh install; in-place add-on-update is the next increment).

---

## 13. Open questions & edge cases

- **Node moves vs edits.** A node-keyed merge treats a moved-and-edited node correctly (same id,
  new position + props) but cannot distinguish a tenant _move_ from an author _move_ of the same
  node — last-writer in the children merge wins position, content still three-way-merges. Good
  enough; a positional conflict is low-stakes (never data loss). Revisit only if real installs
  show churn.
- **Schema-incompatible content merge.** If a new blueprint version changes a custom content
  type's schema, a field-level body merge could produce a body the new schema rejects;
  `validateAndNormalizeBody` runs on write, so a bad merge is caught and that field falls to
  conflict rather than corrupting the entry.
- **Detach granularity.** Detach is per-artifact in v1; per-node/per-field detach is a possible
  later refinement (most "I've taken this over" intent is whole-artifact).
- **Async worker.** The applier is structured (like the installer) to lift into the
  `template-installer` Cloud Run worker; update-apply over Pub/Sub is the same move as docs/54
  §13 step 1b and lands with it.
- **Manifest retention.** We deliberately depend on the stored **baseline**, not old manifests
  (U6), so the system is correct even though the catalog keeps only the latest manifest. If
  per-version manifests are later retained, they become a cross-check, not a dependency.
