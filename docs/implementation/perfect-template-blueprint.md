# Perfect Template → sparx Blueprint

Version: 0.4.0
Author: Brandon Korous
Last Updated: 2026-07-24

> **Living build doc.** The single source of truth for the "perfect template" effort so
> it survives context compaction. Update the **Status** table + **Log** as work lands.

> ## ▶ RESUME HERE
>
> **v1.161.0 is deployed** (2026-07-24 12:53 UTC) — BUG-003, the logo/chat fixes, and the
> first MCP batch are all live and verified. Two things now gate the rest:
>
> **(a) The MCP connector must be RECONNECTED.** api-mcp v1.161.0 serves
> `create_product` + `create_scheduling_service`, but a client that connected before the
> rollout still has the OLD tools/list cached — they are un-callable until the connector
> is refreshed. Verified: the pod runs v1.161.0, and `git tag --contains d563c31d` → v1.161.0.
>
> **(b) A SECOND deploy** for the batch added after v1.161.0 (see _MCP capability work_):
> `update_product`, `update_variant`, the scheduling **resource + hours** tools, and
> `rebuild_search_index`. The new `write:search` scope means the connector must
> **re-consent**, not merely reconnect — do (a) and (b) in one pass.
>
> Then, in order:
>
> 1. **`rebuild_search_index`** — the Typesense products collection is EMPTY for this
>    tenant (BUG-004), so `/shop`, `/search`, and `/products` all render "No products
>    found" even though 21 products exist. Nothing about the catalog looks right until
>    this runs.
> 2. Seed the schedule: `create_scheduling_service` → `create_scheduling_resource`
>    (kind `staff`) → `set_resource_hours`. All three, or /book stays empty.
> 3. Swap the catalog: archive the 10 smoothies, `create_product` × ~6 neutral goods
>    (`update_product` now exists, so corrections no longer mean rebuild-and-lose-the-SKU).
> 4. Verify live: logo flips, chat accent Ember, `/shop` PLP populated, `/search?q=` hits.
> 5. **Author the blueprint bundle** (see _Bundle authoring spec_) → capture site →
>    validate → ingest.
>
> Do NOT re-litigate _Locked decisions_. Constraints #2 / #2b are now FULLY fixed —
> read their strikethrough notes before assuming a capability is missing.

## The goal

Turn the live **Template site** into the _perfect, complete_ reference site — one that
shows **every module's formatting** — then **capture it as a first-party marketplace
blueprint** (`marketplace-catalog/blueprints/sparx/`) so any tenant can install a
polished, multi-module starter.

"Perfect = every module represented," because a template with no product-detail, no
blog-post, no booking, no wholesale formatting _looks_ half-built even to a tenant who
will never turn those modules on.

## Locked decisions (do not re-litigate)

1. **Identity = sparx-branded, vertical-neutral showcase.** The template wears the
   **sparx** brand (name "sparx", Ember `#e04631` primary), in a **universal voice** that
   fits any business (clothing, consulting, food…). NOT a specific vertical (Farm-Fresh
   smoothies made it "weird for a clothing brand") and NOT soulless-generic.
   - Accepted trade-off: installing tenants must fully rebrand; a missed spot ships
     "sparx" as their store name. User chose this knowingly.
2. **The blueprint ships its theme** (capture the sparx Ember theme verbatim, not
   `--omit-theme`).
3. **Content must be coherent** — one brand, universal voice. Off-brand data purged.
4. **Seed sample data where the module needs it** to not look empty; but see constraint
   #1 below — scheduling/b2b records are NOT part of a blueprint.

## Hard constraints discovered

1. **A blueprint's schema carries only** `brand`, `theme`, `contentTypes`, `content`,
   `commerce`, `site`, `emails` (`packages/blueprints/src/manifest.ts`
   `BlueprintSchema`). **No `scheduling`, `b2b`, or `crm` field.** Those modules are
   represented by **site formatting** (Book/service-detail pages, a Wholesale page, the
   contact form) that render live data an installing tenant adds — not by seeded records
   the blueprint ships.
