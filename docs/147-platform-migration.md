# 147 — Platform migration: bringing a business off Shopify, Wix, WordPress, HubSpot & friends

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-08-11

> **This document is the plan AND the progress ledger.** §7 is a live task list — every task
> carries a status, and the status is updated as the work lands. "Done" is defined by that
> list being all-green, not by the headline importer working.

---

## 1. Why this exists

Nobody starts on sparx. Every tenant we will ever win is currently paying somebody else, and
their entire business — catalogue, customers, orders, stock, content, pipeline — is sitting
inside that somebody else. **The switching cost is the competitor's only real moat**, and it is
not a technical moat: it is the fear of a week of copy-paste and the certainty that something
will be lost.

Two halves, and they only work together:

1. **The capability.** A tenant uploads the export file their current platform already
   generates — `products_export.csv`, a WordPress WXR, a HubSpot contacts CSV — and sparx
   recognises it, maps it, shows them exactly what will happen, and does it. No column-mapping
   homework, no CSV surgery, no "please rename your headers to match ours."
2. **The claim.** One marketing page per competitor that says so, in that competitor's own
   vocabulary, naming that competitor's actual file names. A generic "we support imports" page
   converts nobody; `/migrate/shopify` that says _"the file is called `products_export.csv` and
   it's under Products → Export"_ converts the person who has that tab open.

### The state before this work

- [`services/import-worker/`](../services/import-worker) exists and is sound: `import.job.created`
  → load `ImportJob.rawRows` → per-entity processor → per-row `ImportJobRow` with error text.
- Processors exist for exactly four entities: **products, customers, b2b_accounts, discounts**.
- The API ([commerce](../services/api-rest/src/routes/v1/commerce/import.ts),
  [crm](../services/api-rest/src/routes/v1/crm/import.ts),
  [b2b](../services/api-rest/src/routes/v1/b2b/import.ts)) accepts a generic
  `rows: Record<string,string>[]`, plus a `columnMap` option **that nothing reads**.
- **Zero vendor awareness anywhere in the repo.** A tenant with a Shopify export has to hand-map
  it into our column names, which is the exact work we are claiming to remove.
- **No import UI at all** in `apps/workbench`. The backend is headless — there is no upload, no
  mapping, no preview, no progress, no error report.
- [`apps/web/app/migrate/page.tsx`](../apps/web/app/migrate/page.tsx) is a `<ComingSoon>` stub,
  `robots: { index: false }`, that **already advertises** Shopify/HubSpot/Mailchimp/WordPress
  importers which do not exist.
- Inventory has ~70 services and ~45 workbench surfaces and **no import path whatsoever** —
  [docs/68](68-wizards-import-export-bulk.md) has carried "inventory-adjustment CSV import
  (SKU + location)" as open since it was written.

---

## 2. Principles

**File-first, connector-second.** Every vendor gets "upload the export you already have." It
works on day one, needs no OAuth app review, no partner programme, no rate-limit budget, and
covers the platforms that have no usable API at all (Squarespace, Wix, Big Cartel). The live
API connectors are an accelerant for the three vendors that justify one — they are never the
only path, because a partner-programme rejection must never take the capability offline.

**The tenant never does column homework.** We detect the vendor from the file's own shape
(filename + header fingerprint), map it with a vendor adapter we maintain, and show the result.
The manual column mapper exists as an override for the unrecognised file, not as the default
experience.

**Nothing is uploaded until it has been checked, and nothing is written until they have seen
what will happen.** Two distinct gates, because they answer different questions:

1. **Client-side validation, before a single byte leaves the browser.** The workbench already
   parses the file locally, so it can also check it locally: missing required columns,
   unparseable prices, malformed emails, impossible dates, duplicate SKUs within the file, rows
   with no natural key, values past a field's limit. Instant, offline, and repeatable — the
   tenant fixes the file and re-drops it without ever having touched the server. A file that
   fails hard here is never uploaded at all.
