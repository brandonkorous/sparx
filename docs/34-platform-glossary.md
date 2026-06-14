# Platform Glossary & Concept Model

**Version:** 1.4
**Author:** Brandon Korous
**Last Updated:** 2026-06-13

---

## 1. Why this exists

Several core nouns in Sparx were overloaded — most of all the retired **"storefront"**, which
had been used for a paid module, a runtime app, a tenant's public website, and (loosely, in
prose) "the shop." That overload produced wrong statements in design discussions (e.g. "a
storefront is required for a brand," which inverts the real dependency — see §4).

As of 2026-06-13 the platform retires **`storefront`** and **`store`** as names for the tenant's
website. Sparx is a **general website-as-a-service**; the website is the **site**, and selling is
just one module (**Commerce**) layered onto it. The website-building module, its settings, its
runtime, and its public output are all **site** — never "store." See §5 for the full mapping.

This doc is the **canonical concept model**. When any other doc, chat, or PR uses one of these
terms ambiguously, this doc wins and that usage is corrected. It is descriptive of the
architecture committed in [01-platform-vision.md](01-platform-vision.md),
[29-sitebuilder-architecture.md](29-sitebuilder-architecture.md),
[30-sitebuilder-redesign.md](30-sitebuilder-redesign.md), and
[33-token-model-v2.md](33-token-model-v2.md).

---

## 2. The layer model (read this first)

Sparx is, at its root, a **website platform**. The website is the base; every other capability
is a feature layered onto it. Concretely:

```
TENANT ─────────────  one organization — merchant, publisher, agency, team (Better Auth org, RLS tenant_id)
  │
  ├─ BRAND ──────────  identity: name, logo, palette, type, shape, rhythm, effect
  │                    tenant-level; every surface READS it, none OVERRIDES it
  │                    (30 §6, 33 §1 decision 4)
  │
  └─ SITE ───────────  the website itself: themes, layouts, pages, sections, nav slots
       │               authored by the Site Builder; this is the **Site** module
       │               (a content-only tenant still has a full SITE — it just has no products)
       │
       ├─ CMS          adds prose pages, blog, media
       ├─ Commerce     adds products, cart, checkout, orders  ← this is "the shop"
       ├─ CRM          adds customers, pipeline, activity
       ├─ Email, B2B, AI/MCP, Dropship …
```

Three rules fall out of this and are **binding**:

1. **The site is the base, not the shop.** The website exists with zero commerce. Selling is
   the **Commerce** module, layered on. A tenant on Site + CMS has a complete site with
   no shop.
2. **Brand sits above the site.** Brand is a tenant primitive. The site (and dashboard, email,
   every surface) reads it. **Amendment (2026-06-04, [49 §3](49-multi-site-per-tenant.md)):** the
   tenant brand is the **default**, and a tenant running **more than one site** may set an
   _optional, presentation-only_ **per-site override** (`Property.brand_override`: display name +
   theme colours + logo). This deliberately softens the original "overridable by none" — multi-brand
   multi-site requires it. The override is a partial; any unset field inherits the tenant brand, so
   single-site tenants are unaffected. You do **not** need a site to have a brand; the
   dependency runs the other way.
3. **Theme ≠ brand.** Brand is _identity_ (who the tenant is). Theme is _presentation_ (how a
   given site renders). Per [33-token-model-v2.md](33-token-model-v2.md): brand owns
   color/type/shape/rhythm/effect (the depth scale); the theme owns surfaces, neutral, status
   colors, border, container width. One brand, potentially many presentations.

---

## 3. Canonical terms

| Term                            | Means                                                                                                                                                                                                                                                                                                                   | Does NOT mean                                                                                                       | Where it lives                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant**                      | One organization — merchant, publisher, agency, or team. The RLS isolation boundary; 1:1 with a Better Auth org. Not necessarily a seller.                                                                                                                                                                              | A user. A site. (A tenant _has_ a site.)                                                                            | `tenant_id` everywhere; `02-tenant.prisma`                                                                                                                 |
| **Brand**                       | Tenant-level **identity**: name, logo, palette, type, shape, rhythm, effect (depth). Read by every surface; tenant brand is the **default**, optionally overridden **per site** (`Property.brand_override`, presentation-only — see the §2 amendment).                                                                  | A theme. A commerce-only concept.                                                                                   | `TenantBrand` (default) + `Property.brand_override`; [30 §6](30-sitebuilder-redesign.md), [33](33-token-model-v2.md), [49 §3](49-multi-site-per-tenant.md) |
| **Site**                        | The tenant's **website** — the base layer: themes, layouts, pages, sections, nav. The output of the **Site** module.                                                                                                                                                                                                    | The shop. (Commerce is separate.) A separate hidden website under the site — there is none.                         | `SiteConfig`/`SiteVersion`/`SiteSection`/`SiteLayoutBlock`; `49-sitebuilder.prisma`                                                                        |
| **Site (module)**               | The paid module whose job is "site builder, themes, pages, live in 5 min." The base **website** capability. Internally the module key is `builder` (it was renamed from `storefront` before the store→site pass; a legacy `storefront` module-color alias still survives for the `/sitebuilder` surface).               | Commerce. The shop.                                                                                                 | `isModuleEnabled(tenantId, 'builder')`; [01 §2](01-platform-vision.md)                                                                                     |
| **Site Builder**                | The dashboard **tool** that authors the site (one-screen editor, theme, brand, layouts, sections). The admin-side surface of the Site module.                                                                                                                                                                           | The rendered public site.                                                                                           | `apps/dashboard/.../sitebuilder`; `packages/sitebuilder`                                                                                                   |
| **`apps/site`**                 | The runtime **app** that renders the tenant's public website (tenant-aware, draft/published).                                                                                                                                                                                                                           | The admin/editor. The dashboard.                                                                                    | `apps/site`                                                                                                                                                |
| **Public site**                 | A tenant's live public website, e.g. `acme.sparx.zone`. The rendered output of the SITE for visitors.                                                                                                                                                                                                                   | The shop specifically (it shows products only if Commerce is on).                                                   | `sparx.zone` per [00-README](00-README.md)                                                                                                                 |
| **Site name** (`Property.name`) | The **customer-facing** name of a site — what every storefront surface (title, header, footer, OG, JSON-LD) and customer email (wordmark, footer, `{{site.name}}`) shows. Seeded from the tenant name at provisioning; edited in Settings → Sites. The active site's name, falling back to the tenant's primary site's. | The tenant's legal/org name (`Tenant.name` — billing only). The brand `businessName` (deprecated as a name source). | `Property.name`; `resolveActivePropertyName` (api-rest `lib/property.ts`); [49 §3·B](49-multi-site-per-tenant.md)                                          |
| **Tenant name** (`Tenant.name`) | The tenant's **legal/org name** (a business, or the individual). Billing + account admin only — **never** rendered to a customer or in a customer email. The tenant is also the holder of a tax id (not yet captured).                                                                                                  | The site name (that's `Property.name`). A display name shown to shoppers.                                           | `Tenant.name`; Settings → General ("Business name"); `02-tenant.prisma`                                                                                    |
| **Theme**                       | A **presentation** preset (apex, industrial, drift, market, fleet, drop) + the tenant's overlay. How the site looks.                                                                                                                                                                                                    | Brand/identity.                                                                                                     | `packages/site-themes`; `CommerceSiteTheme`                                                                                                                |
| **Commerce**                    | The module that adds products, cart, checkout, orders — "the shop."                                                                                                                                                                                                                                                     | The site. The storefront module.                                                                                    | `commerce` module; `09-ecommerce-engine-prd.md`                                                                                                            |
| **Module**                      | An independently activatable capability (Storefront, Commerce, CMS, CRM, Email, B2B, AI/MCP, Dropship). Feature-flagged, not separately deployed.                                                                                                                                                                       | A microservice. A deploy unit.                                                                                      | module flags; `CLAUDE.md`                                                                                                                                  |

