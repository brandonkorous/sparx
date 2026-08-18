# Tenant Provisioning — Modules × Starter × Blueprint (the Seed Model)

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-06-27

---

## 0. What this is

An inventory of **everything a tenant would otherwise have to create by hand** to run a real
content/commerce business on sparx — grouped by module — plus the model for _how_ each thing gets
provisioned so a fresh tenant lands on a working site instead of a pile of empty modules.

This is industry-agnostic: a CMS-only publisher, a CRM-only team, a wholesale distributor, and a DTC
shop are all first-class. "Tenant" throughout; "store"/"merchant" only where real selling is meant.

**What changed in v1.2.** The earlier model folded all industry-specific content into a single
**blueprint** (the "template"). That coupled two things that vary independently: _what you sell_ and
_how the site looks_ — so a tenant who liked the "Farm Fresh" look but sold clothing inherited bakery
data they had to clean up before launch. v1.2 separates them. A tenant now composes **three
independent things**, and **data lives with the industry, never with the look**:

| You compose   | Chosen by                                                       | Provides                                                    | Industry-specific?                  | Carries data? |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------- | ------------- |
| **Modules**   | user toggles                                                    | what's _activated_ — the only capability switch             | no                                  | —             |
| **Starter**   | pick an industry (clothing / food / vehicle / tattoo / salon …) | **all the data**: config (auto) + sample content (optional) | **yes**                             | **yes**       |
| **Blueprint** | pick a look (Farm Fresh / Minimal / Bold …)                     | brand, theme, pages, nav, emails                            | **no** — any look fits any industry | **no**        |

"Farm Fresh + clothing" now works: the **look** (blueprint) is orthogonal to **what you sell**
(starter). Pick the clothing starter, pick the Farm-Fresh blueprint, optionally load clothing sample
content — zero food data anywhere.

**Binding invariants (every provisioning path obeys these):**

1. **Only the user flips a module flag.** No starter, blueprint, or sample-load ever writes
   `settings.modules`.
2. **Provision only into enabled modules.** A starter/blueprint slice for a disabled module inserts
   **nothing** (CLAUDE.md "a disabled module stores no rows"). Enabling the module later backfills it
   (§3).
3. **Blueprints carry no data** — no catalog, no content records, no fitment/tax/pipeline. Presentation
   only.
4. **The starter is opt-in.** The generic L2 defaults (§2) are the always-on baseline so a module is
   never broken; the industry starter only _layers on top_ and can be skipped entirely (a "generic"
   tenant gets the baseline and no industry flavor).
5. **Sample content is the starter's optional, clearable half** — a real prod "load / clear sample
   data" feature, industry-aligned, and the same dataset the dev/e2e seed invokes programmatically.

Related: [15-merchant-onboarding-prd.md](15-merchant-onboarding-prd.md),
[54-tenant-blueprints.md](54-tenant-blueprints.md) / [85-creator-marketplace.md](85-creator-marketplace.md),
[91-default-email-templates.md](91-default-email-templates.md),
[84-automation-build-log.md](84-automation-build-log.md),
[87-invoicing-and-billing-documents.md](87-invoicing-and-billing-documents.md),
[82-event-bus-unification.md](82-event-bus-unification.md) (the `module.activated` bus),
[100-inventory-build-plan.md](100-inventory-build-plan.md).

---

## 1. The three things a tenant composes

- **Modules — capability.** The user enables/disables modules (onboarding Modules step, settings).
  This is the _only_ thing that turns a capability on. Everything below provisions _into_ whatever
  modules are on; nothing below ever flips a flag.

- **Starter — the industry, and the owner of all data.** A starter is a named vertical (`clothing`,
  `food`, `vehicle`, `tattoo`, `salon`, …; a `generic` starter is the no-industry fallback). It has
  **two halves**:
  - **Config** (auto-provisioned, kept): the industry's _structure_ — fitment dictionary, category
    taxonomy, tax-zone preset, pipeline shape, custom content-types, units, service types. Seeded **per
    enabled module** through the L2 `module.activated` mechanism (§2), find-or-create, kept on
    deactivate. The chosen industry is recorded on the tenant (`settings.industry`) so the right
    config seeds as modules turn on.
  - **Sample content** (optional, clearable): the industry's _example records_ — products, posts,
    example customers/orders/bookings. NOT auto-seeded; the user loads it from a **"Load sample
    data"** control and can **clear** it before launch. Industry-aligned, and the same dataset the
    dev/e2e seed runs.