2. **MCP write-capability gaps — ALL CLOSED.** Read this before assuming a capability is
   missing:
   - ~~No MCP tool creates a bookable service~~ → **FIXED** (v1.161.0):
     `create_scheduling_service` + `update_` + `delete_`. Note the blueprint schema still
     has no `scheduling` field (constraint #1) — services are seeded on the TENANT, never
     shipped in the bundle.
   - ~~A service alone makes /book work~~ → **IT DOESN'T, AND THAT IS NOW FIXED TOO.**
     `availability.ts` computes slots **per resource**: a service with no matching
     resource, or a resource with no weekly hours, offers **zero** slots (it defaults to
     looking for `{role:'staff', kind:'staff'}`). Added
     `create/update/delete_scheduling_resource` and `set_resource_hours`, plus the reads
     `list_scheduling_resources` / `list_resource_hours` so the "why is availability empty"
     question is answerable. The full path is **service → resource → hours**.
   - ~~No MCP tool creates or updates a product~~ → **FULLY FIXED.** `create_product`
     (v1.161.0, composes product + default priced variant) plus `update_product` and
     `update_variant` (this batch). Price lives on the VARIANT, not the product — that is
     why it takes two tools. The smoothies can now be corrected in place, though the plan
     is still to archive + replace them with neutral goods.
   - All are **callable only after the api-mcp deploy AND an MCP reconnect** (see RESUME
     HERE (a)/(b)).
3. **Capture only does the SITE.** `captureBlueprintSite` → `SiteDecl` (pages + frame +
   theme + symbols) only. `brand` / `commerce` / `content` / `emails` are hand-authored
   into the bundle. (`services/api-rest/src/lib/blueprint-capture.ts`.)
4. **Capture runs against docker Postgres** (Cloud SQL is private-IP only) — the live
   Template site is prod. Workaround: assemble the `SiteDecl` from MCP reads
   (`get_silica_site` + `list_silica_pages` give every field `CapturedPageInput` needs)
   and validate through `captureSite` locally. No infra change needed.
5. **Record types already render via code defaults** (`RECORD_TEMPLATES` in
   `packages/silica-catalog/src/record-templates.ts`): product / collection / category /
   service / blog_post. Re-authoring a template that only equals the code default adds no
   value. Author on-site only what we ENRICH beyond the default (product detail, blog
   post); the pure host-core shells (collection/category/service) can stay code-default.
6. **Silica publish/verify footguns** — see the `silica_publish_and_cache_gotchas`
   memory. `appearancePolicy` needs `publish_site`; storefront caches config 300s and MCP
   publish doesn't purge the tag; the React frame walk emits no `data-sui-host`.

## Two workstreams (what feeds the blueprint)

The blueprint = **captured `site`** + **bundle-authored data**. Keep them straight:

- **Captured from the live tenant → blueprint `site`**: pages, frame, theme, symbols,
  identity. This is the ONLY thing capture pulls. Make these _perfect + universal_ over
  MCP. **This is the priority live-site work.**
- **Authored declaratively in `blueprint.ts` (NOT captured)**: `brand`, `commerce`
  (neutral goods + collections/categories), `content` (journal entries), `emails`. The
  live tenant's own products/posts are _preview data_ so the captured pages render
  something while I verify — they don't ship. (Live journal posts I create via
  `create_content_entry` are for preview coherence AND get mirrored into bundle `content`.)

**REVISED once `create_product` deploys:** build the neutral catalog **on the live tenant
too** (archive the 10 smoothies → create the ~6 neutral goods), then mirror the same data
into the bundle's `commerce`. Two wins: the live reference stops showing smoothies on a
sparx-branded site, and the bundle's catalog is a transcript of something proven to work
rather than hand-invented. Same for scheduling services (live only — the bundle can't carry
them).

| Thing                      | Value                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Tenant (WizeWorks)         | `1bfef66a-a489-4e0f-99fd-f041adc7ffaa`                                               |
| Site (property) "Template" | `c99e0e23-dae2-4814-b670-b73de5eec0f1` (slug `template`, NOT primary)                |
| Live URL                   | `template.wizeworks.sparx.zone`                                                      |
| Theme                      | `sparx` (Ember `#e04631` primary; was `apex` gold) — light+dark, appearance `toggle` |
| Fonts                      | Space Grotesk (headings) / Inter (body)                                              |
| Blueprint bundle target    | `marketplace-catalog/blueprints/sparx/`                                              |
| Authoring contract         | `describe_silica_authoring` (MCP) + `docs/guides/building-a-template.md`             |

**Pages: 7, all `recordType:null`, all published** — Home, Shop, About, Journal (`/blog`),
Contact, Book, Wholesale. Full ids in _Every id in one place_ below.

## Design rules (binding — from CLAUDE.md + describe_silica_authoring)

