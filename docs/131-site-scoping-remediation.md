# 131 — Site Scoping: the operational layer

Version: 1.10.0
Author: Brandon Korous
Last Updated: 2026-07-20

## Status

| Item                                       | Column | Enforcement | Notes                                     |
| ------------------------------------------ | ------ | ----------- | ----------------------------------------- |
| §3.1 `Automation`                          | done   | done        | migration 20261211/20261212               |
| §3.2 `ApiKey`                              | done   | done        | + `api_keys` operator-read fix (20261215) |
| §3.3 `Member`                              | done   | done        | + junction operator-read fix (20261213)   |
| §3.4 `EmailSettings` / `SendingDomain`     | done   | done        | migration 20261216; `is_default` dropped  |
| §3.5 `AiPromptTemplate` / `AiToolPolicy`   | done   | done        | migration 20261217                        |
| §3.7 `ChatConversation` / `ChatQuickReply` | done   | done        | migration 20261218                        |
| §3.8 `Redirect`                            | done   | done        | migration 20261219                        |
| §3.9 `ConsentRecord` / `ConsentSettings`   | done   | done        | migration 20261219                        |
| §3.6 `BillingDocument`                     | done   | done        | migration 20261221 — numbering + issuer   |

**P0 is complete.** §3.6 was the largest of the nine and the least reversible: a
wrong scoping decision elsewhere shows the wrong data, but a wrong one here
produces documents that were already wrong when a customer received them, and no
later migration retracts a sent invoice. It carried two fixes rather than one —
`numberSeq` became a per-SITE sequence (the per-tenant one interleaved two
businesses' books, so each appeared to skip numbers and the gaps disclosed that
two brands are one entity), and `issuedBy` now freezes the seller onto the
document at finalize, closing the asymmetry where `billTo`/`shipTo` were
snapshotted and the seller was read live.

Three deliberate calls inside §3.6 worth carrying forward:

- **`ON DELETE RESTRICT`** on `billing_documents.property_id` — the only blocking
  FK in this remediation. Cascade would let deleting a site destroy its books;
  SetNull would leave invoices nobody issued. Refusing the delete is the honest
  answer rather than choosing which damage to do, so a site with billing history
  must be archived instead.
- **Existing rows keep `issued_by` NULL** rather than being backfilled from
  today's business details. A snapshot is a claim about what the document said
  WHEN ISSUED; inventing one now would fabricate exactly the evidence the column
  exists to make trustworthy. Renderers fall back to the live entity for those.
- **The issuer snapshot carries BOTH names** (`siteName` + `legalName` + gated
  `taxId`). The trading name is what the customer recognises; the legal entity is
  what the tax authority requires, and on a multi-brand tenant they differ. The
  tax id is included only when `taxRegistered` — printing a VAT number a business
  does not have is a misrepresentation.

**Not changed: `Order.orderNumber`.** The same disclosure argument applies (order
numbers appear in customer email), but `Order.propertyId` is NULLABLE by design —
orders outlive their site via SetNull — so a per-site count would be unstable in
exactly the case that matters. Left alone deliberately rather than by omission;
if per-site order numbering is wanted it needs a stable allocation column of its
own, not a count.

### P1 — started

`PurchaseApprovalRule` is **done** (migration 20261222). Taken first because §4
flags it "arguably P0" and that reading is right: it is the only P1 item that
decides whether an order can be **placed at all**, rather than which data a
screen shows. Nullable, and matching is now two independent axes — a rule fires
when its ACCOUNT axis covers the buyer (specific, or null = any) AND its SITE
axis covers the order's site. Two ORs under an AND, not one OR: collapsing them
would fire a donut-shop threshold on a machine-shop order.

Worth recording, because it was almost documented as fiction: the file header
described a most-specific-wins precedence order that **the code does not
implement** — the gate is a boolean `findFirst`, so a specific rule and a
catch-all cannot disagree (both mean "requires approval"). The header now says
that, plus the condition that would break it: the moment rules carry different
APPROVERS, "which rule fired" starts to matter and a real precedence order has to
be chosen rather than inherited from `findFirst`'s arbitrary ordering.

`Discount` and shipping (`ShippingZone`, `ShippingProfile`) are **done**
(migration 20261223). Both are money a customer sees at checkout, and the two
used DIFFERENT patterns on purpose — this pair is the clearest worked example of
§2's choice between them:

- **`Discount` → junction** (`DiscountProperty`, copied from `ProductProperty`).
  A promotion genuinely runs on several sites: an owner's whole-portfolio sale is
  ONE promotion, and N copies means N things to expire, amend, and get out of
  sync. Empty = all sites, so no backfill.
- **`ShippingZone`/`ShippingProfile` → nullable column.** A delivery footprint
  belongs to one business's logistics; the shared case is a single warehouse
  serving everything, which null expresses directly.
