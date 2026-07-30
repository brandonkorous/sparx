# Perfect Template → sparx Blueprint

Version: 1.5.0
Author: Brandon Korous
Last Updated: 2026-07-28

> **Living build doc.** The single source of truth for the "perfect template" effort so
> it survives context compaction. Update the **Status** table + **Log** as work lands.

> ## ▶ RESUME HERE
>
> **STATUS (2026-07-29, session 9): THEMING SPINE + 20 THEMED CLONES BUILT (uncommitted).**
> `site.theme` is now the single source of the look for storefront AND email, the golden `sparx`
> template is the default new site, and the marketplace ships **21 blueprints** = golden `sparx`
> (Ember) + **20 themed clones** `sparx-<name>` (one per `SPARX_THEMES` silica preset). The old 10
> `DataThemePreset` marketplace themes are RETIRED. All built + gate-clean + locally ingested;
> UNCOMMITTED in the working tree (see the session-9 Log entry). **Remaining (gated on Brandon's
> stack smoke-test of storefront/email/onboarding): the staged legacy `--st-*` sweep + the brand→silica
> backfill migration + themed `preview.png` per clone + the prod purge/ingest triggers.** Full detail:
> [[active_theming_spine_golden_default]] memory + the session-9 Log entry below.
>
> **STATUS (2026-07-29, session 8): BUNDLE IS COMMITTED + LIVE IN PROD MARKETPLACE.**
> `marketplace-catalog/blueprints/sparx/` is committed to main (commit `d839df26`) and now
> **published to the prod catalog**: ran **Marketplace Purge Blueprints** (dropped the 5 orphan
> first-party blueprints `farm-fresh`/`farm-fresh-bowls`/`mosaic`/`forge`/`tempo`) then **Marketplace
> Ingest** (`wrote blueprints/sparx@1.1.0`; `done: 1 written, 21 total` — the 10 components + 10 themes
> `skip`-ped as pre-existing; both `workflow_dispatch` Jobs completed successfully 2026-07-29). Prod
> **blueprints** catalog = just `sparx@1.1.0`. It appears in `/marketplace` + `/v1/blueprints`
> immediately (runtime is DB-first). NOTE: prod shipped **v1.1.0** (sparx.json was bumped from the
> session-7 v1.0.0). The bundle = 7 pages · frame · Ember theme · 6 products + `goods` category +
> `bestsellers` collection · 9 image assets · 3 journal posts · 1 welcome email · `icon.png` (sparx
> spark 512) · `preview.png` (1600×1000 live-home shot).
>
> **REMAINING (optional, live-verify):** install on a tenant (`POST /v1/blueprints/sparx/install` →
> `.../go-live`) + eyeball a fresh install end-to-end.
>
> Earlier (session 6b): storefront fully on silica; CART-IMG + hero animation live; the missing-`to`
> transactional-email bug FIXED + VERIFIED; the non-primary-site email-logo bug FIXED (still needs an
> api-rest redeploy — see the email-logo follow-up below).
>
> **Confirmed live this session (verified in prod HTML/bundle):**
>
> - **CART-IMG fixed + verified.** Client bundle now bakes `https://api.sparx.works` (no
>   `localhost:3100`); the exact previously-broken media asset returns a real JPEG over HTTPS.
>   No more mixed-content thumbnails, no Chrome PNA prompt. See [[infra_next_public_build_arg]].
> - **Hero animation — DONE on the right hero.** The Template's **published silica home hero**
>   now carries staggered `sui-animate-slide-up` (+`sui-delay-1/2/3`) on heading → subheading →
>   CTA row → image, edited via MCP `upsert_silica_page` (full-page replace; validated
>   byte-for-byte round-trip before publish) and confirmed in served HTML. (The earlier
>   `hero.tsx` change only covered section-renderer heroes.)
> - **Full-route sweep clean** — all 8 routes 200; no `st-*`, no `localhost`, no mixed-content,
>   no broken bindings; PDP width, product-card borders, booking CTA all verified.
>
> **FIXED this session — real code bug, NOT spam (left in working tree, NEEDS api-rest DEPLOY):**
>
> - **Booking/transactional email was silently dropped.** Cloud Run `email-worker` logs showed
>   `message did not match email.send schema; acking` at the exact booking times. Root cause:
>   `sendTenantEmailByKey` ([tenant-email.ts](../../services/api-rest/src/lib/tenant-email.ts))
>   published the raw `email.send` payload **without `to`** (`renderBuilderEmailDoc` returns only
>   the body). The worker's `RawSendSchema` REQUIRES `to`, so it acked/dropped every raw send —
>   **booking confirmation, owner "new booking" alert, order confirmation, shipping.** Chat +
>   automations + OTP were unaffected (they carry `to`) — which is why chat emails DID arrive.
>   Fix: add `to: args.to` to the publish. Prevention: new **`RawEmailSendPayload`** type in
>   `@sparx/events` mirroring the worker schema, applied via `satisfies` at both raw publish
>   sites (tenant-email + email-dispatch) so a missing `to` is now a COMPILE error. Typecheck +
>   lint clean. See [[bug_raw_email_send_needs_to]]. **After deploy: re-book → confirm the email.**
>   (This CORRECTS session-5's wrong "delivery/spam, not a code bug" conclusion.)
>
> **REMAINING follow-ups (small, optional):**
>
> - **`patch_silica_node` MCP tool** — `upsert_silica_page` is a full-page replace; a granular
>   node patch (pageId + node id → class/props/attrs/text) would remove the re-transcribe risk.
>   api-mcp slice.
>
> **THEN:** walk the whole site with Brandon → sign-off → only then author the bundle.
> `write:search` still ungranted (optional). Do NOT re-litigate _Locked decisions_.

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

**LIVE NOW (session 3, via MCP) — CATALOG SWAP COMPLETE + VERIFIED.** All 6 sparx goods are
**active, imaged, and on the Template `/shop`** (`set_product_image` — the tool built this
session — works; every card image returns `200 image/jpeg`, verified by eye pre-assign). The
sticker product was dropped for a **sparx Insulated Bottle** (stickers had no clean Unsplash
shot). The 10 smoothies + sticker + `test` (12 total) are **archived** and gone from the shop.
The **Book schedule** is seeded (resource + 2 services + hours) but **/book still renders empty
until BUG-008 deploys** (below).

**BLOCKED ON DEPLOY 3** (code gate-green, uncommitted): `set_product_image` (the last
capability gap — products can't get a photo any other way over MCP), the BUG-005 serializer,
the BUG-006 api-mcp Typesense env. **`write:search`** still needs to be granted at reconnect
(it was NOT checked in the last re-consent).

**REMAINING AFTER DEPLOY 3 + reconnect:** see _RESUME HERE_, plus:

- ⬜ **Brandon action:** acknowledge + publish the 6 legal pages in workbench so the footer
  Legal column appears (human-gated by design). Confirmed still empty: the live footer emits
  zero legal hrefs and no "Legal" heading.
- ⬜ The site/property is still named **"Template"**, which the footer binds via
  `site.identity.name`. No MCP tool renames a property; decide whether that matters for the
  captured bundle (the installer sets the tenant's own name, so it may not).

## Every id in one place

| Thing                                                              | Value                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant (WizeWorks)                                                 | `1bfef66a-a489-4e0f-99fd-f041adc7ffaa`                                                                                                                                                                                                                                                                                                                                                                         |
| Property "Template"                                                | `c99e0e23-dae2-4814-b670-b73de5eec0f1`                                                                                                                                                                                                                                                                                                                                                                         |
| Pages                                                              | Home `1f816f35-3728-45ee-8202-de332da47bf8` · Shop `4ce6bdab-e94a-40f7-92f9-0fa6e7b9a6f7` · About `1f9940a2-8c0d-446b-bb16-7a5259cd417f` · Journal `a909d9d3-709e-43f1-ab88-1d35451201f8` · Contact `4cc42b1d-0e32-4a02-8c78-780630f6aba9` · Book `72a5317f-95d9-4625-bed5-7bdb1e0fad9a` · Wholesale `1a60abc3-a47d-4e0f-99b6-17f04fa39892`                                                                    |
| Logo media                                                         | light `19e69e0f-93ee-4942-9865-693f3eaab831` · dark `4245aa38-6ffc-4e6a-82be-8e4a22cf92f1` · favicon(spark) `4f13814f-a034-4a02-b3b3-3bf0f85643a7`                                                                                                                                                                                                                                                             |
| **Schedule (Book page)**                                           | resource "sparx Team" (staff, America/Denver, M–F 9–5) `57f5a81c-ed71-409a-9665-62e1374f3852` · service "Intro Consultation" (30m, free) `0588abc9-9d53-4c85-9562-b775c1b60752` · service "Working Session" (60m, $120) `f5a9cdc4-1832-4263-90bb-1ecea01be12f`                                                                                                                                                 |
| **sparx catalog (6, ACTIVE + imaged)**                             | Field Notebook `cea66e75` (Paper $14) · Everyday Tee `9efd4eb7` (Apparel $28) · Enamel Mug `78013471` (Drinkware $18) · Canvas Tote `5f5c0bee` (Accessories $22/$30) · Ripstop Cap `7b934ebc` (Apparel $26) · **Insulated Bottle `6460514e`** (Drinkware $32 — replaced the sticker). vendor `sparx`, scoped to Template; each has a primary Unsplash photo (200 image/jpeg).                                  |
| sparx catalog **variant ids** (for the BUG-009 post-deploy resync) | Notebook `84a58c8b-de4a-4ab3-a60c-351944c4e348` · Tee `f3b55672-8536-453e-a514-92bd31d07bb5` · Mug `a00b2d9f-449c-469d-9a79-d980ac24fb00` · Tote `3a9082c4-b9aa-484e-8e0a-1559c0969f60` · Cap `42f9e0c5-99d3-49b0-9785-fc28b1eda449` · Bottle `623c7564-c8f8-4649-bf04-6dba66c96072`. All set to `inventoryPolicy:"continue"` — but `inStock` column is stale `false` until re-run post-BUG-009 (RESUME HERE). |
| Archived (12)                                                      | 10 smoothies `6b48c060` `08ceebb8` `bbcfbd7d` `c2501fd4` `74f965be` `eaeac552` `8ca74965` `0b8bf7db` `9694f3c3` `4d50ed2e` + sticker `6244d330` + test `6e9d5e57`                                                                                                                                                                                                                                              |
| Saved theme (legacy/ThemeDecl)                                     | `07cd7da8-e3a4-4504-bb1b-62cc04fe35c1` (name `sparx`, base `apex`, Ember brand)                                                                                                                                                                                                                                                                                                                                |
| Journal posts                                                      | launch `32d5b258-cd0e-4495-a656-170ba5acbffa` (img `a7b995f8-d68a-46e3-9eec-dcf4e9a44ec0`) · descriptions `8a0fd5a3-920e-484c-9e9f-b5e82e106af6` (img `1382becc-80a3-4daa-8f56-672a8148f70d`) · regulars `722df7b1-6b2b-415c-b7ad-70ba9f6440eb` (img `a12ddc25-8f7e-4c00-8b9a-362e3b64b493`)                                                                                                                   |
| Retired posts (draft)                                              | food: `6d9062ba…`, `e3f76ee4…` · SaaS: `31a0e63f…`, `f5d5e11b…`, `b2988887…`                                                                                                                                                                                                                                                                                                                                   |

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

**Deploy 2 — DONE (v1.163.0, 2026-07-24 19:34 UTC).** `update_product`, `update_variant`,
the scheduling resource + hours tools and their reads, `rebuild_search_index` + the
`write:search` scope. Verified live (services/resource/hours seeded through them).

**Deploy 3 — DONE (v1.163.2 images + bootstrap `apps` manifest apply). All verified live.**
`set_product_image` (`write-tools.ts`), BUG-005 (`server.ts` + test), BUG-006 (`api-mcp.yaml`
Typesense env — the bootstrap `apps` apply landed it: pod has `TYPESENSE_API_KEY`,
`enableServiceLinks:false`, no injected `TYPESENSE_PORT`; `search_products` works), BUG-007
(`commerce-indexer` reindex + handler).

**Deploy 4 — DONE + verified live (2026-07-24). BUG-009 recovery ran (all 6 variants
re-synced); `/shop` shows no "Sold out", `/book` lists both services with real slots.**

| File                                                | Fixes                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/site/lib/scheduling.ts`                       | **BUG-008** — scope the storefront service list to the active site (pass `?property=`) |
| `packages/inventory/src/services/internal.ts`       | **BUG-009** — `syncProductInStock` is module-aware (inventory off → always in stock)   |
| `packages/inventory/src/index.ts`                   | BUG-009 — export `syncProductInStock`                                                  |
| `packages/commerce/src/services/variant-service.ts` | BUG-009 — call it at variant create + on any policy-bearing update                     |

Which images Deploy 4 rolls: **apps/site** (BUG-008 storefront read) + **api-mcp** and
**api-rest** (BUG-009 — they own variant create/update; the blueprint installer goes through
`variantService.create` too, so it's covered). The storefront only READS `inStock`, so
apps/site needs no BUG-009 change.

BUG-008: `lib/scheduling.ts` fetched `/v1/public/scheduling/services` with only `tenant=`, so
a non-primary site fell back to the tenant's PRIMARY site and showed none of its own services —
the Template `/book` read the (empty) WizeWorks list. `lib/commerce.ts` already passes
`?property=`; this mirrors it. Only the LIST needs it — availability/booking are keyed on
`serviceId`, so the browser client (`scheduling-client.ts`) needs no change.

**BUG-009 (found live this session — Brandon's inventory-module insight):** the storefront PLP
is search-backed and reads the denormalized `Product.inStock` column, which **defaults `false`**
and was only ever corrected by an inventory MOVEMENT (`syncProductInStock` was called from the
ledger + reservation paths only). So a product with a `continue`/`preorder` policy — OR any
product on a tenant with the **inventory module OFF** (who can't and shouldn't manage stock) —
stayed stuck at "Sold out" on the storefront forever. `computeAvailability` already models this
via an `inventoryActive` flag (off → `inStock:true, tracked:false`); the denormalized column
just never got the same treatment. Fix: `syncProductInStock` takes `inventoryActive` (default
true for the inventory-internal callers) and short-circuits to `inStock:true, lowStock:false`
when off; commerce's variant create + update resolve the flag via `isInventoryActive()` and
call it (create always; update whenever the patch carries `inventoryPolicy`, so a stale flag is
repairable by re-setting the same policy). This fixes the live shop AND every future blueprint
install (the installer uses `variantService.create`). It does **not** self-heal the 6 existing
variants — see the post-deploy recovery in RESUME HERE.

**BUG-007 (found live this session):** the wize-admin operator **Reindex** button crashed the
worker — `Invalid UUID for userId: rZqhan9PO1EdZEVwgRyg9OfrB9iQN9Wm`. `reindex.ts` set the RLS
`userId` from `event.actorId`, but the operator's id is a Better Auth (non-UUID) id and
`withTenant` validates it. Because the button ran with `dropStale: true`, it **dropped the
tenant's products collection and then crashed before reprojecting → product search is empty
tenant-wide right now.** The indexer is a tenant-scoped system batch and never needs
`app.user_id`; fixed in both the reindex and real-time paths. **Recovery:** self-heals as soon
as Deploy 3 lands — activating the 6 sparx goods reprojects them (real-time path, now robust),
and a re-run of the operator button (or `rebuild_search_index`) rebuilds cleanly. The only
active products tenant-wide were the smoothies (being archived), so the empty window costs
nothing but the live `/shop` looking bare until then.

**`write:search` was NOT granted** at the last reconnect — it must be checked on the consent
screen for `rebuild_search_index` to run (optional for the template; the catalog swap
self-indexes).

## Log

- **2026-07-29 (session 9 — theming spine + 20 themed clones)** — Made `site.theme` the
  SINGLE source of the look for storefront **and** transactional email (OKLCH→hex per send is a
  format conversion of one source, not a second source), the golden `sparx` template the default
  new site, and `brand` identity-only. **Foundation:** `colorToHex()` in
  `packages/site-themes/src/v2/color.ts`; `resolveSparxTheme()` + `BASE_SILICA_THEME` in
  `packages/silica-catalog/src/` (turn a raw silica `Theme` into the flat 34-light/25-dark
  ship-ready bag). **Phase 1 (storefront):** `apps/site/app/layout.tsx` always resolves a concrete
  silica theme (base-theme fallback for the previously-unthemed case); non-regressing. **Phase 2
  (email):** `packages/email-platform/src/services/brand-service.ts` reads the send property's
  `builder_site.silicaPublishedTheme` → BrandTokens via `colorToHex`, identity still from brand.
  **Phase 3 (onboarding):** nothing default-on; the blueprint gallery no longer module-filters
  (template ⊥ modules); the default blueprint choice is golden. **Phase 4 (20 clones):** new
  generator `marketplace-catalog/_gen/gen-sparx-themed.ts` reads `SPARX_THEMES` + the golden bundle
  and emits `blueprints/sparx-<name>/` for all 20 themes (same content/commerce/emails; only
  `site.theme` + `brand` + `theme` differ). All 20 pass `safeParseBlueprint`; local ingest wrote
  **21 blueprints** (golden `sparx@1.1.0` + 20 clones@1.0.0), catalog verified. **Phase 5a/5b (old
  themes retired):** deleted `marketplace-catalog/themes/` (10 dirs) + `_src/themes.ts` +
  `_gen/gen-theme-bundles.ts` (zero code consumers — only the deleted generator + docs referenced
  them); added the themes-purge trio (`marketplace-purge-themes.ts` + `marketplace:purge-themes`
  script + `.github/workflows/marketplace-purge-themes.yml` + `k8s/sparx-prod/marketplace-purge-themes-job.yaml`),
  ran it locally (16 orphan rows cleared → **0 themes, 21 blueprints** locally). api-rest
  typechecks, changed files lint clean. **Uncommitted** — Brandon commits. **Gated on Brandon's
  stack smoke-test** (storefront themed light/dark, a themed transactional email, onboarding
  modules-all-off + golden pre-selected): the staged legacy `--st-*` / brand-derived-look sweep,
  the brand→silica backfill migration (option A), themed `preview.png` per clone (each currently
  ships golden's placeholder), and the prod **Marketplace Purge Themes** + **Marketplace Ingest**
  triggers.
- **2026-07-30 (cont. — landing-page content↔commerce parity)** — Brandon flagged the golden home
  read as a commerce-only "product landing page" (the above-the-fold / preview.png is hero + retail
  photo + "From the shop"; the bound "From the journal" CMS strip was buried below the features
  section). Rebalanced golden `site.json` home + regenerated all 20 clones: hero image →
  neutral workspace + hero secondary CTA → "Read the journal" (`/blog`) so the hero surfaces shop AND
  journal; reordered "From the journal" up to section #2 (order: hero→shop→journal→features→more-ways→cta).
  Kept the real bound grids (`commerce.featured`, `cms.blog_post`). A single big "featured story" card
  isn't cleanly supported on a non-collection home (the binding yields an array, no clean latest-one
  object), so parity is via placement + hero, not a featured-single card. Golden bumped 1.1.0→**1.2.0**
  (so the prod re-ingest picks up the new payload); all 21 pass `safeParseBlueprint`; local re-ingested.
  NOT pushed to the live Template yet (publishing a public site needs Brandon's OK); clone `preview.png`s
  are stale (→ Phase 6).
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
- **2026-07-24 (session 3 cont. — batch 2 deployed as v1.163.0)** — Confirmed the tag
  contains `search-admin-tools.ts`, `set_resource_hours`, and `write:search`, and the pod
  runs it (started 19:34 UTC). The connector tool list is **still stale** — the new tools
  remain un-callable, so the refresh is a client-side action, not a deploy problem.
  Probing with the tools I _do_ have turned up two more defects and one confirmation:
  - **BUG-005 — a successful write reported as a protocol error.** Calling `publish_product`
    returned an MCP schema violation. Root cause: `JSON.stringify(undefined)` is `undefined`,
    not `"undefined"`, so every tool wrapping a `Promise<void>` service (`publish_product`,
    `archive_product`, …) emitted `{type:'text', text: undefined}` and failed the SDK's
    result schema. **The write had already committed and published its event** — the worst
    shape of failure, because the agent believes it failed and retries a completed mutation.
    Fixed in `services/api-mcp/src/server.ts` (`serializeResult`: void → `{ok:true}`), with
    a regression test in `src/serialize-result.test.ts`.
  - **BUG-006 — api-mcp's four search tools were dead in prod.** `search_products` threw
    `TYPESENSE_API_KEY env var is required`: `k8s/apps/api-mcp.yaml` never got the Typesense
    env block api-rest has. Added it, plus `enableServiceLinks: false` for the same
    service-link collision that caused BUG-003 — before it bites a second service.
  - **✅ The indexer write path is PROVEN end-to-end.** That failed `publish_product` still
    fired its event: `commerce-indexer` processed it, and "Southwest Grain" went from absent
    to returned by `GET /v1/public/commerce/search?q=grain` and rendered on the live
    `/shop`. So **BUG-004 is purely a backfill problem** — touching a product re-indexes it,
    and newly created products will index themselves. `rebuild_search_index` is the one-shot
    remedy for the 21 historical rows.
- **2026-07-24 (session 3 cont. — connector refreshed, live seeding)** — Connector refresh
  exposed the batch-2 tools (verified callable). Used them to seed live: the **Book page
  schedule** (resource "sparx Team" M–F 9–5 + "Intro Consultation" 30m free + "Working
  Session" 60m $120), and **6 sparx-branded, vertical-neutral goods** as DRAFT (Field
  Notebook, Everyday Tee, Enamel Mug, Canvas Tote, Sticker Sheet, Ripstop Cap — ids in the
  id table). Kept them draft so the live shop keeps the smoothies (with images) until the
  sparx line has photos.
  - **Found + closed the last catalog gap: `set_product_image`.** `create_product` /
    `update_product` cover every field except the primary image, because images hang off the
    VARIANT (`variantImage`). A whole catalog could be built as grey placeholder tiles with
    no MCP way to fix it. Added `set_product_image` (composes `variantService.addImage` +
    `setPrimaryImage`), gate-green. User explicitly agreed this was warranted.
  - `rebuild_search_index` still `write:search`-forbidden (scope not granted at reconnect) —
    but NOT on the critical path; the catalog swap self-indexes.
- **2026-07-24 (session 3 cont. — Deploy 3 verified, catalog FINISHED)** — Confirmed live:
  BUG-005 (`publish_product` → `{"ok":true}`) and BUG-007 (Southwest Grain re-indexed, no
  crash). `set_product_image` came online; used it to finish the `/shop`:
  - Picked product photos by **downloading each candidate and viewing it** (a 200 status ≠ the
    right subject — the first "tote" was a hardware flat-lay, "stickers" was an Instagram
    logo, a "mug" was a latte). Dropped the sticker product entirely (no clean shot) for a
    **sparx Insulated Bottle**. Final 6 all have verified, category-correct photos.
  - Flow: create bottle → `set_image_from_url` ×6 → `set_product_image` ×6 → `update_product`
    status=active ×6 → `bulk_update_product_status` archived ×12 (10 smoothies + sticker +
    test). Verified: all 6 on the Template `/shop`, every card image `200 image/jpeg`,
    smoothies gone.
  - **Found BUG-008:** `/book` still empty because `apps/site/lib/scheduling.ts` didn't pass
    `?property=` (unlike `lib/commerce.ts`), so a non-primary site read the primary site's
    (empty) service list. Fixed + gate-green → **Deploy 4 (apps/site)**.
- **2026-07-24 (session 3 cont. — Deploy 3 fully live, BUG-009 found + fixed)** — Brandon ran
  bootstrap `apps` + reconnected. Verified: BUG-006 done (`search_products` works via MCP),
  BUG-005/007 confirmed. Finished the shop, then hit two things:
  - **"Sold out" on all 6 shop cards.** Traced to the denormalized `Product.inStock` column
    (search-backed PLP) defaulting `false` and only ever fixed by an inventory movement. Set
    all 6 variants to `inventoryPolicy:"continue"` — but the column didn't update (nothing
    re-syncs on a policy change). **Brandon's key insight:** a tenant without the inventory
    module can't track stock, so we must NOT default to `inStock:false`. → **BUG-009**:
    `syncProductInStock` made module-aware + called at variant create/policy-update. Fixes the
    live shop, inventory-off tenants, and every blueprint install. Gate-green.
  - **Did NOT start the blueprint bundle.** Confirmed with Brandon: the bundle is a capture of
    the APPROVED live site; he hasn't signed off yet. Holding at "perfect the live site."
- **2026-07-24 (session 4 — Deploy 4 live, recovery DONE)** — Brandon confirmed Deploy 4
  reached production. Ran the BUG-009 recovery: re-patched all 6 variants to
  `inventoryPolicy:"continue"`, which fired the new module-aware `syncProductInStock` and
  flipped their stale `inStock` columns. **Verified end-to-end in prod:** `/shop` shows all 6
  sparx goods with **no "Sold out"** (`in_stock:true` on every search hit); `/book` lists both
  services (Intro Consultation, Working Session) AND `get_scheduling_availability` returns
  hundreds of real slots for each. The live reference site is now functionally complete + every
  known bug fixed. **Did NOT start the bundle** — still holding for Brandon's full-site sign-off.
- **2026-07-24 (session 4 cont. — /book walkthrough fixes)** — Brandon walked `/book` and
  flagged it read as not-actionable. Two fixes:
  - **Reorder (LIVE via silica publish).** The published `book` silica page put the actual
    booking core (`scheduling.services` host) 4th, below two explainer sections ("How booking
    works", "What you can book"). Reordered so the booking list sits **directly under the
    hero**; explainers + CTA follow. Re-banded backgrounds for clean alternation
    (base-100 → base-200 → base-100 → base-200 → neutral) so no two adjacent sections share a
    tone, and fixed now-stale step-1 copy ("from the list below" → "above"). Done via
    `upsert_silica_page` + `publish_silica_site` on the Template site
    (`c99e0e23-…`), verified live with a cache-buster (edge cache served stale briefly; route
    headers are `no-cache`).
  - **Card affordance (CODE — gate-green, needs an apps/site deploy).**
    `apps/site/components/booking/booking-services.tsx`: each service card was a bare link that
    read as a static info block. Added a clear **"See open times →"** primary CTA (a styled
    `st-btn` span inside the card link — no nested control), fixed the description from `st-muted`
    → real ink (RULE #3), made duration/price readable (muted → `--st-text`, +weight; price shows
    "Free" at $0). `apps/site/app/site.css`: card → flex column so the CTA bottom-aligns across
    cards, removed the hover `box-shadow` (no-shadows rule) leaving the border-color hover.
    Typecheck + eslint + prettier clean.
- **2026-07-25 (session 5 — st-\* → silica migration + storefront fixes, all deployed)** — Ran
  the full `st-*` → silica migration of `apps/site` (114 files) via a worktree subagent
  ([[project_storefront_silica_migration]]), reconciled the 3 booking conflicts (`-X theirs` +
  re-applied seededDate/CTA), Brandon merged + deployed. Also deployed: product-page width fix
  (silica-catalog `productDetailPage`), booking widget first-bookable-day, /book reorder, card
  CTA + border, product-card border, contact real values. Diagnosed the booking email as a
  delivery/spam issue (pipeline is correct). **Found + fixed CART-IMG**: client `mediaUrl` baked
  `localhost:3100` because `NEXT_PUBLIC_API_URL` was never a build-arg → broken cart thumbnails +
  Chrome PNA prompt; fixed in Dockerfile + build-images.yml ([[infra_next_public_build_arg]]),
  pushed, needs the pipeline rebuild.
- **2026-07-25 (session 6 — CART-IMG confirmed, hero animation done, transactional-email bug fixed)** —
  Confirmed CART-IMG live in prod (bundle bakes `api.sparx.works`, real JPEG over HTTPS, no PNA
  prompt). Put the **hero animation** on the Template's PUBLISHED silica home hero via MCP
  `upsert_silica_page` (full-page replace — reproduced the 7-section tree, injected
  `sui-animate-slide-up`/`sui-delay-*` on 4 hero nodes by id, diff-validated only those 4 classes
  changed, byte-for-byte draft round-trip, then published); verified in served HTML. Ran a clean
  8-route walkthrough sweep. **Traced the booking email properly this time** (last session's
  "spam" call was WRONG): Cloud Run `email-worker` logs showed `did not match email.send schema;
acking` — `sendTenantEmailByKey` published the raw payload **without `to`**, which the worker's
  `RawSendSchema` requires, so it dropped EVERY raw transactional send (booking, order, shipping).
  Chat/automations/OTP were fine (they carry `to`). Fixed (`to: args.to`) + added prevention type
  **`RawEmailSendPayload`** in `@sparx/events` + `satisfies` guards at both raw publish sites so a
  missing `to` is a compile error. Typecheck + lint clean. Left in working tree for Brandon to
  commit/deploy. See [[bug_raw_email_send_needs_to]].
- **2026-07-25 (session 6b — `to` fix VERIFIED live + per-site email-logo bug fixed)** — Brandon
  deployed api-rest; re-booked the Template's free Intro Consultation (booking `1467525d`, customer
  Brandon Korous / bkorous@gmail.com). **Email arrived** — Cloud Run `email-worker` logged `message
processed` (no schema-drop), confirming the `to` fix end-to-end. Brandon flagged the email carried
  the **WizeWorks (tenant) logo, not the Template site's**. Traced it: `renderBuilderEmailDoc` →
  `brandService.resolveEmailBrand` (packages/email-platform) read the per-site logo from the LEGACY
  `override.logoMediaId` only, but the Builder Brand page always writes `logoLightMediaId` now
  (site-identity-data.ts `computeOverride` drops the legacy key). So every NON-PRIMARY site's
  transactional email fell back to the tenant logo. The storefront public payload resolves the same
  logo correctly via `mergeBrandIdentity` (`logoLightMediaId ?? logoMediaId`) — email was the only
  reader still on the old field. Fixed `resolveEmailBrand` to read
  `logoLightMediaId ?? logoMediaId ?? tenant` (+ added `logoLightMediaId` to its local `BrandOverride`
  type). Typecheck + lint clean. Needs an api-rest redeploy (logo is baked into the HTML at render
  time in api-rest). See [[bug_email_per_site_logo_field]].
- **2026-07-28 (session 7 — BUNDLE SCAFFOLD STARTED, Brandon signed off "build the gold blueprint")** —
  The sign-off gate is lifted. Began authoring `marketplace-catalog/blueprints/sparx/` (was empty).
  **Built + VALIDATED through `safeParseBlueprint` (via the ingest's own validator):**
  `sparx.json` (category:blueprint, payload:blueprint.ts, requires builder/commerce/cms/crm/email,
  media entries, accent Ember), `blueprint.ts` (the manifest default-export), `README.md` (the
  capture + fill runbook), a placeholder `site.json` (1 page, schema-valid, marked REPLACE), and a
  real `welcome-email.json` (generated from the `@sparx/builder-schemas` email kit —
  `emailDoc`/`section`/`heading`/`text`/`button` — since a blueprint is imported as pure data).
  **Authored real:** `brand` (sparx Ember `#e04631`/accent `#c1652e`/secondary `#4c9a8e`, Space
  Grotesk/Inter), `theme` (ThemeDecl: base `apex` + Ember brand look + `{v:2,containerWidth:'1152px'}`,
  apply:true), the welcome email (universal, `{{customer.firstName}}`/`{{site.name}}`/`{{site.url}}`).
  **KEY MECHANIC LEARNED:** the ingest does a bare `import(pathToFileURL(blueprint.ts))` with NO
  workspace resolution + there's no root `@sparx/*` symlink → **blueprint.ts must import ONLY sibling
  JSON, never `@sparx/*`** (the stale `marketplace-templates/blueprint/blueprint.ts` that imported
  `seedNode` was itself broken). So authored trees (site, email) are generated to JSON and imported
  with `with { type: 'json' }`. **MCP reconnected → BUNDLE FILLED FROM LIVE + VALIDATED.** Confirmed
  the connector is scoped to tenant WizeWorks and the Template is the NON-primary site `c99e0e23…`
  (passed `propertyId` on every read — the primary is `WizeWorks`, so omitting it would capture the
  wrong site). **`site.json`** via `get_silica_site` (55KB → saved to a tool-result FILE, not
  context; a node script transformed it to `SiteDecl` = zero transcription, byte-exact trees): 7
  pages + frame + Ember theme. The frame uses the `site.brand` host core (NO baked logo media ids →
  re-skins to the installer's own logo). **`commerce`** from `get_products`/`get_product` (6 goods
  verbatim) + ADDED a `goods` category + featured `bestsellers` collection (live had neither; makes
  the /shop facet + Home `commerce.featured` resolve); clean `SPX-*` SKUs, `inventoryPolicy:'continue'`
  (BUG-009). **`content.json`** from `list_content_entries` (3 posts, tiptap verbatim, featuredImage
  → `{$asset}`; the media proxy 302'd to the original Unsplash URLs, used directly). **`icon.png`** =
  the sparx spark (`images/favicons/icon-512.png`). **`preview.png`** = a 1600×1000 shot of the live
  home, captured via `npx -y playwright@latest screenshot --channel=chrome --viewport-size=1600,1000`
  (the Playwright MCP was NOT exposed to this session or subagents, and the cached playwright browsers
  didn't match `playwright@latest`; `--channel=chrome` drives the SYSTEM Chrome and writes the PNG
  directly — no MCP, no browser download). **Whole bundle passes `safeParseBlueprint` AND
  `marketplace:ingest` wrote `blueprints/sparx@1.0.0`** (payload compiled, media processed, catalog row
  upserted): 7 pages · 1 category · 1 collection · 6 products · 9 assets · 3 posts · 1 email.
- **2026-07-28 (session 7 cont. — OLD-BLUEPRINT CLEANUP, Brandon-confirmed).** The catalog had 5
  orphan first-party blueprint rows whose source bundles were gone from the repo (`farm-fresh`,
  `farm-fresh-bowls`, `mosaic`, `forge`, `tempo`). **Local docker:** ran
  `marketplace:purge-blueprints` (drops ALL first-party rows + artifacts) then `marketplace:ingest`
  → catalog = **just `sparx`** (verified: 1 row). **Repo:** deleted the legacy-format skeleton
  `marketplace-templates/blueprint/` (old `seedNode`/`BuilderNode` shape); fixed
  `docs/guides/building-a-template.md` (it was built around a non-existent `farm-fresh` example +
  `_gen/farm-fresh/` generator + the deleted skeleton) — repointed the worked example to
  `blueprints/sparx/` and documented the TWO real authoring paths (capture vs the `node()`
  generator, pointing at the real `gen-theme-bundles.ts`/`gen-component-bundles.ts`); fixed the
  broken `blueprint/` row in `marketplace-templates/README.md`. Zero dead `farm-fresh`/
  `gen-farm-fresh`/`marketplace-templates/blueprint` refs remain. **⬜ PROD (Brandon triggers):**
  those 5 orphans are likely in the prod catalog too — run the gated `marketplace-purge-blueprints.yml`
  workflow (typed confirmation), then the ingest workflow re-runs on merge → prod = just `sparx`.
- **2026-07-29 (session 8 — PUBLISHED TO PROD).** Brandon: "i don't see it in prod." Root cause:
  the bundle was committed to main (`d839df26`) but `marketplace-ingest.yml` is `workflow_dispatch`
  only and had not run since 2026-07-03 (bundle landed 2026-07-28), so prod storage + catalog were
  never populated. No bootstrap needed — both ingest + purge are self-contained Jobs (build their own
  api-rest image with `marketplace-catalog/` baked in; don't touch secrets/pods). Per Brandon's choice
  ("purge orphans, then ingest"): ran **Marketplace Purge Blueprints** (`confirm=purge-blueprints`,
  success — dropped the 5 orphan first-party blueprints) then **Marketplace Ingest** (success —
  `wrote blueprints/sparx@1.1.0`, `1 written, 21 total`). Prod blueprints catalog = just `sparx@1.1.0`.
- **NEXT SESSION STARTS HERE:** (1) After the next api-rest deploy, **re-book on the Template →
  confirm the confirmation email now shows the TEMPLATE logo** (the `to` fix is already verified).
  (2) Optional: build the `patch_silica_node` MCP tool (granular node patch vs full-page replace).
  (3) Continue / finish the full-site walkthrough for **SIGN-OFF** — do not author the bundle
  before that. Only after sign-off: author `marketplace-catalog/blueprints/sparx/`, capture the
  site (6 sparx goods → `commerce`), validate, ingest.