- silicaui-first; Tailwind utilities OK; nothing else without approval.
- **No eyebrows** (kicker labels above headings). Delete the eyebrow slot on
  `content_prose` / `feature_media` when stamping.
- **No faded text** — strip `text-base-content/70` → `text-base-content`. Opacity only for
  text not meant to be read.
- **No gradients, no shadows** as a visual device. Base font ≥16px.
- Color bands: commit whole sections to a color and swing between them; ALWAYS pair a
  bg with its on-color (`bg-neutral text-neutral-content`) AND put the on-color on the
  heading itself (headings don't inherit the band color).
- Status = `statusTone()` + `<Badge>`. Legal links = the `site.legal-links` host core.

## Status (current as of 2026-07-24, end of session 2)

**LIVE + VERIFIED on `template.wizeworks.sparx.zone`:**

| Deliverable                                                                                    | Status                                       |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| sparx Ember theme (light+dark, appearance `toggle`)                                            | ✅ live                                      |
| Home — multi-module showcase (hero/shop/journal/book+wholesale/testimonial/CTA)                | ✅ live                                      |
| Shop — now the **`commerce.plp`** core (facets/sort/paging)                                    | ✅ live (empty until BUG-003 deploys)        |
| About · Contact · Journal — universal voice                                                    | ✅ live (Contact + Journal needed no change) |
| Book (scheduling) — rich page around `scheduling.services` core                                | ✅ live (empty until services seeded)        |
| Wholesale (B2B)                                                                                | ✅ live                                      |
| Frame: Book in nav, Wholesale in footer, brand `show:"logo"`, theme-toggle + legal-links cores | ✅ live                                      |
| sparx wordmark logo (light+dark) + spark favicon                                               | ✅ set + published                           |
| Journal: 3 universal posts, food/SaaS posts retired, **featured images set**                   | ✅ live                                      |
| SEO on all pages                                                                               | ✅ done                                      |
| PDP + blog-post render via code defaults (no on-site record templates needed)                  | ✅ verified                                  |

**SHIPPED in v1.161.0 and verified live:** logo light/dark swap · chat accent ·
search resilience · **BUG-003 Typesense port** · `create_scheduling_service` ·
`create_product`. `/shop`, `/search?q=`, `/products` and `/book` all return **200** —
no more 500s. `/book` shows a clean "No services are bookable yet" empty state.
Journal images resolve **200** (api media → 302 → Unsplash), so that report is closed.

**BUG-004 — the search index is EMPTY for this tenant.** Not a scoping problem and not
BUG-003 lingering: every search-backed surface renders "No products found" on **all three**
sites (Template, wize.works, brandonkorous.com) while `get_products` returns 21 rows. The
commerce-indexer is healthy (`typesense schemas ensured` / `event processed`, 2026-07-24
18:23 UTC), so the collection simply never got populated for `wizeworks` — indexing writes
happened while `TYPESENSE_PORT` was shadowed, and nothing backfills. **Fix = one
`rebuild_search_index` call** once (b) below deploys. Newly created products will index
themselves; the 21 existing ones will not.

**BLOCKED ON A SECOND DEPLOY** (code written, gate-green, uncommitted):
`update_product` · `update_variant` · `create/update/delete_scheduling_resource` ·
`set_resource_hours` · `list_scheduling_resources` · `list_resource_hours` ·
`rebuild_search_index` (+ the new `write:search` scope).

**REMAINING AFTER DEPLOY:** see _RESUME HERE_ steps 1–5, plus:

- ⬜ **Brandon action:** acknowledge + publish the 6 legal pages in workbench so the footer
  Legal column appears (human-gated by design). Confirmed still empty: the live footer emits
  zero legal hrefs and no "Legal" heading.
- ⬜ The site/property is still named **"Template"**, which the footer binds via
  `site.identity.name`. No MCP tool renames a property; decide whether that matters for the
  captured bundle (the installer sets the tenant's own name, so it may not).

## Every id in one place

| Thing                          | Value                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant (WizeWorks)             | `1bfef66a-a489-4e0f-99fd-f041adc7ffaa`                                                                                                                                                                                                                                                                                                      |
| Property "Template"            | `c99e0e23-dae2-4814-b670-b73de5eec0f1`                                                                                                                                                                                                                                                                                                      |
| Pages                          | Home `1f816f35-3728-45ee-8202-de332da47bf8` · Shop `4ce6bdab-e94a-40f7-92f9-0fa6e7b9a6f7` · About `1f9940a2-8c0d-446b-bb16-7a5259cd417f` · Journal `a909d9d3-709e-43f1-ab88-1d35451201f8` · Contact `4cc42b1d-0e32-4a02-8c78-780630f6aba9` · Book `72a5317f-95d9-4625-bed5-7bdb1e0fad9a` · Wholesale `1a60abc3-a47d-4e0f-99b6-17f04fa39892` |
| Logo media                     | light `19e69e0f-93ee-4942-9865-693f3eaab831` · dark `4245aa38-6ffc-4e6a-82be-8e4a22cf92f1` · favicon(spark) `4f13814f-a034-4a02-b3b3-3bf0f85643a7`                                                                                                                                                                                          |
| Saved theme (legacy/ThemeDecl) | `07cd7da8-e3a4-4504-bb1b-62cc04fe35c1` (name `sparx`, base `apex`, Ember brand)                                                                                                                                                                                                                                                             |
| Journal posts                  | launch `32d5b258-cd0e-4495-a656-170ba5acbffa` (img `a7b995f8-d68a-46e3-9eec-dcf4e9a44ec0`) · descriptions `8a0fd5a3-920e-484c-9e9f-b5e82e106af6` (img `1382becc-80a3-4daa-8f56-672a8148f70d`) · regulars `722df7b1-6b2b-415c-b7ad-70ba9f6440eb` (img `a12ddc25-8f7e-4c00-8b9a-362e3b64b493`)                                                |
| Retired posts (draft)          | food: `6d9062ba…`, `e3f76ee4…` · SaaS: `31a0e63f…`, `f5d5e11b…`, `b2988887…`                                                                                                                                                                                                                                                                |

## Bundle authoring spec (READ FIRST — the skeleton is stale)

⚠ **`marketplace-templates/blueprint/blueprint.ts` is OUT OF DATE** — it uses the legacy
`BuilderNode` format (`layout`, top-level `pages`, `emails:[{tree,subject}]`). The CURRENT
`BlueprintSchema` (`packages/blueprints/src/manifest.ts`, already read) is **silica-native**.
Author against the schema below, not the skeleton.

**Top-level manifest (current):** `key, version, name, summary, vertical, preview?,
requiresModules[], brand, theme, assets[], contentTypes[], content[], commerce?, site?,
emails[]`.

- **brand** (`BrandDecl`): `businessName:'sparx'`, `tagline`, `colors:{primary:'#e04631',
primaryForeground:'#ffffff', accent:'#c1652e', secondary:'#4c9a8e'}`, `fonts:{heading:
'Space Grotesk', body:'Inter'}`, optional `logoLightAssetId`/`faviconAssetId`, `socials[]`.
- **theme** (`ThemeDecl` = `CreateSavedThemeInput` + `apply`): `{ name:'sparx',
basePresetKey:'apex', presentation:{v:2, containerWidth:'1152px'}, brand:{
colorPrimary:'#e04631', colorAccent:'#c1652e', colorSecondary:'#4c9a8e',
fontHeading:'Space Grotesk', fontBody:'Inter', tokens:{} }, apply:true }`. (This is the
  provisioned SiteTheme; SEPARATE from `site.theme` which is the captured silica tokens.)
- **commerce** (`CommerceDecl`): neutral universal goods. Plan: 1 category `goods`, 1
  featured collection `bestsellers`, ~6 products (everyday-tote, ceramic-mug, essential-tee
  [option Size S/M/L/XL → 4 variants], dot-grid-notebook, insulated-bottle, structured-cap),
  each `status:'active'`, ≥1 variant w/ `sku`+`priceCents`, ≥1 image via `assetId`→`assets`.
  Tag a few `featured` (collection membership) so Home's `commerce.featured` resolves.
- **content** (`ContentEntryDecl[]`): mirror the 3 live journal posts (typeKey `blog_post`,
  `status:'published'`, `body:{title,excerpt,body:doc}`, optional featuredImage via
  `{$asset:'<id>'}`). Built-in types → `contentTypes:[]`.
- **emails** (`EmailDecl[]`): `{name, doc:SilicaEmailDocumentInput, publish?}`. ≥1 welcome
  email. TODO: read `SilicaEmailDocumentInput` shape before authoring.
- **assets** (`AssetDecl[]`): every product image + og/hero image referenced by `*AssetId`
  or `{$asset}`. `url` = absolute https (Unsplash) or `data:image/...`.
- **site** (`SiteDecl`): **CAPTURE from live** — `get_silica_site` (full pages+frame+theme+
  symbols) → build `{frame:{root}, pages:[{name,kind,recordType?,slug?,root,seo...}], theme,
symbols}`, drop runtime ids, home slug `''`→omit. Validate through `captureSite`/schema.
  Keep `site.theme` (ship the Ember tokens verbatim, per decision #2).

**Validate:** `safeParseBlueprint(manifest)` (from `@sparx/blueprints`) — write a throwaway
node/vitest check, or lean on `marketplace:ingest`'s own validation locally.
**Media:** `icon.png` 512×512 + `preview.png` ~1600×1000 — screenshot the live Home for
preview; icon is a design asset (sparx spark mark from `@sparx/brand`).
**Ingest:** `pnpm --filter @sparx/api-rest marketplace:ingest` (local docker) — the catalog
row + artifact appear immediately; prod uses `marketplace-ingest.yml`.

## Blueprint bundle plan (`marketplace-catalog/blueprints/sparx/`)

```
sparx/
  sparx.json      # category:blueprint, slug:sparx, version, vertical, requiredModules, media
  blueprint.ts    # export default { key, version, name, summary, vertical, requiresModules,
                  #   brand (sparx Ember), theme (captured), assets, contentTypes, content,
                  #   commerce (neutral goods + collections/categories), site (captured), emails }
  media/ icon.png (512×512), preview.png (~1600×1000)  # BOTH required by ingest
```

- `requiresModules`: `builder, commerce, cms, crm, email` (+ others as surfaces land).
- Ingest: `pnpm --filter @sparx/api-rest marketplace:ingest` (local) / `marketplace-ingest.yml` (prod).
- Capture: `pnpm --filter @sparx/api-rest blueprint:capture -- --tenant <id> --property c99e0e23…`
  (local/docker only — use the MCP-read workaround for the prod site, constraint #4).

## Screenshot review fixes (2026-07-24, Brandon's Book-page screenshot)

1. **Logo/favicon were the WizeWorks "W".** ✅ Built the real **sparx wordmark** (light +
   dark, so it flips with the theme) + **spark favicon** as SVGs from `@sparx/brand`
   geometry, uploaded via `upload_image`, set via `update_site_settings`
   (logoLight `19e69e0f…`, logoDark `4245aa38…`, favicon `4f13814f…`), and set the frame's
   `site.brand` core to `show:"logo"` so the header is the wordmark alone (no "Template"
   text). Property can't be renamed via MCP, so the footer still binds name → "Template"
   (re-skins on install; acceptable).
2. **Chat widget used tenant/legacy colors, not the site's.** Root cause: `layout.tsx`
   passed `accentColor={site.theme?.colorPrimary}` = the LEGACY brand-compiled primary,
   which on this tenant is stuck indigo `#4f46e5` (the legacy compile derives from the
   tenant Brand record and did NOT pick up an applied Ember saved theme OR a presentation
   overlay — both tried, both ignored in `compiledTokens`). ✅ **Code fix** (uncommitted):
   `layout.tsx` now prefers `silicaFrame.theme.tokens['--color-primary']` when silica is
   active, falling back to legacy. Typechecks. **Needs deploy.** Also created+applied an
   Ember **saved theme** `07cd7da8-e3a4-4504-bb1b-62cc04fe35c1` (this IS the bundle's
   `ThemeDecl` content: basePresetKey apex + Ember brand).
3. **"Book a time with us" / "Book with us" duplicated** (my hero vs the core's own
   header). ✅ Reworked: hero is now "On your schedule"; the `scheduling.services` core
   keeps its own "Book with us" header lower down. No duplicate.
4. **Booking doesn't load** — there are NO scheduling services. Blueprints can't carry
   them (constraint #1), and at the time no MCP tool could create one. ✅ **Closed properly:
   I added `create_scheduling_service`** (see below) rather than leaving it — Brandon's call
   ("a user will want their agent to set up schedules in their tenant"). ✅ Also reworked the
   Book page (#6) so it reads as complete even while the widget is empty. **After api-mcp
   deploy + reconnect: seed 2–3 services and /book populates.**
5. **Legal footer column missing.** Correct behavior, not a bug: the `site.legal-links`
   core renders only PUBLISHED legal placements, and this tenant's 6 legal pages are all
   `draft`/`acknowledged:false`. Publishing them requires the **human acknowledge+publish**
   step in workbench Content → Legal pages (no MCP tool — approval is human by design, per
   [[project_legal_pages_mcp]]). ⬜ **Brandon action** to make the column appear live.
6. **Book page was bland.** ✅ Reworked into hero → "How booking works" (3 numbered steps)
   → "What you can book" (3 type cards) → the live booking core → a "Not sure what fits?"
   CTA band.

**New assets:** logo/wordmark media ids above; saved theme `07cd7da8…`.

## Second review round (2026-07-24) — logo swap, shop, journal images, search

7. **Light/dark logos were inverted.** Root cause: `site-brand.tsx` swapped them with
   Tailwind's `dark:hidden` / `dark:block`, but this app defines **no `@custom-variant
dark`**, so `dark:` compiles to `prefers-color-scheme` — while the storefront's dark
   mode is the **`data-theme` attribute** the toggle + no-flash script set. OS-light +
   theme-dark showed the ink logo on a dark bar (invisible), and vice-versa. ✅ **Code fix**
   (uncommitted): the swap now keys on `[[data-theme=dark]_&]`. **Needs deploy.**
8. **Shop had no filter / search / paging.** I'd authored a flat `commerce.product` bound
   grid. The catch-all route already passes `searchParams` to host cores _specifically_
   for "the faceted PLP on /shop" — the right node is the **`commerce.plp` host core**.
   ✅ Shop now mounts it (facets + sort + pagination). Live.
9. **Journal images missing everywhere.** The 3 new posts had no `featuredImage` (the
   binding was fine — there was simply nothing to bind). ✅ Registered 3 images via
   `set_image_from_url` and set `featuredImage` on each (`update_content_entry` REPLACES
   `body` and re-validates, so the full body must be resent). Live.
10. **`/search?q=…` returned 500 — and so does `/products`.** ROOT CAUSE is **[BUG-003]
    (../bugs/BUG-003-storefront-shop-500-typesense-port-collision.md)**, already diagnosed:
    a k8s Service named `typesense` makes Kubernetes inject the Docker-legacy
    `TYPESENSE_PORT=tcp://<clusterIP>:8108` service-link var, which shadows the app's own
    port → the client builds `http://typesense:null/...` → `ERR_INVALID_URL`. Confirmed live
    in api-rest logs. This breaks **every** faceted PLP + all product/⌘K search **and the
    commerce-indexer's writes** (so nothing is indexed either).

- The BUG-003 fix (defensive port resolution in `packages/search/src/client.ts` +
  `enableServiceLinks: false` in `k8s/apps/api-rest.yaml`) is **written but UNCOMMITTED
  and UNDEPLOYED** — verified: `enableServiceLinks` is absent from HEAD. That is why prod
  still 500s. **Committing + deploying it is what actually fixes shop/search.**
- ✅ I added complementary resilience (uncommitted): `searchProducts` now degrades to an
  empty result instead of propagating, matching `searchEverything`/`listRelatedProducts`,
  so a future search-backend failure never 500s the storefront again.
- ⚠ `/shop` now mounts the `commerce.plp` core, which depends on that search endpoint —
  it renders EMPTY until BUG-003 deploys. (The old flat `commerce.product` grid did not,
  because it uses the non-search list endpoint.) Correct long-term; deploy closes it.

### MCP capability work (two batches)

**Batch 1 — shipped in v1.161.0.** `create_scheduling_service` (+ update/delete) and
`create_product`. Details in the two subsections below.

**Batch 2 — written this session, gate-green, awaiting a deploy.** Full-workspace
`pnpm typecheck` passes (exit 0); `@sparx/commerce`, `@sparx/scheduling`, and the api-mcp
`tool-scopes` suite all pass; all touched files prettier-clean.

| Tool                                                             | Where                                        | Why it had to exist                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `update_product`, `update_variant`                               | `packages/commerce/src/mcp/write-tools.ts`   | `create_product` shipped with no partner — a typo or wrong price meant archiving and rebuilding, losing the handle and burning the SKU (tenant-unique even soft-deleted). Price lives on the VARIANT, hence two tools; each description points at the other. |
| `create/update/delete_scheduling_resource`, `set_resource_hours` | `packages/scheduling/src/mcp/write-tools.ts` | A service alone offers **zero** slots — `availability.ts` computes per resource and defaults to needing a `staff` one with weekly hours. Without these, `create_scheduling_service` still left /book empty.                                                  |
| `list_scheduling_resources`, `list_resource_hours`               | `packages/scheduling/src/mcp/read-tools.ts`  | "Availability is empty" is almost always one of these two; an agent needs to be able to see which.                                                                                                                                                           |
| `rebuild_search_index`                                           | `services/api-mcp/src/search-admin-tools.ts` | BUG-004: no tenant-reachable reindex existed — only `POST /v1/search/reindex` (admin role) and the platform-operator endpoint. Publishes the same `search.reindex.requested` event.                                                                          |

`rebuild_search_index` lives in **api-mcp**, not `@sparx/search`, on purpose: publishing
needs `@sparx/events` → `@google-cloud/pubsub`, and `@sparx/search` is imported by the Next
apps for the ⌘K palette. Same precedent as `domain-tools.ts`. It introduces a new
**`write:search`** scope (`packages/auth/src/mcp-scopes.ts`), `sensitive`, and — matching the
REST route it mirrors — **owner/admin only**, excluded from the editor grant. A new scope
means the connector must **re-consent**, not just reconnect.

Docs updated to match: [22](../22-typesense-search-spec.md) v1.2.0 (reindex is now
tenant-reachable + why the tool lives where it does), [79](../79-scheduling.md) v1.5
(§17.2 gained a "shipped set" table — the sketch's names were never the real ones).

### MCP capability gap closed — scheduling service setup

`packages/scheduling/src/mcp/write-tools.ts` gained **`create_scheduling_service`**,
`update_scheduling_service`, `delete_scheduling_service` (thin wrappers over the existing
`createService`/`updateService`/`deleteService` + `CreateServiceInput`/`UpdateServiceInput`).
api-mcp spreads `...schedulingMcpTools` and `write:scheduling` is already an allowed scope,
so they publish on redeploy. **Without this an agent could take bookings but never define
what is bookable** — the reason a fresh site's /book page renders empty.

### MCP capability gap closed — product creation

`packages/commerce/src/mcp/write-tools.ts` gained **`create_product`**. NOT a thin wrapper:
`productService.create` deliberately mints **no variant** (variants belong to
`variantService`), and a product with no variant has no price, a null `defaultVariantId`,
and an add-to-cart that refuses to fire — so exposing the bare create would hand agents a
tool that reliably makes **unsellable** products. The tool therefore takes `priceCents` and
**composes `productService.create` + `variantService.create`** (default variant, SKU derived
from the resolved handle when omitted). Multi-variant lattices stay with the variant surface.
Auto-registers via the `commerceMcpTools` spread; `write:commerce` already allowed.

### Deploy dependency

**Deploy 1 — DONE (v1.161.0, 2026-07-24 12:53 UTC).** All of it verified live:
`apps/site/components/brand/site-brand.tsx` (logo swap) · `apps/site/app/layout.tsx` (chat
accent) · `apps/site/lib/commerce.ts` (search degrades, no 500) ·
`packages/search/src/client.ts` + `k8s/apps/api-rest.yaml` (**BUG-003**) ·
`packages/scheduling/src/mcp/write-tools.ts` (service setup) ·
`packages/commerce/src/mcp/write-tools.ts` (`create_product`).

**Deploy 2 — PENDING (uncommitted, gate-green).**

| File                                         | Adds                                                             |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `packages/commerce/src/mcp/write-tools.ts`   | `update_product`, `update_variant`                               |
| `packages/scheduling/src/mcp/write-tools.ts` | `create/update/delete_scheduling_resource`, `set_resource_hours` |
| `packages/scheduling/src/mcp/read-tools.ts`  | `list_scheduling_resources`, `list_resource_hours`               |
| `services/api-mcp/src/search-admin-tools.ts` | **new** — `rebuild_search_index`                                 |
| `services/api-mcp/src/tool-registry.ts`      | registers it; `write:search` added to `WRITE_SCOPES`             |
| `packages/auth/src/mcp-scopes.ts`            | `write:search` scope (sensitive, owner/admin only)               |
| `docs/22-…md` · `docs/79-…md`                | doc updates (versions bumped)                                    |

**After deploy + MCP re-consent:** `rebuild_search_index` first (nothing in the catalog is
visible until then), then service → resource → hours, then the neutral catalog, then verify,
then capture the site and finish the bundle.

## Log

- **2026-07-24** — Scoped the effort; user confirmed all-modules + ship-theme; chose
  sparx-branded vertical-neutral identity. Unpublished 3 off-brand SaaS posts. Set the
  sparx Ember theme (draft). Wrote this doc.
- **2026-07-24 (cont.)** — Discovered no create/update product over MCP → neutral catalog
  goes in the bundle, not live (doc constraint 2b + "Two workstreams"). Authored (draft,
  not yet published): **Home** (full multi-module showcase), **Book** (scheduling host
  core), **Wholesale** (B2B), **Shop** (commerce.product grid), **About** (universal
  voice). Remaining before publish: Contact + Journal verify, add Book/Wholesale to nav,
  SEO. Then record templates, then the bundle. Nothing published yet — live site still
  shows old generic content until `publish_silica_site`.
- **2026-07-24 (publish 1)** — Set SEO on Book + Wholesale; **published** the site
  (`publish_silica_site`). Live: Ember theme + Home/Shop/About + Book + Wholesale.
  Verified all resolve 200 with correct content + Ember `#e04631` in CSS.
- **2026-07-24 (publish 2)** — Added **Book to primary nav + Wholesale to footer** (frame
  replace, kept brand/theme-toggle/legal-links host cores + single Outlet), published.
  Verified **Contact** (working `contact` Form → CRM, universal copy) and **Journal**
  (universal blog index) — both already good, no change. Authored 3 **universal journal
  posts** (launch-in-a-weekend, product-descriptions, first-time-buyers) published;
  unpublished the 2 food posts. Live Journal now coherent. ⚠ New posts have no
  featuredImage → placeholder tiles (polish later / real URLs in the bundle).
- **DECISION:** _Not_ authoring product/blog record templates on-site — the code defaults
  (`RECORD_TEMPLATES`) already render them well for every installed tenant and keep
  improving (a stored template would freeze). The template's module formatting is covered
  by the marketing pages + code defaults. Just verify they render live, then → the bundle.
- **2026-07-24 (review round 1 — Brandon's Book screenshot)** — Fixed logo/favicon → sparx
  wordmark + spark (uploaded, `show:"logo"`); reworked Book (no duplicate heading, rich
  page); diagnosed the chat accent (legacy theme) → code fix. Confirmed legal column is
  correct-but-empty (human publish gate). Published + verified.
- **2026-07-24 (review round 2)** — Simplified `silicaThemePrimary` per Brandon (it's always
  `--color-primary`; dropped the redundant dark fallback). Fixed the **light/dark logo
  inversion** (`dark:` ≠ `data-theme`). Shop → **`commerce.plp`** core. Set **featured
  images** on all 3 journal posts (live). Traced `/search` + `/products` 500 to **BUG-003**
  (Typesense port shadowed by k8s service links) — fix already written but uncommitted;
  added complementary `searchProducts` degradation.
- **2026-07-24 (MCP capability work)** — Brandon: _"this is THE GOLDEN STANDARD OF
  EVERYTHING… add that to the mcp and push that out, and anything else."_ Added
  **`create_scheduling_service`/update/delete** and **`create_product`** (which composes
  product plus a default priced variant, because the bare service mints no variant →
  unsellable). Both gate-green and auto-registering.
- **2026-07-24 (session 3 — post-deploy verification)** — **v1.161.0 is live.** Confirmed
  `git tag --contains d563c31d` → v1.161.0 and both api-mcp + api-rest pods run that tag.
  Verified live: `/`, `/shop`, `/search?q=`, `/products`, `/book`, `/about`, `/wholesale`,
  `/contact` all **200** (BUG-003 closed). Journal images resolve 200 through the media
  302 → Unsplash, so that report is closed too; the Journal page is at **`/blog`**, not
  `/journal`. `/book` shows a clean "No services are bookable yet". Footer Legal column
  still empty (awaiting Brandon's acknowledge + publish).
  - **Found BUG-004:** every search-backed surface renders "No products found" on **all
    three** sites while 21 products exist — the Typesense collection was never populated
    for this tenant. The indexer is healthy; nothing backfills rows written while
    `TYPESENSE_PORT` was shadowed. No tenant-reachable reindex existed.
  - **Found the deeper scheduling gap:** `create_scheduling_service` alone can never make
    /book work — availability is computed per RESOURCE, and a service with no resource (or
    a resource with no hours) offers zero slots.
  - Added, gate-green: `rebuild_search_index` (+ `write:search` scope), the scheduling
    **resource + hours** tools and their reads, and `update_product` / `update_variant`.
    Full `pnpm typecheck` exit 0.
- **NEXT SESSION STARTS HERE:** deploy batch 2 + **re-consent** the MCP connector (new
  scope), then RESUME HERE steps 1–5. Step 1 (`rebuild_search_index`) gates everything
  catalog-shaped.