- **`ShippingRate` → neither.** It exists only at the intersection of a zone and
  a profile, both now scoped, so it is already unreachable from a site that
  cannot reach its zone. A column there would be a second source of truth able to
  contradict the first.

Two decisions inside that are easy to get backwards:

- **Discount CODE uniqueness stays per-TENANT** even though the promo is now
  per-site. Two businesses each defining `SAVE10` with different terms is a
  support incident — a shopper quoting the code to staff, or an operator reading
  a report, has no way to tell which is meant. One code, one meaning.
- **A code valid on a sibling site returns the same error as a nonexistent one.**
  Distinguishing them turns the redeem endpoint into a way to enumerate the other
  business's active promotions.

`SeoAudit` is **done** (migration 20261224), and it is the one item so far where
the obvious answer was wrong. A score is an average over a set of pages, so
merging two sites computes a _different_ number, not a mislabelled one — which
argues for a REQUIRED column. But the four audited entity types disagree about
site membership: a `builder_page` carries `property_id` directly, while a
`product`, `collection`, or `cms_page` reaches sites through a JUNCTION and can
appear on several while having ONE score (its title and description are the same
wherever it shows). Pinning a shared product to a single site would invent a fact
the data does not have, so the column is nullable: SET for single-site entities,
NULL for shared ones. A site's overview is then "audits scoped to me, UNION
audits for entities I expose", resolved through junctions that already answer
that question.

The unique key `(tenantId, entityType, entityId)` deliberately does NOT gain
`propertyId`. An entity has one score; adding the site would let the same page
hold two contradictory scores. The key expresses "one score per thing" —
`propertyId` is an attribute of the thing, not part of its identity.

`ProductReview` / `ProductQuestion` / `Wishlist` are **done** (migration
20261226). These stamp **where the content was written**, deliberately not "the
site that owns the product" — a product reaches sites through the
`ProductProperty` junction and can be listed on several, so ownership cannot
identify a site and the act of writing is unrecoverable afterwards. Hence a
denormalized column rather than a join.

All three are **SetNull**, and the contrast is the rule worth carrying: these are
records of what a real person wrote or saved, so closing a storefront must not
delete their words or empty their list. Operator-authored content (quick replies,
letterhead templates, redirects) Cascades, because it belongs to the business.
`ProductAnswer` gets no column — it exists only under its question and inherits.

**The rating aggregate is now per-site too (closed — migrations 20270103 +
20270104).** `Product.averageRating` / `reviewCount` are denormalized columns on
`products`, so on their own they stay TENANT-WIDE — a product listed on two
storefronts would show a star rating computed from 12 reviews above a list of 3.
The fix is a dedicated `ProductReviewRollup` (`commerce_product_review_rollups`):
one row per `(product, site the reviews were written on)` holding the SUM of
ratings and the count — **sums, not averages, because averages cannot be averaged**
and a storefront's figure combines two buckets (its own reviews + the shared/legacy
`null` bucket every site counts). `recomputeProductRating` maintains it in the same
transaction as the tenant-wide columns (group by `propertyId`, `deleteMany` +
`createMany` so a site that loses its last review drops its row), and the storefront
reads combine `sum(sumRating)/sum(reviewCount)` over the `[site, null]` rows —
`reviewRollupsSelect` in `public/commerce.ts`, threaded through the PLP, search
hydrate, collection/category grids, and the PDP. A junction-column aggregate was
rejected: the review's site is the site it was WRITTEN on, which the ProductProperty
junction (where a product is VISIBLE) cannot express. `null` is nullable for the
pre-multi-site bucket, `NULLS NOT DISTINCT` keeps it one row per product, and the
20270104 backfill primes existing products (per-tenant loop, FORCE-RLS). Proven
non-inert by the `product-reviews.test.ts` per-site test (disable-verified: with
the rollup read off, the PDP reverts to the tenant-wide blend and the test fails).
The non-scoped `by-ids` hydrate keeps the tenant-wide columns — it has no site
context. Recorded at `review-service.ts` `recomputeProductRating`.

`ProductFitment` and `Bundle` are **done — no column, by analysis.** Both are
ATTRIBUTES of a product, not independently site-scoped things, so they inherit the
product's scope through the `ProductProperty` junction (already per-site) exactly as
`ShippingRate` inherits from its zone/profile and `ProductAnswer` from its question:

- **`ProductFitment`** — "this brake pad fits a 2015 F-150" is true wherever the
  product is listed; a fitment cannot belong to one site while its product shows on
  three. A `property_id` here would be a second source of truth able to contradict
  the product's junction.
- **`Bundle`** — 1:1 with its wrapper product (`@@unique([bundleProductId])`). A
  bundle IS a product plus composition rules; its visibility is its wrapper's. There
  is no independent public bundle read — bundles resolve through the (site-scoped)
  wrapper product.
