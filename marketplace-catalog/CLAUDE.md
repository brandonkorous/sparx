# marketplace-catalog/ — first-party blueprints, components, themes

Scoped guidance for the bundles under here (`blueprints/`, `components/`, `themes/`) and
their `_gen/` generators. The full **authoring reference** is
[docs/guides/building-a-template.md](../docs/guides/building-a-template.md) — this file is
the **working rules + footguns** that aren't obvious from a single file. See root
[CLAUDE.md](../CLAUDE.md) for cross-cutting rules.

## Source of truth is the generator, not the emitted bundle

`_gen/<name>/` (a module folder, one concern per file) is hand-authored and EMITS
`blueprints/<name>/blueprint.ts` + `parts/*` — the shipped payload. **Edit `_gen`, never the
emitted parts** (a regen overwrites them). `sparx.json`, `README.md`, and `media/` are
**hand-maintained, NOT emitted** — they survive a regen (so a rename `mv`s the dir, never
`rm`s it). Node ids advance in `node()` CALL order from one shared counter that `manifest.ts`
fixes by property order — keep that order stable across edits (ids are persisted + used as
React/dnd keys).

## Binding conventions (bind by HANDLE/assetId, never a row id)

- Collection templates bind **`<typeKey>.*`** — `product.*` (commerce), `blog_post.*` (CMS) —
  **never `page.*`**. The storefront route AND the editor preview both inject the in-scope
  record under the type key.
- Product grids bind `{ source: { from: 'category'|'collection', id: '<handle>' } }`; the
  installer rewrites handle→id. There is **no per-record "related to THIS product" source** —
  a PDP cross-sell binds a curated collection.
- A `cms.<type>` list source exposes **no slug** and there's no per-item CMS href templating
  (the catalog `post_grid` ships dead `#` read-mores), so a live blog INDEX can't link its
  cards. Author a linked index as **static cards → `/blog/<slug>`** until that platform gap
  closes.

## Install is reconcile-by-natural-key (idempotent + additive)

Reinstall **reuses** rows by handle/SKU, **restores** soft-deleted tombstones, and creates
only the genuinely-absent — never destroy-and-recreate (a SKU is tenant-unique even when
soft-deleted, and a cart line pins the variant `onDelete: Restrict`, so a SKU can only be
reused, never freed). **Any reuse path must relink ALL of the reused entity's references** —
categories/collections AND images. (A reused product kept image rows pointing at assets a
prior reset hard-deleted → the storefront 404'd the photo; `relinkProductImages` fixes it.
The general lesson: reconcile every reference, not just the convenient ones.)

## The iterate loop (local), and its footguns

1. edit `_gen/*`
2. **bump the version in BOTH** `_gen/<name>/manifest.ts` AND `blueprints/<name>/sparx.json`
   (ingest keys on `(category, slug, version)` — forget the bump and it keeps the OLD payload)
3. `pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-<name>.ts"`
4. prettier **BOTH** `blueprints/<name>/**/*.ts` AND `_gen/<name>/**/*.ts` (so the manifest
   stays repo-formatted — pre-push `format:check` fails otherwise)
5. `pnpm --filter @sparx/api-rest marketplace:ingest`
6. apply to a tenant + verify (below)

Applying to a tenant — endpoints `POST /v1/blueprints/<key>/install` and
`/v1/blueprints/installs/<id>/{reset,go-live}`. **Re-installing over a LIVE install is
currently blocked** (the route 409s "reset to reinstall"), so the dashboard flow is
Reset → Install → Go-live (each confirm-gated). Reset is destructive (drops pages/content,
soft-deletes products). The intended direction is a **one-click Update that reconciles in
place** (the install is already idempotent; the gap is the page step blindly `create`s
slugged pages — it must reconcile by `(propertyId, slug)` first).

## Emails are marketing starters, not transactional

The platform provisions **19 KEYED transactional defaults** (order/shipping/dunning/…) on
email-module activation (`packages/builder-schemas/src/default-emails.ts`). A blueprint's
`emails` are **UNKEYED brand-voiced MARKETING starters only** — never duplicate
order-confirmation. Personalize with the canonical tokens (`{{site.name}}`,
`{{customer.firstName}}`, `{{site.url}}`; vocabulary in `email-tokens.ts`) so a fork
re-themes to the tenant; marketing emails carry the compliance footer (unsubscribe +
physical address).

## Verify like a user (don't trust "it rendered")

- Ports: dashboard **3001**, storefront **3004** (`?tenant=<slug>`), public API + media proxy
  **3100**. Storefront cache is **~90–100s** — poll until stale content clears, don't assume.
- Product images go through `:3100/v1/public/media/<assetId>` — verify they return **200**,
  not just that the card lays out (a stale assetId 404s while the card still renders — that's
  how the image bug hid through three reinstalls). Check images, every page, the builder
  canvas, AND the header name.
- `/blog` **404s** (the `blog/[slug]` route owns that segment) — a singleton index page needs
  a different slug (e.g. `/journal`).
- DB is **read-only** here: `docker exec sparx-postgres psql -U sparx_owner -d sparx`
  (superuser, bypasses RLS) for inspection. Never one-off DB mutations — change tenant state
  through the install/reset path.