- **Blueprint — the look.** Brand, theme, pages, nav, emails. **No data.** Industry-agnostic, so any
  blueprint pairs with any starter.

---

## 2. The provisioning layers (when each thing seeds)

Seeding happens at distinct moments, for distinct reasons. Conflating them (e.g. "seed everything on
tenant create") breaks the moment a tenant enables a module _later_ — it would never get that module's
config.

| Layer                                         | Fires on                                                 | Scope                 | Seeds                                                                                                                                                                                                   | Status                         |
| --------------------------------------------- | -------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **L1 · Provisioning**                         | `tenant.created`                                         | tenant + primary site | Primary `Property`, `<slug>.sparx.zone` `Domain`, `SiteConfig`, brand shell, legal pages + placements, default consent                                                                                  | ✅ live                        |
| **L2 · Module activation — generic baseline** | `module.activated(<slug>)`                               | per module            | the **template-agnostic** defaults a module needs to not feel broken — default pipeline, default emails, commerce settings + fallback shipping/tax, default warehouse, chat replies, saved-view presets | ✅ ~9 modules wired            |
| **L2 · Module activation — starter config**   | `module.activated(<slug>)` _and_ industry chosen/changed | per module            | the chosen **starter's config slice** for that module (fitment, taxonomy, industry tax/pricing/pipeline) — layered on top of the generic baseline, same find-or-create pattern                          | 🔨 new (this program)          |
| **Sample content load**                       | user clicks "Load sample data"                           | per tenant            | the chosen starter's **example records** (products, content, demo customers/orders) — clearable                                                                                                         | 🔨 new                         |
| **Blueprint install**                         | look chosen at onboarding (or default)                   | per site              | brand, theme, pages, nav, emails — **no data**                                                                                                                                                          | ✅ live (refactor: strip data) |

**Why generic baseline and starter config are two layers (not one).** The generic L2 defaults are
**not skippable** — every tenant on a module needs _something_ (an empty-but-present pipeline, a
fallback shipping rate). The industry starter **is** skippable. Keeping them separate lets a tenant
take the working baseline and **decline the industry flavor** entirely. Implementation: the existing
live L2 seeders (CRM/email/invoicing/commerce/…) are the generic baseline and stay untouched; the
starter adds a second seeder per module, wired to the same `module.activated` event, reading
`settings.industry`.

**The base-blueprint question stays resolved.** We are still **not** doing "one base blueprint with
everything auto-installed." Template-agnostic defaults are L2; industry config + sample content are the
**starter**; the look is the **blueprint**. The fallback for a tenant who picks no look is a generic
**blueprint**, not a data-bearing one.

---

## 3. Module off → on lifecycle contract (binding)

Answers "if a tenant disables a module, what happens to their data, and does re-enabling overwrite it?"
The pattern is established across the live L2 consumers; **every L2 seeder — generic baseline _and_
starter config — MUST follow it.**

- **R1 — Deactivation never deletes.** Disabling leaves rows dormant: the gate 404s, workers idle, no
  _new_ rows written (CLAUDE.md "stores no rows" = no new writes while off, **not** deletion). Disabling
  is reversible; tenants would be upset to lose an edited pipeline on a brief disable.
- **R2 — Re-activation is find-or-create, never overwrite.** A seeder only creates what is **missing**
  (looked up by natural key — slug/key), so a tenant's _edited_ pipeline/emails/fitment survive
  re-activation untouched. No L2 seeder upserts over a tenant-owned row.
- **R3 — Platform-managed content is the one exception, and still never touches tenant work.** System
  automations (`origin = 'system'`) re-sync to canonical by key; tenants customize by **cloning to a
  `user`-origin copy**, which is never touched.
- **R4 — Sharp edge: find-or-create _resurrects deleted defaults._** A tenant who deletes a seeded
  default and re-activates (or is hit by the reconcile cron) gets it back. Intentional for structural
  seeds; where deletion is a legitimate, sticky tenant choice, use a per-(tenant, module, starter)
  `seededAt` marker for exactly-once instead of bare find-or-create. Decide per entity (§7 D1).

**Net contract:** off = data kept dormant; on again = missing config refilled, tenant edits preserved.
Sample content is **not** subject to this — it's an explicit user load/clear, never auto-refilled.

---

## 4. Seed-class taxonomy

Every entity in the inventory (§5) is tagged:

- 🟢 **Generic default** — template-agnostic; every tenant on that module needs it. Seeds at **L2**
  (or L1 for cross-module foundations). Always on; never skippable; never carried by a blueprint.
- 🟣 **Starter config** — industry-specific _structure_ (fitment, taxonomy, tax/pricing/pipeline
  shape, custom content-types). Seeds at **L2 starter-config**, per enabled module, opt-in with the
  chosen industry. Find-or-create, kept on deactivate.
- 🟡 **Starter sample content** — industry-specific _example records_ (products, posts, demo
  customers/orders). Loaded by the **optional prod toggle**, clearable; also the dev/e2e dataset.
- 🔵 **Blueprint (look)** — brand, theme, pages, nav, emails. **No data.** Seeds at blueprint install.
- ⚪ **Runtime** — generated by real usage (carts, real orders, sessions, deliveries, analytics,
  activities). **Never seeded.** (The 🟡 toggle fabricates _examples_ of these for learning/demo; that
  is the sample-content feature, not runtime.)

(v1.1's single 🔵 "blueprint content" class is split here into 🟣 starter-config + 🟡 sample-content +
🔵 blueprint-look. v1.1's "demo is dev-only" is superseded: example records are 🟡, a real opt-in
feature — resolving v1.1's open decision D3.)

---

## 5. The inventory, by module

Legend: 🟢 generic default (L2/L1) · 🟣 starter config (L2) · 🟡 starter sample content (toggle) ·
🔵 blueprint look · ⚪ runtime. Coverage: ✅ seeds today · ⚠️ partial · ❌ gap.

### 5.1 Foundation — Builder / Sitebuilder / Brand

| Entity                                           | Class                | Coverage | Notes                                                              |
| ------------------------------------------------ | -------------------- | -------- | ------------------------------------------------------------------ |
| `Property` (primary) + `SiteConfig`              | 🟢                   | ✅       | Provisioning (L1).                                                 |
| `Domain` (`<slug>.sparx.zone`)                   | 🟢                   | ✅       | Provisioning (L1). Custom domains author-time.                     |
| `TenantBrand` (colors, fonts, logos, tokens)     | 🔵 (shell 🟢)        | ⚠️       | Brand shell at L1; full identity from the **blueprint**.           |
| `SiteTheme` (saved theme)                        | 🔵                   | ✅       | **Blueprint** ships + applies its theme.                           |
| `BuilderLayout` (header · Outlet · footer)       | 🔵 (bare starter 🟢) | ✅       | Starter navbar via `site-chrome` factory; **blueprint** overrides. |
| `BuilderPage` (home, about, contact, templates)  | 🔵                   | ✅       | **Blueprint** only; bare tenant has just the starter.              |
| `BuilderComponent` / `Version` (saved sections)  | 🔵                   | ✅       | **Blueprint** `components[]`.                                      |
| `BuilderArchetype` / `PlatformComponent` catalog | 🟢                   | ✅       | Platform library, lazy / global.                                   |

### 5.2 CMS

| Entity                                            | Class           | Coverage | Notes                                                               |
| ------------------------------------------------- | --------------- | -------- | ------------------------------------------------------------------- |
| `ContentType` (built-ins: page, blog_post…)       | 🟢              | ✅       | Migration (global base set).                                        |
| `ContentType` (custom, e.g. `service`, `vehicle`) | 🟣              | 🔨       | **Starter config** — the industry's content shapes.                 |
| `Taxonomy` + `TaxonomyTerm`                       | 🟣              | ❌       | **Starter config** (category/tag structure).                        |
| `Author`                                          | 🟡              | ❌       | **Sample content** (example author records).                        |
| `NavigationMenu` + `Item` (header/footer)         | 🔵 (default 🟢) | ⚠️       | Starter-default nav at L1; **blueprint** look defines the rest.     |
| `ContentEntry` (posts, example pages)             | 🟡              | ⚠️       | **Sample content** (example records) — was 🔵; moves to the toggle. |
| `MediaAsset` (uploads)                            | 🟡 / author     | ⚠️       | Sample-content assets; otherwise author uploads.                    |
| Revisions, references, preview tokens, variants   | ⚪              | —        | Generated.                                                          |

### 5.3 Legal & consent (L1)

| Entity                                            | Class | Coverage | Notes                                        |
| ------------------------------------------------- | ----- | -------- | -------------------------------------------- |
| Legal pages (`ContentEntry`) + `SiteDocPlacement` | 🟢    | ✅       | `legal-seed-worker` on `tenant.created`.     |
| `ConsentSettings`                                 | 🟢    | ⚠️       | Defaults `off`; tenant configures GDPR/CCPA. |
| `ConsentRecord`, `PlatformLegalAcceptance`        | ⚪    | —        | Runtime / sign-up.                           |

### 5.4 Commerce

| Entity                                                                  | Class   | Coverage | Notes                                                                            |
| ----------------------------------------------------------------------- | ------- | -------- | -------------------------------------------------------------------------------- |
| `CommerceSiteSettings` (currency, locale, checkout, default warehouse)  | 🟢      | ✅       | `commerceSiteService.bootstrapDefaults` on `module.activated(commerce)`.         |
| `ShippingZone`/`Profile`/`Rate` (fallback)                              | 🟢      | ✅       | `shippingService.bootstrapDefaults` — "Everywhere" + "Standard" + flat fallback. |
| `TaxZone`/`Rate`/`Exemption` (inactive home nexus)                      | 🟢      | ✅       | `taxService.bootstrapDefaults` — inactive zone, $0 until configured.             |
| `ShippingZone`/`TaxZone` industry presets                               | 🟣      | 🔨       | **Starter config** (US-state sales-tax pack, region shipping).                   |
| `ProductCategory` / `ProductCollection` (taxonomy)                      | 🟣      | 🔨       | **Starter config** — the industry's category tree (structure, not records).      |
| `PriceList` / `BulkPriceTier` / `MarkupRule` / `SurchargeRule`          | 🟣      | ❌       | **Starter config** (industry pricing shape).                                     |
| `FitmentDomain`/`Category`/`Item`/`Variant` (dictionary)                | 🟣      | 🔨       | **Starter config** — the fitment dictionary (this program, Wave 0).              |
| `Product` / `Variant` / `Option` / `Image`                              | 🟡      | ⚠️       | **Sample content** (example catalog records) — was 🔵; moves to the toggle.      |
| `Discount` / `Bundle` / `ConfigurationTemplate`                         | 🟡 / 🟣 | ❌       | Promo records 🟡; reusable bundle structure 🟣.                                  |
| `ProviderInstallation` (Stripe/Shippo/TaxJar…)                          | author  | —        | Runtime connect (onboarding Payments).                                           |
| `ProductFitment`, carts, orders, payments, reviews, returns, gift cards | 🟡 / ⚪ | —        | Example fitment links + orders = 🟡 sample; real usage = ⚪.                     |

### 5.5 CRM

| Entity                                             | Class | Coverage | Notes                                                        |
| -------------------------------------------------- | ----- | -------- | ------------------------------------------------------------ |
| `Pipeline` + `PipelineStage` (default sales)       | 🟢    | ✅       | `bootstrapDefaultPipeline` on activation (generic baseline). |
| `Pipeline` (industry-shaped) + `Segment` templates | 🟣    | 🔨       | **Starter config** — e.g. a service pipeline for a salon.    |
| `Segment` (built-in templates)                     | 🟢    | ✅       | `bootstrapBuiltInSegments`.                                  |
| `SavedView` (per surface)                          | 🟢    | ✅       | `bootstrapSavedViewPresets`.                                 |
| `Customer` / `Deal` / `Task` examples              | 🟡    | ❌       | **Sample content** (example records).                        |
| Activities, segment members, addresses, joins      | ⚪    | —        | Generated.                                                   |

### 5.6 Email + Automation

| Entity                                                      | Class     | Coverage | Notes                                                                      |
| ----------------------------------------------------------- | --------- | -------- | -------------------------------------------------------------------------- |
| Default keyed `BuilderEmail` (transactional + lifecycle)    | 🟢        | ✅       | `provisionDefaultEmails` on `module.activated(email)`.                     |
| Marketing/campaign `BuilderEmail` templates                 | 🔵 / 🟣   | ⚠️       | Branded design = **blueprint**; industry campaigns = starter config.       |
| `EmailSettings` (from-name/address)                         | 🟢        | ⚠️       | Row exists, stays empty until configured — never fabricate a from-address. |
| System `Automation` set (welcome, abandoned-cart, dunning…) | 🟢        | ✅       | `seedSystemAutomations` per `module.activated`; idempotent + reconcile.    |
| React-Email platform templates                              | 🟢 (code) | ✅       | Shipped in `@wizeworks/email`.                                             |
| `Broadcast`, `Suppression`, `EmailEvent`, runs              | ⚪        | —        | Runtime.                                                                   |

### 5.7 Inventory · 5.8 B2B / Invoicing / Dropship / Chat / Scheduling

| Entity                                                  | Class | Coverage | Notes                                                         |
| ------------------------------------------------------- | ----- | -------- | ------------------------------------------------------------- |
| Default operating `Warehouse` (`MAIN`)                  | 🟢    | ✅       | L2 on `module.activated(inventory)`.                          |
| `Supplier` / `PurchaseOrder` / `LotBatch` examples      | 🟡    | ⚠️       | **Sample content.**                                           |
| Invoicing `DocumentWorkflow` / `Stage` / `LineType`     | 🟢    | ✅       | `bootstrapDefaultWorkflows` + `bootstrapDefaultLineTypes`.    |
| B2B default `PurchaseApprovalRule` (disabled)           | 🟢    | ✅       | L2, off by default.                                           |
| B2B `B2bPricingTier` / `ServiceType`                    | 🟣    | ❌       | **Starter config** (wholesale tiers / service catalog shape). |
| B2B `B2BAccount` / contacts                             | 🟡    | ❌       | **Sample content.**                                           |
| Chat `ChatQuickReply` bank                              | 🟢    | ✅       | L2 starter bank.                                              |
| Scheduling `Service` / `Resource` / `Policy` templates  | 🟣    | ❌       | **Starter config** (salon/clinic/studio service shapes).      |
| Scheduling `Booking` examples                           | 🟡    | ❌       | **Sample content.**                                           |
| Runtime (invoices, appointments, dropship/chat records) | ⚪    | —        | Never seeded.                                                 |

---

## 6. What to build (punch-list)

Independently shippable slices (deploy-early). This program (the "seed-everything" effort) implements
them; see the working plan for wave order.

- **A — Starter-config seeders (the new L2 layer).** Per module, a `bootstrap<Module>StarterConfig(ctx,
industry)` wired to `module.activated`, reading `settings.industry`, find-or-create, kept on
  deactivate (R1–R4), layered on the existing generic baseline. First brick: the **fitment dictionary**
  (Wave 0) — and with it, killing the platform-global Vehicle domain so nothing industry-specific shows
  by default. Then taxonomy, tax/pricing presets, pipelines, content-types, scheduling templates, B2B
  tiers.
- **B — Industry starters (compose the config bricks).** `clothing / food / vehicle / tattoo / salon /
…`, each a named composition of per-module config presets + its sample-content set; the "choose your
  industry" picker; `settings.industry`.
- **C — Sample-content feature (the 🟡 toggle).** A real prod "Load sample data / Clear sample data"
  control, keyed to `settings.industry`, into enabled modules only; `useConfirm` on clear; the same
  dataset the dev/e2e seed invokes.
- **D — Blueprint refactor (strip to look).** Remove catalog/content/contentTypes/fitment from blueprint
  manifests (they move to A/C); blueprints carry brand/theme/pages/nav/emails only and **never write
  `settings.modules`** (verify against onboarding's "Modules First" rule). The fallback is a generic
  **look**, not a data-bearing blueprint.
- **E — Generic baseline gaps.** Finish any remaining L2 generic seeders (§5 ⚠️/❌ 🟢 rows).

---

## 7. Open decisions

- **D1 — Exactly-once vs self-healing per entity (R4).** Keep self-healing for structural config
  (pipelines, fitment, taxonomies); add a `seededAt` marker where deleting a default is a legitimate,
  sticky tenant choice. Decide per seeder.
- **D2 — Tax default stance.** Seed a real default `TaxZone`/`TaxRate` (generic baseline) or default to
  "tax via connected provider" and seed an inactive zone only? Current: inactive zone, $0 until
  configured.
- **D3 — Example records.** ✅ **Resolved (v1.2):** example records are 🟡 **starter sample content** —
  a real opt-in "load/clear" feature owned by the starter, never auto-seeded, never in a blueprint.
- **D4 — Default operating warehouse naming.** Auto-named ("Main") vs prompt during onboarding.