- **`FitmentDomain` / `FitmentNode`** — the vehicle/species/brand vocabulary TREE,
  a tenant-wide LIBRARY like `Taxonomy` (shared, no column).

The enforcement half, which "no column" does NOT excuse: the storefront fitment
narrowing filter must only offer domains THIS site's catalog uses, or a donut site
under the same tenant as a machine shop renders a "Vehicles" filter — a
cross-business exposure. So `GET /v1/public/commerce/fitment/domains` now scopes its
index to domains with at least one fitment on a product visible on the active site
(the empty-means-all product-visibility rule, inside `withTenant`). Single-site
tenants are unaffected (their products are visible everywhere). The node drill within
a shown domain stays the shared tree — its per-level product lists are already
site-scoped, so an empty branch simply shows no products.

`Author`, `Taxonomy`, `TaxonomyTerm` are **done** (migration 20261227). Three
models that scope three different ways, which is the point rather than an
accident:

- **`Author` → nullable, SetNull.** A byline is a public PERSONA, not a login
  (`userId` is the separate optional link to a staff account). SetNull is the
  one that is easy to get wrong: deleting a site must not delete a person's
  byline, because their published articles still reference it.
- **`Taxonomy` → nullable, Cascade.** A vocabulary is a SCHEMA ("posts have
  categories"), so shared is the common correct case.
- **`TaxonomyTerm` → nullable, Cascade, and scoped INDEPENDENTLY of its
  taxonomy.** A term is CONTENT — "Diesel repair" is meaningless on a donut site
  and would otherwise appear in its category filters. A shared vocabulary
  holding per-site terms is the arrangement that is actually useful, and that is
  only expressible if the term does not inherit.

All three keep slug/key uniqueness at the TENANT (or taxonomy) level rather than
adding `propertyId`. Those columns back URL segments — `/authors/jane`,
`/blog/category/specials` — so letting two sites own one slug reintroduces
exactly the ambiguity a slug exists to remove, and would collide a shared
null-site row with a site-scoped one.

**Scheduling — the whole module — is done** (migration 20261228), and it's the
one that exercises both scoping patterns at once because its models genuinely
differ:

- **Direct column:** `SchedulingService`, `BookingPolicy`, `IntakeForm` (Cascade
  — authored offerings) and `Booking` (SetNull — a record of an appointment a
  real customer made). `Booking.propertyId` is denormalized from the service AT
  BOOKING TIME, so re-scoping a service later cannot rewrite which business past
  bookings belonged to.
- **Junction:** `SchedulingResourceProperty` and `BusinessLocationProperty`. A
  resource is often a PERSON who works both businesses, and a column would split
  them into two calendars — double-booking a human is the worst failure this
  module can produce. A location is a PLACE that can host more than one business.
  Both are the SAME shape as warehouses, and the location junction resolves the
  open question the doc flagged at `78-scheduling.prisma` / docs/79 §21.

Enforcement went beyond stamping the column. The **allocation engine** now filters
candidate resources by the booking's site — a resource is eligible only if it
works for that site or is unrestricted — so the junction is a real booking
constraint, not just a label. The public widget lists per-site services (a donut
site no longer offers oil changes), and staff service-create defaults to the site
being worked in.

`ChannelConnection` is **done** (migration 20261229). An Etsy/TikTok/Amazon shop
belongs to one business — Bob's Parts and Savory Donuts each have their own Etsy,
under their own name and OAuth grant — and both can connect the SAME channel
type, which the old `(tenant, channel)` unique made impossible for the second.
Now `(tenant, property, channel)`, NULLS NOT DISTINCT so the tenant-wide tier
also can't duplicate. `ChannelProductMapping` inherits from its connection and
takes no column. The site is captured at connect time and carried through the
SIGNED OAuth state to the callback — it cannot be re-derived there, because the
callback has no signal for which site the operator was on, and guessing would
authenticate one business as another.

### sparx.market merchant identity: a site-chosen global handle — v1 BUILT (migration 20270107)

`MarketMerchantProfile` / `MarketMerchant` / `MarketListing` are the marketplace
models. The merchant projection's `slug` drives a GLOBALLY-UNIQUE public URL
(`/merchants/{slug}`), and it USED to be the tenant slug (globally unique by
construction). That made "Korous Family Inc." the seller for both donuts and brake
pads and coupled the two businesses' URLs — the exact disclosure the rest of this
remediation fights.

The two shapes considered:

- **Namespaced:** `/merchants/{tenantSlug}-{siteSlug}`. Collision-free by
  construction, no claim flow — but it reintroduces the exact coupling the rest of
  this remediation fights: two sibling businesses share a URL prefix, disclosing
  they are one owner (the §3.6 invoice-numbering concern, in the address bar).
- **Site-chosen global handle:** each market-participating site claims a unique
  merchant handle, enforced globally. `/merchants/bobs-parts` and
  `/merchants/savory-donuts` are independent identities with nothing linking them.

**Decision: the site-chosen global handle.** It is the only option consistent with
the principle the whole remediation turns on — a site is an independent business,
and its public identity must not leak that it shares an owner. The namespaced shape
is a disclosure leak wearing a URL. The usual objection to a global handle is the
back-compat cost of an existing `/merchants/{tenantSlug}` space, but **there are no
production tenants**, so there is nothing to preserve and no reason to ship the
coupled shape first (the §8 "now is the moment" point). The handle DEFAULTS to the
site's slug, is globally unique (a claim/collision check on set + edit), and lives
on `MarketMerchantProfile` as its own column — never derived from tenant or property
slug, which are the wrong scope.

**v1, BUILT (migration 20270107).** `MarketMerchantProfile` gains a globally-unique
`handle` (the DB unique index is the real backstop — the table is RLS-scoped, so the
app cannot pre-read another tenant's handle; a collision surfaces as a friendly
"handle already taken" on the claim) plus `marketPropertyId`, the SITE the tenant
markets AS. The projection worker (`market/projection.ts`) now sources the merchant's
name/logo/socials from that site (never the tenant) and writes the `handle` into
`MarketMerchant.slug` / `MarketListing.merchant_slug` — so `/merchants/{handle}` is a
site identity with nothing linking siblings. The "visit their store" link keeps the
tenant/site storefront slug (a different URL from the marketplace page). The backfill
seeds `handle = tenant slug` + `marketPropertyId = primary`, preserving every existing
URL; operators re-claim a cleaner handle from the profile editor. Guarded by
`market-merchant-handle.test.ts` (asserts the projection uses the handle + marketed
site name, and that a second tenant cannot claim the same handle) — migration-gated,
so RUN post-migration.

**Deliberately deferred to a v2 layer (NOT this slice): one merchant PER SITE per
tenant.** v1 keeps one marketplace merchant per tenant, tied to a chosen site — which
fixes the actual defect (the URL/identity is a site's, not the tenant's). Letting a
tenant run SEVERAL of its sites as separate marketplace merchants additionally
requires multiplying listings per `(product, participating-site)` (a product visible
on two market sites becomes two listings under two merchants) and relaxing the
`MarketMerchant`/`MarketMerchantProfile` tenant-unique to `(tenant, property)`. That is
a larger, additive change on top of this foundation, not a correction of it — the v1
schema (nullable `marketPropertyId`, `MarketMerchant.propertyId`) is already shaped to
grow into it. It stays a clear flag rather than a rushed multiplication of the
projection worker.

`Page` and `ContentType` are **done** (migration 20261230), and `NavigationItem`
needed no work. Details:

- **`Page` → direct nullable column.** A page's slug is a URL, so this is the
  Redirect shape — uniqueness moved to `(tenant, property, slug)` (NULLS NOT
  DISTINCT) so two sites can each own `/about`. The `pages` table is still live
  (search projection, chat grounding, dashboard counts), so this was a real leak;
  the AI grounding now cites only the conversation's site's pages.
- **`ContentType` → nullable, like Taxonomy.** It is a SCHEMA, so shared is the
  common case; its entries carry the per-site scope via the existing
  `ContentEntryProperty` junction. `key` uniqueness stays per-tenant (it routes).
- **`NavigationItem` → already done.** It belongs to a `NavigationMenu`, which is
  already per-site (`propertyId`, null = tenant-wide fallback), and inherits —
  the same pattern as ProductAnswer / ShippingRate / ChannelProductMapping. The
  P1 list should not have named it separately.

### DECISION — the sitebuilder layout/theme group (49): split CONFIRMED

The doc's P1 list lumped six models together —
`SiteTheme`/`SiteLayoutDefault`/`SiteLayoutAssignment`/`PageLayout`/`SiteSection`/
`SiteLayoutBlock` — as "tenant-scoped while `SiteConfig`/`SiteVersion` beside them
are property-scoped." Working through them, that grouping is wrong and hides a
real conflict. The library-vs-application split, now CONFIRMED by auditing the
models (all six carry no `property_id` today):

- **`SiteTheme` (and the section tier) are DELIBERATELY tenant-wide — confirmed.**
  The property schema states it outright at `08-property.prisma`: "The saved-theme
  LIBRARY (SiteTheme) + the legacy section tier stay tenant-wide and do NOT
  relate here." A theme is a reusable design you save once and apply to any
  site — the same call as MediaAsset in §7 (shared library, per-site usage).
  Scoping it would break reuse and directly reverse a written decision. **It stays
  tenant-wide; no change.**
- **`PageLayout` / `SiteSection` / `TenantSectionDefinition` are also libraries —
  confirmed tenant-wide, no change** for the same reason.
- **`SiteLayoutDefault` / `SiteLayoutAssignment` are the genuinely per-site
  ones** — they map a target (`SiteLayoutDefault`) or a target+item
  (`SiteLayoutAssignment`) to a `PageLayout`, i.e. they decide WHICH layout from the
  shared library renders where. Two sites sharing a PageLayout library can
  legitimately want different defaults, so these — and ONLY these two — get
  `propertyId`.

**Decision on the per-site pair: nullable `propertyId` + tenant-fallback
resolution, gated on the builder rebuild — NOT executed now.** The scoping shape is
settled: add a nullable `property_id` to both; move the unique to
`(tenant, property_id, target_id)` / `(tenant, property_id, target_id, item_ref)`
with NULLS NOT DISTINCT; resolution reads the active site's row first and falls back
to the tenant-wide (null) row — the same shared-null pattern `NavigationMenu` already
uses. What blocks EXECUTION is not the decision but the ground: the resolution read
path lives in `packages/builder/src/services/assignment-service.ts` — the NEW
package of the in-flight builder rebuild (docs/98), which coexists with legacy
`packages/sitebuilder/` and took parallel commits this same session. A schema column
without the resolution change is this doc's own #1 anti-pattern ("the column exists
≠ the leak is closed"), and doing the resolution change means editing a subsystem
that is actively being rebuilt by other work — a half-migration into a moving target.
So this lands as one slice WHEN the builder rebuild settles onto a single assignment
service, not before. The decision is made; only the timing is held.

The **scheduling module is DONE** (migration 20261228, `_scheduling_per_site`) —
the doc previously listed it as the largest untouched chunk, which is now stale. It
exercises BOTH patterns in one place because its models genuinely differ:

- **Direct column** where a thing belongs to one business — `scheduling_services`
  (what a business offers), `scheduling_booking_policies` (its promise to customers),
  `scheduling_intake_forms` (its questions), and `bookings` (denormalized from the
  service AT BOOKING TIME so history stays correct if the service is later re-scoped).
- **Junction** where one thing serves several — `scheduling_resource_properties` (a
  RESOURCE is often a PERSON, and the owner who bakes then machines genuinely works
  both businesses; a column would split them in two) and `scheduling_location_properties`
  (a location is a PLACE, and one place can host several sites — empty = every site,
  the ProductProperty convention, so existing rows need no backfill). Enforcement
  lives in `packages/scheduling` (`booking-queries.ts`, `booking-service.ts`,
  `services.ts`). The `BusinessLocation` shared-locations question the old TODO
  flagged was answered here, by the junction.

`ProductFitment` / `Bundle` are done by analysis (no column — see above). **What
genuinely remains** is a smaller set than the doc once implied: the
`PriceList`/`MarkupRule`/`SurchargeRule` pricing family, and marketplace & channels
(the merchant-handle slice decided above).

### DECISION — the pricing family (36): patterns set, one charge-critical slice

`PriceList` / `MarkupRule` / `SurchargeRule` were the last unscoped commerce group.
Working through them model by model — which is the point of this remediation, not a
formality — only ONE genuinely decomposes per-site, and the other two revealed why a
blanket "scope everything" would have shipped incoherent pricing:

- **`PriceList` → JUNCTION (`PriceListProperty`, empty = all sites) — BUILT**
  (migration 20270106). A price list is a commercial targeting rule an owner can
  legitimately run across a same-catalog portfolio (a "Contractor tier" on both a
  retail storefront and a wholesale portal is ONE list), and a column cannot express
  "sites A and B but not C" — the same reason `Discount` took a junction. It already
  carries channel / segment / B2B / collection targeting; site is one more axis, and
  empty-means-all keeps every existing list global with zero backfill. It is resolved
  per (variant, site, customer) at read/cart time, so the site genuinely changes the
  price — this is the charge-critical one.
- **`MarkupRule` → TENANT-WIDE, no column.** Discovered while implementing: a catalog
  markup writes a VARIANT's single `priceCents`, and a variant is one shared row — it
  cannot hold two per-site prices, so per-site catalog markup is incoherent. The
  per-site price difference is `PriceList`'s job; markup operates on the shared
  catalog, its `scope` (which variants) doing the partitioning.
- **`SurchargeRule` → TENANT-WIDE, no column.** A card-fee pass-through rides
  per-TENANT payment processing (one merchant account — `TenantPaymentConfig`), so the
  fee is shared; its `paymentMethods` / `appliesTo` axes differentiate it, not the
  site, and the checkout session carries no site to enforce on anyway.

**The enforcement is charge-critical** — the price list is the one thing here that
decides what a customer is actually CHARGED. It lands in the `resolve()` waterfall:
`pickEligiblePriceList` (`pricing-service.ts`) gains a
`propertyLinks: { none: {} } OR { some: { propertyId } }` clause,
`PriceResolutionRequest` + `resolveCart` gain `propertyId`, and every real charge
path threads the site — the cart (`cart-service` reprices, from `Cart.propertyId`) and
the PDP "your price" (`public/commerce.ts`, the active site). Absent a site (admin /
preview) the filter is skipped, so the default stays backward-compatible. Because a
wrong filter here over- or under-charges a real order AND it is migration-gated (the
junction does not exist until 20270106 is applied), it MUST ship with
`price-list-per-site.test.ts` RUN post-migration — never trusted from a typecheck.
The remaining `@sparx/commerce` typecheck error (`propertyLinks` on the where) is the
expected stale-client symptom, resolving on `prisma generate`.

The only piece now genuinely open is **marketplace & channels** (the merchant-handle
slice decided above), which coordinates with the channel work rather than landing on
top of it.

### Not done as specified: `ChatMessage.property_id`

§3.7 called for `property_id` denormalized onto `ChatMessage`. It was skipped.
The tenant_id denorm exists because the RLS policy must filter without a join;
site filtering has no equivalent need, since messages are only ever read through
their conversation. Adding it would buy nothing and cost a sync obligation — a
conversation re-homed to another site would silently disagree with its own
messages. Revisit only if per-site message analytics needs it, and then denorm
with a trigger rather than by hand.

### Member-access READ scoping — the boundary was write-only

§3.3 gave staff members per-site access and I wired it into the customers list —
but the OTHER dashboard lists had no site bound at all, so a member restricted to
one business could list every other business's records through them. Now closed
via a `reachableSiteIds(actor)` helper (granted sites, or `undefined` =
unrestricted → sees all), passed as a list-filter ceiling on:

**deals, tasks, pipelines, segments, orders, billing documents, automations,
bookings, broadcasts** (nine lists).

A real distinction surfaced in the `null`-property handling, and it is NOT
uniform — encoding it wrong would either leak or hide records:

- **Shared-null** (`deal`, `task`, `pipeline`, `segment`, `automation`,
  `broadcast`): a null site means "tenant-wide, belongs to everyone," so a
  restricted member SEES those too — `OR [propertyId IN granted, propertyId IS
NULL]`.
- **Orphaned-null** (`order`, `booking`): a null site means the origin/service
  site was DELETED (SetNull), so it belongs to a now-gone business the member has
  no claim to — excluded — `propertyId IN granted` only.
- **No-null** (`billing document`): `propertyId` is required, so neither case
  applies — strict `IN granted`.

The helper is deliberately distinct from `resolveListScopeIds` (the
`?property=all` switcher flow): a management list is ALWAYS bounded by what the
member may reach, with no parameter that can widen it.

### Enforcement audit — "the column exists" is not "the leak is closed"

Late in the work a review of the busiest storefront read paths turned up several
places where the schema and service were per-site but the CALLER never passed the
site, so the scoping was inert exactly where it mattered most. These were found
and fixed:

- **Storefront reviews + Q&A** (`public/reviews.ts`) — list, submit, question
  list, question submit all called the site-scoped service with no site. The
  rating summary and the review list are now scoped together (closing the
  "average of 12 over a list of 3" discrepancy on the product page), and submits
  stamp where the content was written.
- **Wishlist** (`public/account.ts`) — find/create/read/delete keyed on
  `customerId` alone, so a shopper's two-site lists collided. Now scoped per site.
- **Checkout shipping quote** (`public/checkout.ts`) — `rateShipment` passed no
  site, so the zone scoping (§4) never filtered; a donut site's local-delivery
  rates could quote on a parts cart. Now passes `cart.propertyId`.
- **Scheduling emails** (`scheduling-classes`/`-notifications`/`-waitlist`) —
  booking confirmations, reminders, and waitlist offers sent with no site, so
  they went out under the tenant's PRIMARY sender identity rather than the
  business the booking belongs to — the §3.4 defect, reintroduced at the send
  site. Now pass the booking's (or service's) site.

