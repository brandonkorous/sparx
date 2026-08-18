# marketplace-catalog/ — first-party blueprints

Scoped guidance for the bundles under here (`blueprints/`; themes + components ship as
code in `@wizeworks/silica-catalog` — see [README.md](README.md)) and
their `_gen/` generators. The full **authoring reference** is
[docs/guides/building-a-template.md](../docs/guides/building-a-template.md) — this file is
the **working rules + footguns** that aren't obvious from a single file. See root
[CLAUDE.md](../CLAUDE.md) for cross-cutting rules.

## Reference site-templates: the harness + the standard build/preview/screenshot loop

The reference-driven **full-site** templates (`docs/templates/*` → `gen-template-<slug>.ts`) are
NOT authored one node at a time. Each generator is JUST a `TemplateSiteSpec` on the shared harness
in [`_gen/template-sites/`](_gen/template-sites/): `harness.ts` composes the distinct silica site
(a 9-page site — Home, Shop, Collections, Cart, Search, Journal, About, Contact, Product) and emits
the bundle; `pdp.ts` is the bespoke product-detail kit; `behaviors.ts` the interactive-section
helpers; `preview.ts` the visual-review renderer. A spec declares the bespoke parts —
`home`/`pdp`/`shop`/`collections`/`cart`/`search`/`journal`/`about`/`contact` — and the harness
supplies the frame, the pinned functional cores, SEO and theme. **Add a new one by copying an
existing `gen-template-<slug>.ts`, not by hand-building pages.** This scales to 100+ templates
because the only per-template code is the spec.

**The three-oracle build loop — identical for template #1 and #100:**

1. **Generate + validate + preview** — one command per template:
   `pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-<slug>.ts"`
   It emits the bundle, prints `safeParseBlueprint → VALID` (oracle 1+2), and writes the full-site
   review HTML to the STANDARD dir **`marketplace-catalog/_gen/.preview/preview-<slug>.html`**
   (gitignored) — every page stacked under sticky labels, in the bundle's real theme, with bound
   content resolved from the spec's own sample records. Do NOT pass a scratch path; the default is
   the standard dir. (Regen all: loop the ten slugs.)
2. **Screenshot for visual review** — `node marketplace-catalog/_gen/screenshot-template.mjs <slug>…`
   (or `all`). Full-page PNG per template → `.preview/site-<slug>.png`. Playwright + `file://` (no
   dev server, no DB, no install) so it never touches a running stack; the shared functional cores
   (faceted grid/cart/search) render as a labeled placeholder because they are server-computed live.
3. **Grade every bundle** — `pnpm --filter @wizeworks/site-lint exec vitest run src/blueprint-sweep.test.ts`
   walks every shipped bundle's every page (SEO, contrast, headings, links, `class-no-css`).

**Named utilities ONLY in authored trees** — an arbitrary value (`aspect-[4/5]`) or off-step
(`gap-7`/`gap-1.5`) compiles while `@source`-scanned but emits NOTHING once stamped into a tenant's
stored tree; the sweep flags it `class-no-css`. Use `aspect-square`/`aspect-video`, `gap-4/6/8`.

## A regen is NOT free — the template generators re-mint node ids

`gen-template-*.ts` assigns node ids from a random base, so **running one
rewrites every id in its `site.json`**. Re-running a generator "just to check
nothing broke" produces ~950 changed lines on a bundle nobody edited, and those
ids are PERSISTED with the tree and used as React/dnd keys — so the churn is real,
not cosmetic. Regenerate only when you changed that template; `git checkout --`
the bundle if you ran it to test something else.

The `sparx-*` themed clones and `piggles-starter` are safe: they copy the golden's
captured site verbatim rather than composing it, so their `site.json` is untouched
by a regen. They DO emit their own `sparx.json`, though — unlike the rule below —
so a manifest edit that is not also made in the generator is reverted by the next
run.

## Brand scoping: who may SEE a bundle

A manifest may declare `brands: ['sparx']` / `['piggles']`. **Omitted means every
brand, and that default must stay the default** — a template that has to name its
brands to be visible forks the catalog the first time somebody forgets. Of 191
bundles: 169 shared, 21 sparx's showcase family, 1 Piggles'.

Only a SHOWCASE is ever restricted — a bundle whose `brand.businessName` is the
platform's own name, which is the product demonstrating itself rather than a
vertical template. Enforced in `wizeworks/services/api-rest/src/lib/marketplace/brand-scope.ts`
at three points (the listing's `notIn`, the v1 install route, and the internal
furnish path), because a key posted from a browser form reaches install without
passing the list.

## Media: shoot it, don't inherit it