---

## 4. The website is the base, stated plainly

The website-building capability appears at four levels, and **all four are "site":**

1. **Module** — `site` = the website-building capability (base layer).
2. **Admin tool** — the Site Builder authors that module's data.
3. **Runtime app** — `apps/site` renders it.
4. **Public site** — `acme.sparx.zone`, the visitor-facing website.

**None of the four mean "commerce / the shop."** Selling is always the separate **Commerce**
module. There is no "store" in the platform vocabulary — the tenant has a **site**, and Commerce
is a module on it.

The earlier claim that **"a storefront is required for a brand" is backwards.** Brand is a
tenant primitive that the site reads; the site depends on the brand, not the reverse. A tenant
can hold a brand with no site published at all.

---

## 5. Decision: `storefront`/`store` retired in favor of `site` (2026-06-13)

This supersedes the earlier deferral. The `storefront` module and every `store`/`storefront`
name for the tenant's website are renamed to **`site`** vocabulary. "Store" implied a commerce-only
product; Sparx is a general website-as-a-service. The canonical mapping:

| Old                                                              | New                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| "store"/"storefront" for the tenant's website (copy)             | **site** ("property" only in the multi-site sense)     |
| Module key `storefront`                                          | already `builder` (renamed pre-pass; no change)        |
| Sales-channel value `storefront` (commerce-only)                 | **kept** — a sales channel is the online-store surface |
| Chat `source` value `storefront`                                 | **`site`** (a chat can start on a store-less site)     |
| `StorefrontSettings` / `commerce_storefront_settings`            | **`CommerceSiteSettings` / `commerce_site_settings`**  |
| `StorefrontTheme` / `commerce_storefront_themes`                 | **`CommerceSiteTheme` / `commerce_site_themes`**       |
| `StorefrontDocPlacement` / `storefront_doc_placements`           | **`SiteDocPlacement` / `site_doc_placements`**         |
| `StoreCredit` / `commerce_store_credit*` / UI                    | **`AccountCredit` / `commerce_account_credit*`**       |
| CSS class prefix `sf-*` + token vars `--sf-*` (`@sparx/site-ui`) | **`st-*` / `--st-*`** (`sx-` is taken by `@sparx/ui`)  |
| env `SPARX_STOREFRONT_URL`, `storefrontOrigin()`                 | **`SPARX_SITE_URL`, `siteOrigin()`**                   |
| API `/v1/commerce/storefront/*`, `/v1/public/storefront/site`    | **`/v1/commerce/site/*`, `/v1/public/site`**           |

**Still legitimate (not renamed):** `commerce` (the shop), the verb "store"/"stored", `datastore`,
`Memorystore`, `restore`, Cloud Storage/GCS, and the `.store` TLD option. Persisted values
(channel, module key, the `sf-`/`--sx-` prefix inside stored content) migrate via
expand → backfill → contract so production never breaks mid-deploy.
