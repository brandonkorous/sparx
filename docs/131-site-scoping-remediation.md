# 131 — Site Scoping: the operational layer

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-07-20

## The principle

**The tenant is the billing and ownership container. The SITE is the business a
customer actually deals with.**

Anything a customer or an operator would experience as belonging to _one
business_ is site-scoped. The tenant is who pays the bill and who owns the
assets — it is not an identity anybody outside the company interacts with.

## The case that decides every question below

One tenant — **Korous Family Inc.** — running two unrelated businesses:
**Bob's Parts** (machined parts) and **Savory Donuts**.

Every classification in this doc is decided by asking: _would Bob's Parts and
Savory Donuts share this?_ Not _"is the underlying resource shared?"_ — that test
gives the wrong answer repeatedly, because two businesses under one owner share
plenty of resources incidentally while sharing no identity at all.

## 1. Root cause

Of **282 models, 32 carry a site dimension.** Every one of those 32 is in CMS,
builder, storefront, email delivery or site analytics.

Site-scoping was applied deliberately to the **presentation layer** and never
propagated into the **operational layer**. That is why this reads as sixty
independent oversights when it is actually one decision that stopped halfway:

> **Operational records are site records.**

Applied mechanically, with the carve-outs in §6 as the explicit exception list.

## 2. What is already correct (the reference patterns)

Three existing patterns cover every case here. **Nothing new needs inventing.**

| Pattern                      | Example                                       | Use when                                                                       |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| Direct nullable `propertyId` | `Order`, `Customer`                           | The record belongs to exactly one site; **null = "All sites"**                 |
| Many-to-many junction        | `ProductProperty`, `DropshipSupplierProperty` | The record can serve several sites; **no rows = all sites**                    |
| Inherited from parent        | `OrderItem`, `CartItem`                       | Parent is already scoped; add a denormalized column only for query/RLS reasons |

The junction pattern's exact shape: composite PK, **no `tenant_id`** (tenant
scoping rides the FK parents), empty-means-all so existing data needs no
backfill. Copy `ProductProperty` — do not re-derive it.

## 3. P0 — live defects

These produce wrong behaviour or cross-business data exposure **the moment a
tenant creates a second site.** They are not analytics gaps.

### 3.1 `Automation` — fires across businesses

`71-automation.prisma:10`. Trigger is `triggerType` + `triggerConfig` JSON with
no site dimension. An `order.placed` automation authored for Savory Donuts
("send the donut welcome email") **fires on every Bob's Parts order.** Its
actions reference site-specific templates, products and pages, so the output is
wrong and it reaches customers.
**Fix:** nullable `propertyId` on `Automation`; denormalized onto
`AutomationRun` so "what fired on this site" is answerable. The engine must
filter on it — the column alone changes nothing.

### 3.2 `ApiKey` — cross-business data access

`05-api-keys.prisma:14`. `scopes` are module-level (`read:crm`) with no site
dimension. A key issued from Bob's Parts' integrations page **reads and writes
Savory Donuts' customers, orders and pricing.** The header says keys are issued
from a settings page, so operators will reasonably believe a key belongs to the
business they created it in. It does not.
**Fix:** nullable `propertyId` (null = whole tenant, preserving today's
behaviour) plus a scope check at dispatch.

### 3.3 `Member` — staff cannot be scoped to a site

`03-auth-org.prisma:15`. `Member` carries `role`, `memberType` and
`moduleAccessMode`/`MemberModuleAccess` — **and no site dimension.** There is no
way to give someone access to Savory Donuts but not Bob's Parts. A donut
employee sees the machine shop's customers, orders and revenue.
**Fix:** a `MemberPropertyAccess` junction mirroring `MemberModuleAccess` —
no rows = all sites, matching the existing module-access default. The fix belongs
on `Member` (the membership), never on `User` (the person).

### 3.4 `EmailSettings` — wrong sender identity, and a compliance problem

`50-email.prisma:16`. `@id` is `tenantId` — **literally one row per tenant** —
holding `fromName`, `fromAddress`, `replyTo` and the CAN-SPAM `physicalAddress`
rendered in every footer. Every Savory Donuts email goes out as
_"Bob's Parts <sales@bobsparts.com>"_ with Bob's postal address.
This is already internally inconsistent: `Broadcast` and `ScheduledSend`
**are** property-scoped; the sender identity they resolve through is not.
**Fix:** re-key to `(tenantId, propertyId)`. Also `SendingDomain`
(`50-email.prisma:44`) — `isDefault` is per-tenant, so a donut domain can become
the parts default.