`media/icon.png` (512×512) + `media/preview.png` (~1600×1000) are hand-maintained
and survive a regen — which means a NEW bundle silently ships whatever its
generator copied in as a placeholder. Two steps produce real ones, both running
Playwright over `file://` with no dev server, no DB and no install:

```
pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/preview-showcase.ts" <slug>
node marketplace-catalog/_gen/card-media.mjs <slug> [--icon <mark.svg>]
```

`preview-showcase.ts` renders a CAPTURED-site bundle (the showcase family, which
has no `TemplateSiteSpec` to compose from) through the same `writeSitePreview` the
templates use. `card-media.mjs` writes the card art — the home page alone, review
labels stripped. **Do not copy `.preview/site-<slug>.png` into `media/`**: that is
the seven-page review strip, and as a card it renders as an unreadable sliver.

## Source of truth is the generator, not the emitted bundle

`_gen/<name>/` (a module folder, one concern per file) is hand-authored and EMITS
`blueprints/<name>/blueprint.ts` + `parts/*` — the shipped payload. **Edit `_gen`, never the
emitted parts** (a regen overwrites them). `sparx.json`, `README.md`, and `media/` are
**hand-maintained, NOT emitted** — they survive a regen (so a rename `mv`s the dir, never
`rm`s it). Node ids advance in `node()` CALL order from one shared counter that `manifest.ts`
fixes by property order — keep that order stable across edits (ids are persisted + used as
React/dnd keys).

## The Contact page is shared, and nothing on it is invented

Every bundle's Contact page is built from **`_gen/shared/contact-section.ts`** — the page's
`h1`, the business's own phone/email/address, and a real submitting `<form>`. Each family
reaches it differently (the service harness prepends it; the 72 template/portfolio
generators each call it with their own words), but the SHAPE is one file.

**The details are BOUND, never authored.** `site.identity.phone` / `.email` / `.address`
come from Site settings → _How customers reach you_ (`Property.settings.contact`, no schema
column). Each row is wrapped in `visibleWhen`, so an un-filled field renders **nothing** —
a starter never ships a plausible-looking phone number that is not a real line. `phoneHref`
/ `emailHref` are composed host-side (`wizeworks/apps/site/lib/silica-data.ts`), because `bindAttr`
fills an attribute verbatim and cannot prefix `tel:`.

**The form is unconditional and works on install.** A form with no `FormDefinition` row is
not an error — `form-submit-service.ts` falls back to notifying the account email and always
writes the submission — so a site is reachable before its owner configures anything.

This exists because an audit on 2026-08-12 found that of 190 shipped bundles: **none had a
phone number anywhere**, **none had a form on the contact page**, 111 had no email either,
and 68 shipped `hello@example.com` as the only route to the business. The parts were all on
the shelf (`sections/convert.ts`, the form pipeline, the notification email) and unfitted.
When adding a bundle, call `contactSection` — do not hand-author a contact band.

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
   — the artifact is keyed by `(category, slug, version)`, so forgetting the bump keeps the
   OLD payload. The two spellings are now **cross-checked**: a disagreement fails the load
   with both values named, rather than silently pointing the row at the wrong artifact.
3. `pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-<name>.ts"`
4. prettier **BOTH** `blueprints/<name>/**/*.ts` AND `_gen/<name>/**/*.ts` (so the manifest
   stays repo-formatted — pre-push `format:check` fails otherwise)
5. `pnpm --filter @wizeworks/api-rest marketplace:self-register` — or just restart api-rest,
   which does the same thing on boot. Publishing is not a deploy step: what sparx ships is
   what the running service publishes, and **deleting a bundle directory retracts its
   listing** (retract-by-absence, scoped to sparx's own rows).
6. apply to a tenant + verify (below)

Applying to a tenant — endpoints `POST /v1/blueprints/<key>/install`,
`POST /v1/blueprints/installs/<id>/go-live`, `GET|POST /v1/blueprints/installs/<id>/update`
(preview | apply), and `DELETE /v1/blueprints/installs/<id>` (uninstall). A newer blueprint
version is an **Update** — a non-destructive three-way merge that keeps the tenant's edits
([docs/55](../docs/55-blueprint-updates.md)); **Reset is gone**, replaced by a plain **Delete**
(uninstall: drops pages/content, soft-deletes products for SKU/cart integrity). Never
delete-then-reinstall to "get the new version" — that's what Update is for. Re-installing over
an existing install still 409s (one install per tenant/property/blueprint); the message points
to Update or Delete.

## Emails are marketing starters, not transactional

The platform provisions **19 KEYED transactional defaults** (order/shipping/dunning/…) on
email-module activation (`wizeworks/packages/builder-schemas/src/default-emails.ts`). A blueprint's
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
