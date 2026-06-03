# 42 — Legal Documents & Cookie Consent

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-02

> The machinery that makes a tenant site legally shippable: the legal/policy pages
> a tenant shows its own shoppers, a configurable cookie-consent framework, and
> Sparx's own platform legal docs with a tenant acceptance gate. Builds out the
> "tenant tools" promised in [16-auth-security.md](16-auth-security.md) §10 (consent
> tracking, cookie banner) and the policy-page use case in [12-cms-prd.md](12-cms-prd.md)
> §3, and finally lands the `storefront_doc_placements` bridge so marketplace
> integrations can publish docs later ([09-ecommerce-engine-prd.md](09-ecommerce-engine-prd.md)).

## 1. Why

Tenant storefronts ship today with no legal scaffolding and no consent mechanism:

- The storefront footer hard-links `/shipping-policy` and `/returns-policy` to pages
  that do not exist — they 404.
- The CMS can hold legal pages only as generic `page` entries: no legal page type, no
  starter templates, no completeness view, no footer wiring.
- There is no cookie consent anything — no banner, no preference center, no consent
  log, no per-tenant config.
- Sparx's own platform legal docs (ToS / Privacy / DPA / AUP) are `ComingSoon` stubs
  on the marketing site, and tenants never agree to them (the sign-up form has no
  acceptance checkbox).

The compliance posture is already decided ([16-auth-security.md](16-auth-security.md)
§10): **Sparx is the data processor, tenants are the data controllers**; a DPA is
available to all and required for EU tenants; breach notification within 72h. This doc
is the build plan that makes that posture real.

## 2. The three layers

Legal content on the platform splits into three independent concerns. Keeping them
separate is the central design decision — they have different owners, audiences, and
storage.

| Layer                       | Whose docs   | Audience                | Storage                                                     | Editor                    |
| --------------------------- | ------------ | ----------------------- | ----------------------------------------------------------- | ------------------------- |
| **L1 — Tenant legal pages** | The tenant's | The tenant's shoppers   | CMS `content_entries` on the tenant                         | Tenant (templates seeded) |
| **L2 — Cookie consent**     | The tenant's | The tenant's shoppers   | `consent_settings` / `consent_records`                      | Tenant configures         |
| **L3 — Platform legal**     | Sparx's      | Tenants (the merchants) | Versioned pages on `apps/web` + `platform_legal_acceptance` | Sparx (WizeWorks)         |

L1 and L2 share the storefront and the seeded **cookie-policy** page (the consent
preference center links to it). L3 lives entirely on the marketing/dashboard side and
never touches a storefront.

## 3. L1 — Tenant legal pages

### 3.1 A `legalKind` discriminator column on `content_entries`, not a new content type

Legal pages are ordinary CMS `page` entries (type `page`) — they reuse the entire
existing edit / publish / render path (`getPageBySlug` → `PageView` → `renderDocToHtml`)
with no parallel surface. What marks one as a policy doc is a first-class nullable
`legal_kind` column on `content_entries` (`privacy | terms | cookie-policy | returns |
shipping | refund`), plus `legal_template_version` and `legal_disclaimer_ack_at`. The
completeness checklist and footer placement resolution key on `legalKind` (stable)
rather than the slug (tenant-editable), so a tenant renaming `privacy-policy` →
`privacy` never breaks placement or the checklist.