### 3.5 `AiPromptTemplate` — the chat AI answers in the wrong voice

`82-ai.prisma:27`, `@@unique([tenantId, key])`. The `category='persona'` row is
the live-chat first responder's system prompt. **A tenant cannot have both a
donut persona and an auto-parts persona.** One storefront's AI will answer as the
other business — visible and embarrassing on day one of the second site.
**Fix:** nullable `propertyId`, widened unique key. Same for `AiToolPolicy`
(`82-ai.prisma:77`), where disabling a tool for one business silently disables it
for the other.

### 3.6 `BillingDocument` — interleaved invoice numbers

`72-invoicing.prisma:115`. `numberSeq` is a per-tenant sequence,
`@@unique([tenantId, number])`. Bob's Parts issues INV-000123 and Savory Donuts
issues INV-000124 — each business's books appear to skip numbers, and it
discloses to customers that two unrelated brands are one entity.
`BillingDocumentTemplate.isDefault` is also one-per-tenant, forcing both
businesses onto one letterhead.
**Fix:** required `propertyId` on `BillingDocument`, `@@unique([tenantId,
propertyId, numberSeq])`, nullable on `BillingDocumentTemplate`. Plus the two
document-integrity items from [130 §2.7](130-analytics-normalization.md):
freeze the **issuer identity** onto the document at finalize (today only
`billTo`/`shipTo` are snapshotted, so renaming a site rewrites historical
letterheads), and render the legal entity alongside the trading name for tax
purposes.

### 3.7 `ChatConversation` — no routing, no context

`57-chat.prisma:10`. `source` knows _a_ site exists (`site | sparx_market |
dashboard`) but not _which_. The staff inbox merges both businesses into one
queue and one unread badge; canned replies mentioning donuts surface in a parts
chat; the AI handler has no site context to answer from.
**Fix:** required `propertyId` on the conversation, denormalized onto
`ChatMessage`, nullable on `ChatQuickReply`. Related: `chat/ai-handler.ts:204`
is already catalogued as an unscoped reader.

### 3.8 `Redirect` — fires on the wrong domain

`13-cms-editorial.prisma:34`. A 301 authored for the donut site **fires on the
parts domain.** Small model, real breakage.

### 3.9 `ConsentRecord` / `ConsentSettings` — consent leaks between businesses

`53-consent.prisma:33` and `:12` (`@id tenantId`). Cookie consent granted on one
storefront is silently honoured on the other, and both businesses share one
banner and one GDPR/CCPA mode. Legally dubious and worth a compliance read.

## 4. P1 — customer-visible, not yet breaking

Grouped; all follow §2's patterns.

**Storefront & brand.** `SeoAudit` (`52-seo.prisma:14` — the "site-wide" SEO
score currently merges two sites), `SiteTheme`/`SiteLayoutDefault`/
`SiteLayoutAssignment`/`PageLayout`/`SiteSection`/`SiteLayoutBlock` (49 — tenant-
scoped while `SiteConfig`/`SiteVersion` beside them are property-scoped, an
inconsistency inside one file), `Page` (10), `ContentType` (11),
`Taxonomy`/`TaxonomyTerm` (12), `Author` (13), `NavigationItem` (16).