Order-confirmation email was already correct (it passed the order's site). The
lesson is recorded here because it is the one most likely to recur: every
`propertyId` column added in this doc is only load-bearing if its READ and WRITE
call sites resolve and pass a site, and a green typecheck says nothing about
whether they do. When adding a scoped column, grep its service's callers.

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

**`Segment` / `SegmentMember` are done** (migration 20261231). Rated P2 but the
doc's own note is right that it is a LIVE INCONSISTENCY, not merely internal:
`customers` is already property-scoped and a segment FEEDS the property-scoped
`broadcasts`, so an unscoped segment sat between two scoped endpoints — a
"high-value customers" audience built from one business could feed the other's
marketing send, a customer-visible leak wearing an internal-model label. Segment
is nullable (a cross-business audience is real); the evaluator now matches a
customer only against segments of THEIR site plus tenant-wide ones;
`SegmentMember` inherits (no column). Built-in system segments (Newsletter
Subscribers, …) stay tenant-wide (`propertyId` null) — they span every business.

**`Pipeline` / `PipelineStage` / `Deal` are done** (migration 20270101). A
pipeline is one business's SALES PROCESS — the doc header's own "Fleet Contract
Renewals" — and the same three-way split as scheduling applies: `Pipeline` is the
authored process (Cascade, nullable), `PipelineStage` inherits (no column), and
`Deal` denormalizes its site from the pipeline at creation (SetNull — a deal is a
record that outlives its site, and re-scoping a pipeline can't rewrite past
deals). The default starter pipeline stays tenant-wide.

**`Task` is done** (migration 20270102). Its real value is completing the member
site-access story from §3.3: a member scoped to one business should see only that
business's task queue. The site is denormalized from the task's deal (or, failing
that, its customer) at creation; a task about neither is a general to-do and stays
null. SetNull — a task is a work record.

### The rest of §5 — a judgment call, not just remaining work

`CrmActivity`, `AuditLog`, `SavedView`, `UserFavorite`/`UserRecent`,
`Notification`, `ImportJob`/`ImportJobRow` remain, and they are genuinely lower
value than everything above — worth stating plainly rather than mechanically
scoping:

- **`CrmActivity` / `AuditLog` are append-only timeseries** (`CrmActivity` has a
  composite `[id, occurredAt]` PK). A denormalized site column carries real
  backfill cost on a large log, and the customer/deal-anchored views already
  filter correctly through their (now-scoped) parents — only the global feed
  mixes sites, which is an internal surface. The doc already marks `AuditLog`
  "optional."
- **`SavedView` / `UserFavorite` / `UserRecent` are per-USER state**, and whether
  a saved list-filter is per-site is a genuine product question, not an obvious
  yes — a user may want a view that spans their businesses.
- **`Notification` / `ImportJob` are operational** and low-traffic.

Recommendation: stop the mechanical sweep here. These should be scoped when a
concrete need appears (a per-site activity feed, a scoped import audit), each with
its own small decision, rather than adding columns that no read path yet filters
on — which is exactly the "shipping the column without the enforcement" trap §8
warns against. The high-value operational-layer defects are closed.

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

## 7. Decisions — RESOLVED 2026-07-20

Each call is recorded with the reasoning, because the reasoning is what a future
reader needs in order to know whether a changed circumstance should reopen it.
The test throughout is the one that settled this document: **would Bob's Parts
and Savory Donuts share this?** — never "is the underlying resource shared?",
which gave the wrong answer three times running.

1. **`TenantBrand` → per-site. OVERRIDES the written decision in
   `50-email.prisma:22`** ("email may never override the brand"). That rule was
   right about the thing it was aimed at — an email must not invent its own
   look — but it assumed one brand per tenant, and that assumption is what this
   document overturns. Two unrelated businesses cannot share a logo and palette,
   so the rule is preserved in its true form: **email may not override the SITE's
   brand.** `Property.brandOverride` already exists and is the migration path;
   the consolidation makes it the primary rather than an override.
2. **`CustomerUser` → stays tenant-wide login, per-site MEMBERSHIP.** The
   exception that proves the rule: a login is an identity, not a business
   relationship, and `Customer` (the CRM record) is already property-scoped, so
   the two-layer split is correct as built. What must NOT be inherited is
   entitlement — signing in must not by itself grant order history, saved
   addresses, or B2B pricing on a site the person never used. Confirmed
   deliberately, not by default; the sibling-site sign-in is a feature (one
   account across a family of brands) only because the entitlement stays scoped.
3. **`EmailSuppression` → split, as proposed.** `propertyId` null for
   `bounce`/`complaint`, set for `unsubscribe`. A hard bounce is a fact about an
   ADDRESS and belongs tenant-wide; an unsubscribe is a decision about a
   RELATIONSHIP. Opting out of donut marketing must never stop a parts order
   receipt — and continuing to mail an address that hard-bounced is how a sending
   domain's reputation dies, which is why that half stays global.
4. **`GiftCard` → per-site.** Money redeemable at a business the buyer has never
   heard of is a liability transfer nobody agreed to. Cross-site redemption is a
   real feature for a deliberate brand family, but it is opt-in, not the default.
5. **`B2BAccount` → per-site account, per-site credit.** `creditLimit` /
   `creditUsed` on a shared account means an order at one business consumes the
   other's exposure, and a credit hold at one silently blocks the other. A fleet
   customer buying from both gets two accounts; a genuine shared line is a later
   feature with an explicit parent-account model, not an accident of schema.
6. **`TaxExemption` → tenant-level. Genuinely.** Exemption is granted to a LEGAL
   SELLER, and both sites bill under one EIN (`TenantBusiness` holds the tax id).
   Making it per-site would ask a customer to re-file the same certificate for
   the same legal entity. If sites ever bill under separate entities, this moves
   with the entity — not with the site.
7. **`FeedbackSubmission` → tenant-level, unchanged.** It is platform feedback to
   WizeWorks from a staff user. Customer feedback ABOUT a business is a different
   model that does not exist yet, and if it lands it is site-scoped from birth.
8. **`MediaAsset` → tenant-wide library, per-site USAGE.** A shared library is
   genuinely useful (one logo pack, one photographer's shoot) and forcing a copy
   per site would be duplication with no meaning. The real risk is not storage,
   it is a donut photo appearing in a parts catalogue — which is a picker-scoping
   and search-defaults problem, not a storage-ownership one. Solve it where it
   actually bites.

### The pattern in these eight

Six of the eight are per-site, and the two that are not — tax exemption and
platform feedback — are alike in a way worth naming: **they are about the LEGAL
ENTITY or the PLATFORM, not about a business a customer deals with.** That is the
sharpest available restatement of this document's principle, and it is the test
to apply to the next model that comes up rather than re-deriving from scratch.

## 7b. Original framing (kept for context)

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
6. **Per-property rollups** (§6) — **DONE** (migration 20270105), unblocking
   [130](130-analytics-normalization.md) and the dashboards in
   [129](129-analytics-dashboards.md).

### Step 6 (rollups) — BUILT (migration 20270105_per_site_analytics_rollups)

The five daily rollups in `75-analytics-rollups.prisma` were keyed `(tenant, UTC
day)`. Per-site dashboards need a site dimension in that key, and the source rows
have NULLABLE `propertyId` (orders + dropship are SetNull — they outlive their
site), so on any tenant that ever deleted a site some revenue belongs to no
current site. The two decisions that made this a phase rather than a column-add,
resolved up front:

1. **Orphaned revenue → an explicit "unattributed" bucket, NOT folded into the
   primary.** Folding would attribute a closed business's numbers to the primary
   site — the exact distortion the §3.6 invoice work refused. A per-site read
   EXCLUDES the null bucket; the all-sites total INCLUDES it, so it is never lost,
   only never misattributed.
2. **Inventory valuation stays TENANT-ONLY.** Stock lives in warehouses (no
   `property_id`) and one physical pool serves every site a product is listed on;
   any per-site split would double-count or invent an allocation. It keeps the
   `(tenant, day)` grain — the one rollup §6 leaves alone.

The critical realization from grounding the decision in the schema: **the null
semantics are NOT uniform**, so a single rule would have been wrong.

| Rollup                     | Site source                                             | Grain       | Null bucket                                                           |
| -------------------------- | ------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| Commerce revenue           | `Order.property_id` (nullable)                          | per-site    | orphaned — per-site read EXCLUDES; all-sites includes                 |
| Invoicing collected/billed | `BillingDocument.property_id` (NOT NULL, Restrict)      | per-site    | **none** — site can't be deleted while billed; composite PK           |
| Dropship                   | storefront `Order` via `DropshipOrder.order` (nullable) | per-site    | orphaned — same as commerce                                           |
| Automation runs            | `AutomationRun.property_id` (nullable)                  | per-site    | **SHARED** — null = tenant-wide automation; per-site read INCLUDES it |
| Inventory valuation        | none (tenant stock pool)                                | tenant-only | N/A                                                                   |

Shape (mirrors `ProductReviewRollup` §4): the three nullable-property rollups get a
surrogate `id` PK + a `NULLS NOT DISTINCT` unique over `(tenant, property, day)`
(a nullable key component can't sit in a composite `@@id`); invoicing keeps a plain
composite PK on its non-null property; a `Property` FK is `onDelete: Cascade` (a
deleted site drops its rollup rows and the next reconcile re-buckets its orphaned
source rows into null — SetNull would instead collide onto the existing null row
under the unique). Each reconcile now groups `GROUP BY property_id, day` and stamps
the site; the shared read aggregate splits into a SCOPED read (one site, or all)
and a per-property reconcile pass; every `/reports/*` timeseries resolves the site
via `resolveListScope` (`?property=<id>` | `all` (member-gated) | active header)
and the read SUMS the per-site rollup rows back to the tenant total for the
all-sites case. `RollupSiteDaily` (traffic) already carried `property_id`, and was
the template the others followed.

The migration TRUNCATEs the four changed rollup tables (they are derived — the
nightly reconcile, which is also the backfill, repopulates with correct per-site
attribution, and the reads live-overlay "today" from source in the meantime). The
per-site logic is proven by `revenue-rollup-per-site.test.ts` (the exemplar: two
sites + an orphaned order, asserting each site sees only its own revenue and the
orphan surfaces only in the all-sites total). NOTE: that test and the four affected
packages' typecheck are GATED on applying 20270105 + regenerating the Prisma client
— the standard migration-as-file / client-regen handoff (the migration reaches
Cloud SQL only through the pipeline).

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