**Why a column and not a `body` field** (the alternative the plan considered): the
entry-body validator (`validateAndNormalizeBody`) **strips unknown keys**, so a
`body.legalKind` would survive only if it were a real `pageType` schema field — which
would then render in the CMS editor for _every_ page, and would have to be round-tripped
by the form on every save or be lost. A column sidesteps all of that: the
seed/instantiate path sets it directly, the CMS editor never touches it (so it survives
edits unconditionally), and it is indexable for the checklist's `GROUP BY legalKind`.
A nullable column add on Postgres is a metadata-only change — no table rewrite, no RLS
change (the table's policy is unchanged). `pageType`
([packages/cms-schemas/src/builtins/page.ts](../packages/cms-schemas/src/builtins/page.ts))
is left untouched. Shipped in migration `20260619000000_legal_and_consent`.

### 3.2 The legal pages registry

A code-first, platform-authored catalog (a new `packages/legal-templates/` package,
dependency-free — no `@sparx/db`, no React — so both api-rest and any worker can
import it) mirrors the `PAGE_TEMPLATES` pattern
([packages/sitebuilder-schemas/src/page-templates.ts](../packages/sitebuilder-schemas/src/page-templates.ts)).

```
LEGAL_TEMPLATES: readonly LegalTemplate[]
  { legalKind, defaultSlug, title, templateVersion (int), required, body (CmsDoc JSON) }
```

| legalKind     | default slug     | title            | required?             |
| ------------- | ---------------- | ---------------- | --------------------- |
| privacy       | privacy-policy   | Privacy Policy   | always                |
| terms         | terms-of-service | Terms of Service | always                |
| cookie-policy | cookie-policy    | Cookie Policy    | always                |
| returns       | returns-policy   | Return Policy    | when Commerce enabled |
| shipping      | shipping-policy  | Shipping Policy  | when Commerce enabled |
| refund        | refund-policy    | Refund Policy    | optional              |

"Required when Commerce enabled" reads the same `tenant.settings.modules.commerce.enabled`
signal the existing tenant routes read. Privacy, terms, and cookie-policy are always
required (cookie-policy backs the consent preference center).

Each template `body` opens with a callout block carrying the binding disclaimer — _"This
is a starter template, not legal advice. Review it with your own counsel before
publishing."_ — which `renderDocToHtml` already serializes. The disclaimer is content
(survives editing) and is paired with a structured `body.legalDisclaimerAck` flag that
drives an "unreviewed starter text" badge until the tenant acknowledges it.

### 3.3 Seeding on store creation

There is no tenant-lifecycle event today; tenant rows are created directly inside the
`signUpMerchant` transaction ([packages/auth/src/sign-up.ts](../packages/auth/src/sign-up.ts)),
whose only side-effect is publishing a welcome email. This doc introduces a
`tenant.created` event in the `EventType` union
([packages/events/src/types.ts](../packages/events/src/types.ts)), published
fire-and-forget after the transaction commits (same swallow-on-failure ethos as the
welcome email, so a Pub/Sub outage never rolls back sign-up). It carries the matching
Terraform topic + subscriber addition.

A consumer seeds, under the new tenant's RLS context, one `content_entry` per
`LEGAL_TEMPLATES` row (status **draft**, `body.legalKind` / `legalTemplateVersion` /
disclaimer set) plus `storefront_doc_placements` rows. It is idempotent on the
`(tenantId, typeKey, slug)` and placement unique constraints, so redelivery is safe.

**Seed as draft, not published.** Nothing unreviewed goes live; the footer simply omits
unpublished pages (already strictly better than today's 404 links), and the dashboard
checklist makes publishing one click. Synchronous in-transaction seeding is a stopgap
only — it couples `@sparx/auth` to legal content — and is used solely if the event
plumbing is not yet available.

### 3.4 Versioning

The seeded entry stores `templateVersion`. When the catalog's `templateVersion` later
exceeds the stored value, the checklist surfaces a non-destructive "newer starter
template available" indicator offering a re-seed-into-draft action; tenant edits are
never overwritten.

### 3.5 Dashboard Legal surface

A `{ id: 'legal', label: 'Legal', href: '/cms/legal' }` entry added to
`cmsManifest.sections` ([packages/cms-editor/src/manifest.ts](../packages/cms-editor/src/manifest.ts))
appears automatically in the CMS contextual rail, the overview grid, and favorites —
with the CMS teal module color — and needs zero shell changes. The page is a
[34-dashboard-working-area-standard.md](34-dashboard-working-area-standard.md)
Module-Overview-flavored **checklist**, one row per registry `legalKind` with a status:

- **Complete** — a published entry exists, version current, disclaimer acknowledged.
- **Missing** — no entry, or required-but-unpublished (required kinds red, optional muted).
- **Stale** — starter text never reviewed, or catalog version newer than the entry.
- **Unplaced** — published but no enabled footer placement.

A completeness ring is computed over the (commerce-conditional) required set. "Create
from template" instantiates a draft and deep-links to the existing CMS editor; "Edit"
routes to `/cms/{entryId}`. Editing reuses the CMS editor stack wholesale — legal pages
are `page` entries. A placement-manager panel reuses the ordered / toggleable list UX
from the navigation menu editor.

### 3.6 Storefront footer

The placements table (§5) is the source of truth for legal footer links, intentionally
separate from the Site Builder `FooterConfig` (which owns copyright / social / tagline)
so the two never fight. The default footer in
[apps/site/app/layout.tsx](../apps/site/app/layout.tsx) drops its broken
hardcoded `/shipping-policy` and `/returns-policy` links in favor of a
placements-driven "Legal" column resolved server-side; unpublished or deleted entries
are dropped exactly like dead nav items are in the public content route. The render
path is unchanged. Placement reads join the existing `content:<slug>` revalidate tag so
publishing or reordering purges the footer.

## 4. L2 — Cookie consent framework

### 4.1 Categories and configuration

Four fixed categories: `strictly_necessary | preferences | analytics | marketing`.
`strictly_necessary` is always on and non-rejectable. Per-tenant config lives in a
dedicated 1:1 `consent_settings` table (PK = `tenantId`), **not** in `Tenant.settings`
(a hot, RLS-exempt row reserved for module flags) and **not** in `StorefrontSettings`
(Commerce-owned — consent must work for content-only tenants too). This mirrors the
established one-per-tenant `StorefrontTheme` / `StorefrontSettings` shape.

The derived rule that defines the product: `bannerEnabled` is true **iff** `mode != off`
**and** `activeCategories` contains a non-essential category. The state is computed
server-side and shipped to the storefront, so SSR picks the UI with zero client flash.

### 4.2 Three render states

1. **`off`** — render nothing; set no consent cookie.
2. **Quiet notice** (`bannerEnabled = false`, strictly-necessary only) — a persistent
   footer "Manage cookies" link opening the preference center; no blocking layer. This
   is the default for every storefront today, since none set a non-essential cookie.
3. **Banner** (`bannerEnabled = true`):
   - **GDPR** (`mode = gdpr`) — Accept all / Reject all / Manage; non-essential
     trackers stay off until an explicit accept (true opt-in).
   - **CCPA** (`mode = ccpa`) — a persistent "Do Not Sell or Share My Personal
     Information" control; trackers default on, the visitor opts out.

### 4.3 Consent log

`consent_records` is append-only (like `audit_logs`): `visitorId` (a UUID held in the
strictly-necessary `sparx_consent` cookie), optional `customerId` (FK to the CRM
`customers` spine), `mode`, `categories` jsonb, `action`
(`accept_all | reject_all | save_prefs | opt_out`), `policyVersion`, `ipAddress` (INET),
`userAgent`, `createdAt`. The latest row per `visitorId` is the current state; the
history is the legal proof of when consent was given or changed. IP/UA are captured via
the existing `sessionMeta()` pattern (Fastify `trustProxy` makes `request.ip` honor
`X-Forwarded-For` behind Caddy). Retained while the tenant is active; cascade-deleted
with the tenant.

The choices are _also_ mirrored into a readable `sparx_consent_state` cookie so the
storefront can gate scripts at first paint without a round-trip; the server-side record
is the source of legal truth.

### 4.4 The script-gating contract

A storefront client registry (`apps/site/lib/consent.ts`) exposes the single seam
every future tracker uses:

- `getConsent()` — reads `sparx_consent_state`.
- `onConsentChange(cb)` — fires on a `window` `CustomEvent('sparx:consent')` when prefs save.
- `gateTracker({ category, load })` — runs `load` now if the category is granted,
  otherwise on grant.

Server-side, the layout reads the consent cookie (the way it already reads the theme
cookie) and only injects a tracker `<script>` into `<head>` when that category is
granted. A future analytics/marketing integration declares its category in its provider
manifest; installing it adds the category to `activeCategories`, which automatically
promotes the storefront from quiet-notice to banner. No tracker fires pre-consent.

The three existing cookies are categorized in this same registry: `sparx_customer_session`
= strictly-necessary, `sparx_theme` = preferences, `sparx_dev_tenant` = strictly-necessary
(dev only), and the `sparx_cart_id` / `sparx_cart_token` localStorage keys =
strictly-necessary functional storage. The cookie-policy page's disclosure table is
generated from this list.

### 4.5 Always-on, not module-gated

Consent endpoints require only a valid tenant — they are not behind the Storefront or
Commerce module gate, because compliance applies to content-only and commerce-only
tenants alike. This is the reason config lives in its own table.

## 5. The placements table (shared L1 infrastructure)

`storefront_doc_placements` drives where legal docs appear, with a polymorphic
`sourceKind` so the same table serves the future integration-published-docs bridge
(`ProviderMetadata.publishedDocs[]`) without a v2 migration:

```
StorefrontDocPlacement
  tenantId, placement ('footer'|'checkout'|'terms_gate'),
  sourceKind ('cms_entry'|'integration_doc'),
  entryId? (FK→content_entries), legalKind?, providerSlug?,
  label?, columnKey?, position, enabled
  @@unique([tenantId, placement, sourceKind, entryId])
```

Resolution joins placements → entries, drops any whose entry is unpublished / deleted,
orders by `position`, and returns `{ label, href }`. Footer uses `placement='footer'`;
a future checkout terms gate uses `placement='terms_gate'`.

## 6. L3 — Platform legal & acceptance

### 6.1 Where Sparx's own docs live

Real, statically-rendered, indexable pages on the marketing site (`apps/web`) replace
the `ComingSoon` stubs at `app/legal/{terms,privacy,dpa,aup}` and `app/security`. A
single `legal-versions` constant (`apps/web/lib/legal-versions.ts`, or a tiny
`@sparx/legal` package) is the one source of doc versions, imported by both the pages
and the acceptance recorder so the version recorded is exactly the version rendered.
The CMS-on-a-sparx-tenant option is rejected — it would couple platform legal to tenant
infra and complicate versioning.

### 6.2 Acceptance record

`platform_legal_acceptance` is an auth-domain table — **ENABLE-only RLS, no FORCE**,
matching the staff `users` / `sessions` / `accounts` tables, because it is read by the
owner connection before any tenant context is set. Queries pin `tenantId` / `userId`
explicitly. Columns: `tenantId`, `userId`, `docType` (`terms|privacy|dpa|aup`),
`docVersion`, `ipAddress`, `userAgent`, `acceptedAt`. The Better Auth `organization`
plugin is not wired yet (tenant↔staff is `User.tenantId` today); acceptance keys to
Tenant + User, and `tenantId` already maps to the future org id, so nothing churns when
the plugin lands.

### 6.3 Onboarding acceptance gate

A single required combined checkbox on the existing sign-up form — _"I agree to the
Sparx Terms of Service, Privacy Policy, and Acceptable Use Policy"_ (links open in new
tabs) — adds **zero** wizard steps and honors the [15-merchant-onboarding-prd.md](15-merchant-onboarding-prd.md)
under-5-minutes goal. The `platform_legal_acceptance` rows (terms / privacy / aup) are
written **inside the existing `signUpMerchant` transaction**, stamping `docVersion` from
the constant and IP/UA from the server action, so acceptance is atomic with account
creation. The **DPA is not force-accepted** (it is required for EU tenants only) — it is
offered post-onboarding or when a jurisdiction signal (billing country = EU) appears.

### 6.4 Re-acceptance on version bump

`GET /v1/me/legal-status` compares the user's latest accepted version per `docType`
against the current constant; a stale version raises a **non-blocking** re-acceptance
banner (mirroring the onboarding banner) on the next dashboard load, accepted via
`POST /v1/me/legal-accept`. A minor revision never hard-gates the dashboard; only a
version flagged "material" does.

## 7. API surface

All routes use `/v1` and the `{ success, data }` envelope.

Authenticated (dashboard, `requireRole` like existing content routes):

- `GET /v1/legal/checklist` — derived completeness over the registry.
- `POST /v1/legal/pages` — instantiate a starter template into a draft entry.
- `GET / POST / PATCH / DELETE /v1/legal/placements` — placement management.
- `GET / PATCH /v1/tenant/consent` — consent configuration.
- `GET /v1/me/legal-status`, `POST /v1/me/legal-accept` — platform legal re-acceptance.
- Editing/publishing legal pages reuses the existing `content/{entries,publish}` routes.

Public (storefront, no auth, published-only, under the `/v1/public/` allowlist):

- `GET /v1/public/legal/placements?tenant=&placement=footer` — resolved, ordered,
  dead-link-filtered legal links.
- `POST /v1/public/consent?tenant=` — write a consent record (IP/UA captured server-side).
- `GET /v1/public/consent/config?tenant=` — public consent config; these same fields are
  also folded into `GET /v1/public/tenants/:slug` so the storefront gets them in its one
  existing fetch.

## 8. Sequencing

L1 / L2 / L3 are largely independent tracks; the only cross-link is the seeded
cookie-policy page (L1) that the consent preference center (L2) links to.

0. **This design doc.**
1. **Foundations (ships dark):** the four tables + hand-edited RLS migrations; the
   `LEGAL_TEMPLATES` catalog + `legalKind` on `pageType`; the `legal-versions` constant;
   authenticated `GET / PATCH /v1/tenant/consent`.
2. **High-value low-risk fixes:** public placements API + the storefront footer fix
   (broken links gone); replace the `apps/web` `ComingSoon` legal stubs with real pages.
3. **Seeding + consent API:** the `tenant.created` event (+ Terraform topic/sub) + the
   seed consumer; public consent `POST` + config fanout into `/v1/public/tenants/:slug`.
4. **Storefront consent UX:** the gating contract + the consent island (banner /
   quiet-notice / preference center) + SSR script gating + the before-paint script.
5. **Dashboard surfaces:** the CMS Legal checklist + instantiate/placement APIs +
   placement-manager UI; the consent settings panel; the onboarding-progress step swap.
6. **Onboarding acceptance:** the sign-up checkbox + recording in `signUpMerchant`;
   `GET /v1/me/legal-status` + the re-acceptance banner.
7. **Backfill existing tenants:** the tenant-loop `set_config('app.tenant_id', …)`
   migration seeding pages + placements for pre-existing tenants. The heaviest slice —
   scheduled deliberately via the DB Migrate workflow.
8. **Polish:** the newer-template indicator + disclaimer-ack badges; the CCPA
   "Do Not Sell" footer link in quiet-notice mode.

## 9. Risks & open decisions

- **Backfill on FORCE-RLS tables** must loop tenants and `set_config('app.tenant_id', …)`
  per tenant — `sparx_owner` is a non-superuser in prod and sees zero rows otherwise.
  This is the single biggest migration-correctness risk.
- **`tenant.created` event needs Terraform** (topic + subscriber). The synchronous-seed
  stopgap couples `@sparx/auth` to legal content; prefer the event.
- **No uniform api-rest module gate exists.** The dashboard Legal surface inherits CMS's
  layer-level gating; consent is intentionally always-on. A server-enforced
  `requireModule` plugin is a separate cross-cutting effort if wanted.
- **Theme cookie pre-consent.** `sparx_theme` is set before any consent because the
  no-flash script needs it at first paint. It is categorized strictly-necessary /
  functional, disclosed, and not gated (gating it reintroduces theme flash) — defensible
  as a user-initiated functional preference.
- **Proxy single-Set-Cookie.** The storefront `/api/sparx` proxy relays only one
  `Set-Cookie`; the consent cookie is therefore set client-side (like `sparx_theme`),
  never by the API. The consent write endpoint records the row but does not set the cookie.
- **[27-customer-accounts-storefront-auth.md](27-customer-accounts-storefront-auth.md)
  cart-cookie drift.** That doc describes an httpOnly `sparx_cart` cookie; the live code
  uses localStorage. Categorize the localStorage keys as functional storage; reconcile
  the doc separately.