**Commerce, customer-facing.** `Discount` (junction — a promo code is one
business's offer), `Bundle`/`ConfigurationTemplate` (38),
`PriceList`/`MarkupRule`/`SurchargeRule` (36 — surcharges print on documents),
`ShippingZone`/`ShippingProfile`/`ShippingRate` (44 — donut delivery rates must
not appear on a parts cart), `FitmentDomain`/`FitmentNode` (33 — vehicle fitment
is meaningless on a donut site), `ProductReview`/`ProductQuestion`/
`ProductAnswer`/`Wishlist` (42 — denormalize _where it was written_, since a
shared product's review would otherwise surface on both storefronts).

**Scheduling — the entire module** (`78-scheduling.prisma`, 16 models). A booking
widget lives on a storefront and a service ("oil change" vs "cake tasting") is
unambiguously one business's. `propertyId` on `SchedulingService`,
`BusinessLocation`, `BookingPolicy`, `IntakeForm`; denormalized on `Booking`.
`SchedulingResource` is the exception — a person can genuinely work both
businesses, so that one wants a junction. Note the file's own TODO at `:462`
about reconciling with a shared locations table: this decision forces it.

**Marketplace & channels.** `MarketListing`/`MarketMerchant`/
`MarketMerchantProfile` (80) — "Korous Family Inc." must not be the merchant
identity for both donuts and brake pads. `ChannelConnection`/
`ChannelProductMapping` (79) — an Etsy or TikTok shop maps to one business.
`ProviderInstallation` (46). `JobApplication` (83), `Bootcamp`/
`BootcampRegistration` (84) — you apply to a business, not a holding company.

**B2B.** `PurchaseApprovalRule` (`63-b2b-approval.prisma:18` — a rule set for one
business gates checkout on the other; arguably P0).

## 5. P2 — internal-only

`Pipeline`/`PipelineStage`/`Deal` (22 — the header itself cites per-business
pipelines like "Fleet Contract Renewals"), `Segment`/`SegmentMember` (32 —
`Customer` is already property-scoped and segments feed the property-scoped
`Broadcast`, so this is a live inconsistency), `Task` (31), `CrmActivity` (30),
`SavedView` (06), `UserFavorite`/`UserRecent` (06), `Notification` (86),
`ImportJob`/`ImportJobRow` (55), `AutomationVersion`/`AutomationRun`/
`AutomationRunStep` (71), `AuditLog` (04 — optional, but materially improves
forensics).

## 6. Carve-outs — genuinely tenant-level

**Physical inventory.** `Warehouse`, `InventoryLevel`, `InventoryMovement`,
`InventoryReservation`, lots/serials, purchasing, receiving, counts, transfers,
sources. One physical unit cannot belong to two businesses, and one building can
stock both. **Ownership of goods resolves through the product** — `InventoryLevel
→ variant → product → ProductProperty` — so per-site valuation already works with
no schema change. Caveat: a product linked to both sites belongs to both, so
per-site valuations **do not sum** to the tenant total (see [130
§2.5](130-analytics-normalization.md)).

_Open:_ a `WarehouseProperty` junction would answer "which locations does this
business ship from" — a **fulfilment-routing** need, not a valuation one. Lower
priority than anything in §3, and it should not be conflated with ownership.

**Billing & ownership.** `Tenant` internals, `OnboardingChecklist`,
`TenantBusiness`, `Property` itself, `BillingSubscriptionItem`,
`PlatformLegalAcceptance`, `DomainPurchase` (the _purchase_; `Domain` is already
property-scoped — the right split).

**Payments.** `TenantPaymentConfig`, `TenantGatewayCredential` — one merchant
account per legal entity is normal. `PaymentIntent`/`PaymentEvent` inherit from
`Order`.

**Partner program** (83) — referral and commission are billing-container
concepts. **Builder component library** (51) — a reusable library is legitimately
shared; the pages built from it are already scoped. **Dropship catalog** —
tenant-wide by documented design; `DropshipSupplierProperty` already handles the
part that needs scoping.

**Analytics rollups** (75) — the tenant-level rollups are correct _as the billing
view_. They each need a **parallel per-property rollup**, exactly as
`RollupSiteDaily` already does. A missing sibling table, not a defect.

## 7. Decisions needed — product calls, not technical ones

1. **`TenantBrand`** (`07-tenant-brand.prisma:16`). `50-email.prisma:22` states
   explicitly that brand identity is tenant-level and _"email may never override
   the brand."_ Under this doc's principle that is backwards — two unrelated
   businesses cannot share a logo and palette. Flagged separately from §3
   because an explicit architectural decision was written **against** it, so it
   needs a deliberate override rather than a silent fix. This is the front half
   of the **TenantBrand → Property consolidation** already agreed in principle.
2. **`CustomerUser`** (`48-customer-auth.prisma:31`). A shopper who signs up at
   Savory Donuts **can log into Bob's Parts today.** `Customer` (the CRM record)
   is property-scoped while the login is not. That may be intentional — one
   account across a family of brands is a real pattern — but it must be
   confirmed, not inherited.
3. **`EmailSuppression`** (`50-email.prisma:211`). A hard bounce is physically
   per-address and belongs tenant-wide; an _unsubscribe_ is a per-business
   consent decision, and opting out of donut marketing should not stop parts
   order receipts. Suggested split: `propertyId` null for `bounce`/`complaint`,
   set for `unsubscribe`.
4. **`GiftCard`** — redeemable across sibling businesses, or not? Most operators
   would say not.
5. **`B2BAccount`** and credit. Does a fleet customer have one credit line across
   both businesses or two? `creditLimit`/`creditUsed` on a shared account is the
   crux.
6. **`TaxExemption`** — per legal seller entity; if both sites bill under one EIN
   this is genuinely tenant-level.
7. **`FeedbackSubmission`** (81) — platform feedback to WizeWorks (tenant-level,
   correct) or customer feedback about a business (site-scoped)?
8. **`MediaAsset`** — a shared media library is defensible; two unrelated brands
   sharing imagery may not be.

## 8. Migration mechanics

**There are no production tenants.** That is not merely a lower risk — it changes
which design is correct. Nullable columns and no-backfill semantics are
compatibility devices, and with nothing to be compatible with they are a liability
rather than a convenience. **Prefer the structurally correct shape, not the
migratable one.**

- **`NOT NULL` wherever "all sites" is not a real state.** A nullable
  `propertyId` means every query must remember to handle the null case, and the
  scoping defect can silently recur forever. A required column makes the database
  enforce what this doc is arguing for. Required: `BillingDocument` (an invoice
  always belongs to one business), `ChatConversation` (a chat always happens on a
  site), `EmailSettings` (re-keyed `(tenantId, propertyId)`), `ConsentSettings`,
  `Booking`, `SchedulingService`.
- **`Order.propertyId` should become `NOT NULL` too.** It is nullable today only
  to accommodate legacy/admin/import/MCP orders — but an admin creating an order
  _should_ be made to choose a business, and an import _should_ target one. With
  no rows to preserve, the honest fix is to require it and make the UI ask.
- **Nullable stays only where "all sites" is genuinely meaningful:**
  `Automation` (a tenant-wide rule is a real thing), `ApiKey` (a tenant-wide
  integration key is real — though the UI should default to site-scoped),
  `SavedView`, `Notification`, `AuditLog`.
- **Junctions keep no-rows-means-all on merit, not convenience.** A product
  defaulting to visible everywhere is good behaviour, not a backfill dodge.
- **The rollup sentinel UUID is no longer needed** if the source columns are
  `NOT NULL` — the whole `ON CONFLICT`-misses-null footgun
  ([130 §2.3](130-analytics-normalization.md)) disappears rather than being
  worked around. Prefer that.
- **Rollup tables are derived data.** They do not need migrating at all — drop,
  re-key, and let the nightly reconcile rebuild them from source. No backfill
  code to write, review or get wrong.
- **Breaking changes can be hard breaks.** No versioning, no deprecation window,
  no parameter aliases ([130 §1.1](130-analytics-normalization.md)). Aliases kept
  "for compatibility" are how the variance survives.
- **Migrations go through the pipeline**, never a laptop — Cloud SQL is
  private-IP only. Any backfill on a FORCE-RLS table must loop tenants and
  `set_config('app.tenant_id', …)`; `sparx_owner` is a non-superuser in prod and
  sees zero rows otherwise. Passes locally, fails in prod. See
  [packages/db/CLAUDE.md](../packages/db/CLAUDE.md).
- **The column is the easy half.** Every item here has an enforcement half —
  filtering the automation engine, checking the API key at dispatch, routing the
  chat, resolving the sender. **Shipping the column without the enforcement
  leaves the defect exactly where it is**, now with a field that looks like it
  was handled.

## 9. Sequence

1. **P0 §3.1–3.3** — `Automation`, `ApiKey`, `Member`. Wrong behaviour and
   cross-business access. Column _and_ enforcement together.
2. **P0 §3.4–3.9** — email identity, AI persona, invoice numbering, chat
   routing, redirects, consent.
3. **§7 decisions** — several block work below; `TenantBrand` and `CustomerUser`
   are the two that matter most.
4. **P1** — customer-visible surfaces, module by module.
5. **P2** — internal filtering, which is largely quality-of-life.
6. **Per-property rollups** (§6), unblocking [130](130-analytics-normalization.md)
   and the dashboards in [129](129-analytics-dashboards.md).

**Now is the moment, and the window is exactly this.** With no production tenants
every item here is a schema edit and a code change — no backfill, no deprecation,
no online migration, and primary keys and unique constraints can simply be
re-cut. The instant real tenants exist, each becomes a migration against a live
write path, and several — invoice numbering, consent, email sender identity —
become records that were already wrong when a customer received them, which no
migration can retract.

The corollary is that **cheap is not the goal — correct is.** The temptation with
no users is to do the minimum because nothing is at stake; the opportunity is the
opposite. This is the only period in the product's life when the structurally
right answer and the cheap answer are the same answer.