2. **Server-side dry-run, before a single write.** Only the database can answer "does this SKU
   already exist," "is there a warehouse called Main," "does this order reference a customer we
   do not have." So the run is executed against the real tenant DB inside a transaction that is
   always rolled back, and reports create/update/skip/error per row.

The validator is **one implementation in `@sparx/migration`**, called from both the browser and
the worker. Two validators would drift, and the day they drift is the day the preview tells a
tenant something different from what the import does.

**No new tables.** A migration run is a set of `ImportJob` rows sharing an
`options.migrationRunId`. `entityType` is already `VarChar(50)` free-form, so new entities are
code, not schema. This keeps the whole feature outside the migration pipeline and off the
critical path — see [packages/db/CLAUDE.md](../packages/db/CLAUDE.md) for why that matters.

**Zero new dependencies.** `@sparx/migration` ships its own RFC-4180 CSV reader and its own
WXR/XML reader. Both are ~200 lines, both are tested, and both handle the vendor quirks a
general-purpose library would fight us on (Shopify's embedded newlines inside `Body (HTML)`,
WordPress's CDATA-wrapped everything, BOM-prefixed exports from Excel round-trips).

**Parse in the browser, submit rows.** The workbench parses the file and posts canonical rows in
chunks. No blob storage, no upload endpoint, no new bucket, no new cost. Large catalogues chunk
into multiple `ImportJob`s under one run.

**Modules gate the entity, not the migration.** A tenant without commerce importing a WordPress
site gets their posts, pages and media and is told plainly that the products in the file were
skipped because commerce is off — never a 403, never a silent drop. Consistent with
[[feedback_template_independent_of_modules]]: one complete source, the appropriate subset lands.

---

## 3. Vendor roster

Twenty platforms, chosen for "somebody is paying them right now instead of us." Each row states
what that vendor can actually emit — the roster is bounded by their export, not by our appetite.

| Vendor         | Slug          | What they export                                                     | Entities we take                                                                                  |
| -------------- | ------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Shopify        | `shopify`     | products / customers / orders / inventory / discounts CSV; Admin API | products, variants, customers, orders, inventory, discounts, collections, pages, blogs, redirects |
| BigCommerce    | `bigcommerce` | products / customers / orders CSV                                    | products, variants, customers, orders, categories                                                 |
| WooCommerce    | `woocommerce` | product / customer / order CSV + WXR                                 | products, variants, customers, orders, categories, content, media                                 |
| Adobe Commerce | `magento`     | product / customer CSV                                               | products, variants, customers, categories, inventory                                              |
| Wix            | `wix`         | products / contacts / orders CSV                                     | products, variants, customers, orders, inventory                                                  |
| Squarespace    | `squarespace` | products CSV + WXR                                                   | products, customers, orders, content, media                                                       |
| Webflow        | `webflow`     | CMS collection CSV, ecommerce products CSV                           | products, content, media                                                                          |
| Etsy           | `etsy`        | listings CSV, sold-orders CSV                                        | products, variants, orders, customers, inventory                                                  |
| Square Online  | `square`      | item library CSV, customer directory CSV                             | products, variants, inventory, customers                                                          |
| Big Cartel     | `bigcartel`   | products CSV, orders CSV                                             | products, inventory, orders, customers                                                            |
| GoDaddy        | `godaddy`     | products CSV, contacts CSV                                           | products, customers                                                                               |
| WordPress      | `wordpress`   | WXR XML                                                              | content, pages, categories, tags, media, redirects, authors                                       |
| Ghost          | `ghost`       | JSON export, members CSV                                             | content, tags, authors, customers                                                                 |
| Substack       | `substack`    | posts CSV/HTML, subscribers CSV                                      | content, customers                                                                                |
| Framer         | `framer`      | CMS collection CSV                                                   | content                                                                                           |
| HubSpot        | `hubspot`     | contacts / companies / deals / tickets CSV; API                      | customers, companies, deals, tickets, notes, lists                                                |
| Salesforce     | `salesforce`  | Accounts / Contacts / Leads / Opportunities / Cases CSV              | companies, customers, deals, tickets                                                              |
| Pipedrive      | `pipedrive`   | persons / organizations / deals CSV                                  | customers, companies, deals                                                                       |
| Mailchimp      | `mailchimp`   | audience CSV                                                         | customers, segments                                                                               |
| Klaviyo        | `klaviyo`     | profiles CSV                                                         | customers, segments                                                                               |

Live API connectors (phase 5): **Shopify** (Admin GraphQL), **WordPress/WooCommerce** (REST),
**HubSpot** (CRM v3). Everything else is file-only, permanently and by design.

---

## 4. Architecture

```
apps/workbench/surfaces/migration/          the operator experience
  ├─ migration-start        vendor picker → what you'll need
  ├─ migration-run          upload → detect → map → dry-run → execute → results
  └─ migration-history      past runs, per-row errors, re-run
        │  parses in-browser via
        ▼
packages/migration/                         @sparx/migration — pure, isomorphic, zero deps
  ├─ parse/csv.ts           RFC-4180 reader (quotes, embedded newlines, CRLF, BOM)
  ├─ parse/xml.ts           minimal XML/CDATA reader
  ├─ parse/wxr.ts           WordPress eXtended RSS → canonical content rows
  ├─ vendors/<slug>.ts      one adapter per vendor: fingerprints + field maps
  ├─ detect.ts              filename + header fingerprint → (vendor, entity, confidence)
  ├─ canonical.ts           the canonical row shape per entity — the contract
  └─ registry.ts            the vendor catalogue (also feeds apps/web)
        │  posts canonical rows to
        ▼
services/api-rest/src/routes/v1/migration/  the run API
  POST /v1/migration/runs                   create a run (n chunked ImportJobs)
  GET  /v1/migration/runs                   list
  GET  /v1/migration/runs/:runId            status + per-job rollup + errors
  POST /v1/migration/runs/:runId/cancel
  POST /v1/migration/preview                dry-run: validate rows, no writes
  GET  /v1/migration/vendors                the catalogue, module-aware
        │  publishes import.job.created  →
        ▼
services/import-worker/src/processors/      one processor per entity
  products · variants · customers · orders · inventory · categories · collections
  · content · media · redirects · companies · deals · tickets · discounts · b2b_accounts
```

`apps/web/app/migrate/` reads the **same** `@sparx/migration` registry the importer runs on, so
a marketing page can never claim an entity the importer does not carry. That is the entire
reason the registry lives in a shared package rather than in the app.

### The canonical row contract

A vendor adapter's only job is `vendorRow → canonicalRow`. Processors never learn a vendor
existed. This is what keeps twenty vendors from becoming twenty branches in the worker.

### Dry-run

Every processor implements a second, **read-only** `preview()` alongside `run()`. It resolves
each row's natural key against the tenant's real data and reports create / update / skip / error
without writing anything.

It is a separate function rather than a `dryRun` flag threaded through `run()`, and that is a
correctness decision, not a style one: the domain services this worker calls own their own
transactions, so there is **no outer transaction to roll back**. A flag would be a promise the
code cannot keep, and a preview that quietly wrote one row is worse than no preview at all.

The trade-off is stated plainly: `preview()` catches everything the database can answer — does
this SKU exist, is this order already here, will this location have to be created — and does not
catch a constraint that only fires inside a service's own validation. Those surface as per-row
errors during the real run, where they cost one row rather than the file.

---

## 5. Inventory (explicitly in scope)

Inventory is the entity most likely to be quietly dropped, and it is the one whose absence
costs a real business the most — a catalogue with no stock numbers is a shop that cannot sell.

- **`inventory_levels`** — SKU × location → on-hand quantity. Shopify's inventory export is a
  wide file (one column per location); Square's item library is the same shape. The adapter
  unpivots it into `(sku, location, qty)` rows, creating warehouses by name where they do not
  exist yet.
- **`suppliers`** and **supplier-variant links** — cost, lead time, supplier SKU.
- **`purchase_orders`** — open POs so inbound stock is not lost in the move.
- **Cost basis** — `Cost per item` (Shopify), `Cost Price` (BigCommerce), `cost` (Wix) land on
  the variant so margin reporting works on day one rather than after a second pass.
- **Barcodes** — `Variant Barcode` / `UPC` / `GTIN` map onto the barcode registry.

This also closes the "inventory-adjustment CSV import (SKU + location)" item that
[docs/68 §8](68-wizards-import-export-bulk.md) has carried as open.

---

## 6. Marketing surface

`/migrate` — the hub. Not a list of logos: the argument is _"the week you are dreading is an
afternoon,"_ and the page proves it with the actual mechanics.

`/migrate/[vendor]` — twenty pages, statically generated, `dynamicParams = false`, each with its
own OG image, in the [docs/141](141-marketing-page-system.md) band system. Each page is written
for somebody who is currently logged into that vendor: their file names, their menu paths, their
specific pain (Shopify's app-tax, Wix's lock-in, WordPress's plugin sprawl, HubSpot's per-seat
pricing), what lands, what does not, and what it costs.

Every page tells ONE story ([[feedback_pages_tell_a_story]]) — promise → recognition → false fix
→ the turn → consequences → resolution. Not a feature inventory with a logo at the top.

---

## 7. Task ledger

**Where this stands (2026-08-11). Every phase is built and green.** `@sparx/migration`
(182 tests), every import-worker processor plus an end-to-end walkthrough (26 tests), the
`/v1/migration` API with 20 route tests, the three live connectors, the workbench surfaces
including the live-connection flow, and the `/migrate` hub plus twenty vendor pages with
their OG cards. Lint, typecheck, tests and Prettier are clean across `@sparx/migration`,
`import-worker`, `api-rest`, `workbench` and `web`.

**Four real bugs were found by the last two phases of testing, and every one of them was
invisible to a unit test.** They are worth recording because each is a shape that will
recur:

| Found by              | Bug                                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The end-to-end walk   | Products sent `dimensions: {lengthMm: 0, …}` when the file had no dimension columns, and commerce requires them positive — so **every product in every Shopify import failed**. A Shopify export has no dimension columns at all.       |
| A route test          | `GET /v1/migration/runs` filtered with `options: { path: [...], not: undefined }`, which compiles and then dies at Postgres with "a JSON path cannot be set without a scalar filter". The whole past-moves surface 500'd on every call. |
| A route test          | `validateRows` only checked required fields the row actually CARRIED — and canonical rows drop empty values, so a product with no title arrived as a missing key and sailed through to fail at the processor.                           |
| A connector stub test | The Shopify connector put the discount code in `Code` and the display name in `Name`; Shopify's own CSV puts the code in `Name`, which the mapper reads first. Every coupon would have imported under its display name.                 |

**Residual, and deliberate:** `guardedFetch` resolves a hostname and refuses private
addresses before fetching, which closes SSRF by name and by A record but not DNS rebinding
(a name that resolves publicly for the check and privately for the socket). Closing that
means pinning the checked address onto the connection through a custom undici agent. The
window is small and the alternative — not resolving at all — is what this replaced.

**Note on `api-rest`:** its typecheck exhausts Node's default heap. It passes at
`NODE_OPTIONS=--max-old-space-size=8192`, and that is the size of the project rather than
anything this work added.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

### Phase 1 — `@sparx/migration` (the shared brain)

- [x] 1.1 Package scaffold, wired into workspace + tsconfig + eslint + vitest
- [x] 1.2 RFC-4180 CSV reader (quotes, escaped quotes, embedded newlines, CRLF, BOM) + tests
- [x] 1.3 Minimal XML reader (tags, attrs, CDATA, entities, namespaces) + tests
- [x] 1.4 WXR reader → content/pages/categories/tags/media/redirects/authors + tests
- [x] 1.5 Canonical row schemas + field specs for all 17 entities
- [x] 1.6 Detection: filename + header fingerprint → (vendor, entity, confidence) + tests
- [x] 1.10 **Client-side validator** — field-level + file-level rules, severity, fix hints + tests
- [x] 1.7 Vendor registry (slug, name, category, files, entities, marketing facts)
- [x] 1.8 Adapters: shopify, bigcommerce, woocommerce, magento, wix, squarespace, webflow, etsy, square, bigcartel, godaddy, wordpress, ghost, substack, framer, hubspot, salesforce, pipedrive, mailchimp, klaviyo
- [x] 1.9 Adapter round-trip tests with real-shape fixture rows for every vendor

### Phase 2 — import-worker processors

- [x] 2.1 Refactor `handler.ts` to a processor map (kills the 4× copy-pasted result loop)
- [x] 2.2 `variants` processor (option matrix, barcodes, cost, weight)
- [x] 2.3 `orders` processor (line items, addresses, financial + fulfilment status, historical)
- [x] 2.4 **`inventory_levels`** processor (SKU × location, auto-create warehouse)
- [x] 2.5 `suppliers` + supplier-variant processor
- [x] 2.6 `purchase_orders` processor
- [x] 2.7 `categories` + `collections` processors
- [x] 2.8 `content` processor (CMS entries, types, publish state, slugs)
- [x] 2.9 `media` processor (fetch remote URL → media store, dedupe by source URL)
- [x] 2.10 `redirects` processor (old URL → new URL; SEO continuity)
- [x] 2.11 `companies` / `deals` / `tickets` processors (CRM)
- [x] 2.12 `segments` processor (Mailchimp/Klaviyo audiences → CRM segments)
- [x] 2.13 Dry-run across every processor — a separate read-only `preview()`, not a flag (see §8)
- [x] 2.14 Module-gating per entity — skip with a stated reason, never fail the run
- [x] 2.15 Processor unit tests

### Phase 3 — API

- [x] 3.1 `/v1/migration/vendors` — catalogue, module-aware
- [x] 3.2 `POST /v1/migration/preview` — dry-run
- [x] 3.3 `POST /v1/migration/runs` — chunked job creation under one runId
- [x] 3.4 `GET /v1/migration/runs` + `/:runId` — status rollup, per-row errors
- [x] 3.5 `POST /v1/migration/runs/:runId/cancel`
- [x] 3.6 Register routes; extend worker event enum; keep legacy routes working
- [x] 3.7 Route tests (20, covering the catalogue, the import order, module gating and SSRF)

### Phase 4 — workbench surfaces

- [x] 4.1 `migration-start` — vendor picker with what-you-need instructions
- [x] 4.2 `migration-run` — drop file → detect → map → **validate locally (nothing uploaded yet)** → dry-run → execute → live progress
- [x] 4.2b Validation report panel: per-issue rows, jump-to-row, fix hints, block on errors
- [x] 4.3 Manual column mapper (override for unrecognised files)
- [x] 4.4 Per-row report of skipped rows and "worth knowing" notes, keyed to the tenant's own line numbers
- [x] 4.4b Download-the-failures-as-CSV button, and re-run just those rows
- [x] 4.5 `migration-history` — past runs
- [x] 4.6 Register in `catalog/platform.ts`, nav, command palette, Pulse job cards
- [x] 4.7 Onboarding hand-off: "moving from another platform?" entry point

### Phase 5 — live connectors

- [x] 5.1 Connector contract in `@sparx/migration` (paged pull → canonical rows) + the URL guard
- [x] 5.2 Shopify Admin GraphQL connector — 8 resources, including the three with no export
- [x] 5.3 WooCommerce / WordPress REST connector — one connector, two APIs, shop optional
- [x] 5.4 HubSpot CRM v3 connector — pipeline labels and associations resolved per page
- [x] 5.5 Credentials entered per pull and never stored; `guardedFetch` in api-rest; surface wired

### Phase 6 — apps/web

- [x] 6.1 `/migrate` hub (replaces the ComingSoon stub, indexable)
- [x] 6.2 `/migrate/[vendor]` page system + OG route
- [x] 6.3 Copy for all 20 vendor pages
- [x] 6.4 Sitemap, `llms.txt`, nav/footer links, internal links from module pages

### Phase 7 — verification

- [x] 7.1 `pnpm format` on changed files
- [x] 7.2 `pnpm lint`
- [x] 7.3 `pnpm typecheck`
- [x] 7.4 `pnpm test`
- [x] 7.5 Walk the surface as a business owner (real-shape Shopify export, end to end)

---

## 8. Decisions taken

| Decision                                       | Why                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| No new Prisma models                           | `options.migrationRunId` on `ImportJob` is enough; keeps this off the migration pipeline                                              |
| Parse in the browser                           | No blob storage, no upload endpoint, no new cost                                                                                      |
| Own CSV + XML readers                          | Zero new deps, and vendor quirks are ours to handle                                                                                   |
| File-first, connectors second                  | Works day one for all 20; no partner-programme dependency                                                                             |
| Dry-run mandatory before write                 | The reason a non-technical owner will press the button                                                                                |
| Dry-run is a read-only `preview()`, not a flag | The services own their transactions, so there is nothing to roll back — a flag would be a lie                                         |
| Orders are WRITTEN, not PLACED                 | Replaying history through the order service would decrement imported stock, email old customers and count 2023 revenue as today's     |
| Product images are copied, not linked          | A link to the old CDN goes blank the day the tenant cancels the account they migrated away from                                       |
| Imported lists are STATIC                      | The old platform's rules are invisible to us; inventing one produces a list that silently differs from the one they have been mailing |
| Shared registry between importer and website   | A marketing page cannot claim an entity the importer does not carry                                                                   |

---

## 9. Picking this up cold

Everything below is here because it is NOT obvious from reading the code, and each line
cost something to find out.

### The file map

| Where                                                   | What                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/migration/src/parse/{csv,xml,wxr}.ts`         | The three readers. Zero deps, deliberately.                                 |
| `packages/migration/src/{canonical,coerce,validate}.ts` | The row contract, value coercion, and the validator both sides run.         |
| `packages/migration/src/detect.ts`                      | Fingerprint → vendor. `readSource()` is the whole browser-side entry point. |
| `packages/migration/src/vendors/*.ts`                   | One adapter per competitor. `_helpers.ts` is the shared mapping vocabulary. |
| `packages/migration/src/registry.ts`                    | The catalogue the API **and** the marketing site read.                      |
| `services/import-worker/src/processors/`                | One `EntityProcessor` per entity + `index.ts` registry + `resolve.ts`.      |
| `services/api-rest/src/routes/v1/migration.ts`          | The five endpoints.                                                         |
| `apps/workbench/surfaces/migration/`                    | Vendor picker, the run, past moves, the manual column mapper.               |
| `apps/web/components/marketing/migrate/`                | 20 stories + the hub and vendor page components.                            |
| `packages/migration/src/connectors/`                    | The three live connections. `http.ts` is the retry + URL guard.             |
| `services/api-rest/src/lib/guarded-fetch.ts`            | The resolver half of the SSRF guard; only the service can do this half.     |
| `apps/workbench/surfaces/migration/live-connection.tsx` | Credentials → what to bring → pull, into the same report a file gets.       |
| `services/import-worker/test/integration/`              | The end-to-end walk: real CSV, real processors, real database.              |

### Verification commands that actually work here

```bash
pnpm --filter @sparx/migration test          # 135
pnpm --filter @sparx/import-worker test      # 19
pnpm --filter <pkg> lint
pnpm --filter <pkg> typecheck

# api-rest EXHAUSTS Node's default heap. This is the size of that project, not
# anything this work added — it is not a type error, and the message looks nothing
# like one:
NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc -p services/api-rest/tsconfig.json --noEmit
```

### House idioms these files had to be corrected onto

Each of these was a typecheck or lint failure before it was a rule:

- **silicaui `Button` has no `asChild`.** Marketing CTAs are
  `<a href={signupHref('ref')} className={buttonClasses({ size, color, variant })}>`, and the
  `ref` is signup attribution (docs/80). An **outline button inside a dark island takes no
  `color`** — naming one paints the label in that colour's raw accent and drops to ~1.7:1.
- `Display` only goes down to `h3`. `FaqItem` requires a stable `id` — it anchors both the
  accordion and the FAQPage structured data.
- Workbench: `RefreshButton` takes `onRefresh` + `updatedAt`, not `onClick`. Toasts are
  `toast.add({ title, description, type })`, not `toast({ color })`. silica `Select`'s
  `onValueChange` hands back `unknown`.
- Prisma model names are `productCategory` and `productCollection`, not `category`/`collection`.
- `publish()` from `@sparx/api-core/pubsub` is `(logger, type, tenantId, actorId, data)`.
- `no-irregular-whitespace` fires on a literal U+FEFF **in a comment**; strings are exempt.

### Phase 5 — how the live connections actually work

**A connector does not import. It fetches.** `pull(credentials, entity, cursor)` returns one
page of the SAME canonical rows a parsed file produces, and hands them back to the browser.
Everything downstream — the validation report, the practice run, the confirmation, the run
history — is the code the file path already used, unchanged. That is the whole design decision,
and it buys three things at once:

- The client-side-validation promise holds for live connections for free, because there is one
  validator and it runs in the same place.
- There is no second, unreviewed write path into a tenant's account.
- No new worker, no new event, no new table, no credential storage.

**Credentials are never stored.** They are typed into the workbench, sent with each pull, used,
and forgotten; closing the pane loses them. A migration is a one-off, and a key to a platform
somebody has just left is a liability with no upside. (This replaces the earlier sketch of
capturing them through `@sparx/integration-framework` — the BYO rule that sketch existed to
satisfy is satisfied more completely by not keeping them at all.)

**Why these three and no others.** Shopify, WordPress/WooCommerce and HubSpot are the only
platforms on the roster whose API a tenant can authorise for themselves in under two minutes.
Wix, Squarespace, Webflow and Klaviyo all have APIs that want an app review, an agency account,
or a plan tier the person leaving does not have — a "connector" for those would be a waiting
list, which is worse than the file that already works.

**Each connector flattens the API's JSON back into that vendor's own CSV column names and then
runs the existing mapper.** It looks redundant for about a minute and then stops: the weight-unit
conversion, the fractional-percentage discounts, the option matrix, the gallery re-gathering and
WooCommerce's inverted sale price are all quirks those mappers already handle and have tests for.
A second set of mappers for the API would be a second set of those bugs. `shopifyInternals` /
`hubspotInternals` / `woocommerceInternals` are exported for exactly this.

What each one adds beyond the file path:

| Connector | Why it earns its keep                                                                                                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shopify   | **Collections, pages and blog posts have no CSV export at all.** The marketing page says so in print, so this is what keeps that sentence honest. Plus stock per location, and no six trips through the export queue.                                                                   |
| WordPress | The file path needs two exporters in two different menus, one of which makes a 90 MB XML file. One site address replaces both — and for a publisher with no shop, the address is the only thing they have to give us.                                                                   |
| HubSpot   | The API writes stage IDs (`closedwon`); the CSV writes labels. So this reads the portal's pipelines first and translates them back, and batch-resolves associations into company names and contact emails. Without that step every deal lands `open`, including the ones that were won. |

**The API is the proxy, and it is a guarded one.** `services/api-rest/src/lib/guarded-fetch.ts`
resolves the hostname and refuses any private, loopback, link-local or CGNAT address before the
request goes out. `assertSafeUrl` in the package does the syntactic half (so the browser applies
it too); the resolver half can only live in the service. The WordPress connector takes a site
address from a tenant and our server fetches it — without this, an editor could read anything
inside the cluster through the preview.

### The thing not to undo

`registry.ts` is imported by the marketing site on purpose. If a future change makes the
`/migrate` pages list vendors or entities from a hand-written array, this whole feature goes
back to being able to advertise importers that do not exist — which is the exact state it was
found in.
