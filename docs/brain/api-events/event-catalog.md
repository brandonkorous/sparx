---
title: The event catalog
node: api-events
type: reference
status: active
sources:
  - wizeworks/packages/events/src/types.ts
---

The **single source of truth** for events is the `EventType` union in `wizeworks/packages/events/src/types.ts` — **topic name == event type**. Use the REAL names; several doc examples are wrong.

## ⚠️ Doc examples that don't exist

`order.created` and `customer.updated` (cited in both CLAUDE.md files) are **not real**. Real:

- **Orders:** `order.{placed, paid, fulfilled, delivered, cancelled, refunded, payment_failed}`.
- **Generic entity change** (reprojection / search): `search.entity.changed` — there is no `customer.updated`.
- **Domain verify:** `email.domain.verified`; **domain purchase:** `domain.purchased`.

**`subscription.*` is a TENANT'S OWN customers' commerce subscriptions.** The tenant's own sparx bill is `tenant.subscription.changed` (published by the Stripe **billing** webhook after reconciliation, consumed by `platform-crm-worker`, docs/140). Same word, different customer — reaching for `subscription.cancelled` to mean "a tenant churned" wires the wrong stream.

Real families (abbrev.): `tenant.{created,updated,subscription.changed}`, `module.{activated,deactivated}`, `content.entry.*`, `media.*`, `email.send`, `builder.{published,rolled_back}`, `site.updated`, `product`/`variant.*`, `price.recomputed`, `inventory.*`, `cart`/`checkout.*`, `order.*`, `payment.*`, `subscription.*`, `return.*`, `review.*`, `b2b.*`, `booking.*`, `dropship.*`, `partner.*`, `bootcamp.*`, `chat.message.received`, `push.send`, `import.job.created`, `feedback.*`. Shared payload contracts live in `types.ts`.

## A consumer can exist with no publisher, and it is silent

`builder.{published,rolled_back}` were added in 2026-07 to close exactly that gap. `cache-revalidation-worker` had a `builder.` branch mapping onto the `builder:<slug>` tag, and every storefront page/layout/frame/style read already carried the tag — but **nothing ever emitted the event**, so the branch was dead code and the tag was never purged. Nothing failed, because all 19 storefront routes are `force-dynamic` and nothing is cached.

That is the shape to watch for: a purge path is only exercised once caching is switched on, so a missing publisher looks perfectly healthy right up until it silently serves a stale page — or, worse, keeps serving the broken page a **rollback** was performed to remove.

## `site.updated`: a save that changes the website without a publish

A site's name, social links, contact details, brand and logo, cookie banner, shop display settings, which site is the primary, the payment method and the footer's legal links are all LIVE the moment the owner saves, and the website serves each of them out of a cached read (the business payload from `/v1/public/tenants/:slug` is held 300 s). `site.updated` (`SiteUpdatedPayload { propertyId | null, changed[] }`) is what those saves publish, from `publishSiteUpdated` in `wizeworks/services/api-rest/src/lib/site-events.ts`: `PATCH /v1/tenant/consent`, `PATCH`/`DELETE /v1/properties/:id` and `make-primary`, `PATCH /v1/brand`, `PATCH /v1/commerce/site/{settings,theme}`, the saved-theme apply and logo/favicon settings in `/v1/sitebuilder/*`, the legal-placement routes, a blueprint update or uninstall, a payments preset install, and (from `lib/payments-onboarding.ts`, only when the gateway or its active flag actually moved) payment setup. `PATCH /v1/tenant` keeps publishing `tenant.updated`.

Its one consumer is the event worker's **cache-revalidation** handler, which maps it to EVERY scope (the values sit under both `tenant:` and `content:`). It is deliberately NOT `tenant.updated`: `platform-crm-worker` re-mirrors the tenant into sparx's own CRM on every one of those, and a cookie banner is not a fact about the customer relationship.

Before 2026-10-01 none of these saves published anything and the handler ran nowhere (it was an undeployed Cloud Run service), so every one waited out the cache: a banner save measured 68 s (sparx persona issue 040).

## A new customer is announced, however they arrived

The CRM bus (`CrmTopic` in `wizeworks/packages/crm/src/events.ts`) carries three arrival words, and every path that writes a `customers` row must say one of them, through `customerService.announceCustomer`, which hands it to `afterCommit` so it goes out once the outermost transaction commits and never for one that rolled back:

| Event | Means | Who says it |
| --- | --- | --- |
| `crm.customer.created` | They made an account, or somebody on the team typed them in. "Welcome new customers" answers this one. | `customerService.create` (console, MCP, GraphQL, CSV import, automations); website sign-up and a first sign-in on a sister site (`ensureAnnouncedMembership` in api-rest `lib/customer-session.ts`) |
| `crm.customer.captured` | They handed details over by themselves and joined nothing. | `customerService.captureLead` (site forms, bootcamp RSVPs, sparx's own CRM mirror); a booking (`routes/v1/public/scheduling.ts`); a guest checkout (`ensureCheckoutCustomer`); a marketplace order (`ensureChannelCustomer`) |
| `crm.customer.subscribed` | A newsletter opt-in, new or returning. | `customerService.subscribe` |

An existing row that is adopted or filled in (a guest who makes an account, a form that adds a phone number, a site-less row moved onto a site) says `crm.customer.updated`.

The search worker (`commerce-indexer`), the group and score evaluators and the automation hydrator all take every arrival word. Bulk writers that announce nothing row by row ask for a rebuild instead: loading or clearing sample data publishes `search.reindex.requested` (a clear with `dropStale`). The dev seed (`prisma/seed.ts`) announces nothing; the search box's "Put them back" rebuild covers it.

Before 2026-10-03 only `customerService.create` announced anything. A buyer who signed up on a business's website was in the customer list and missing from the console's search box, `captured` existed only as an activity-feed line, and `subscribed` reached no indexer (sparx persona issue 086).

The search box's own gap count (`GET /v1/search/status`) compares customers by when they came into being (`created_at` in the index, `createdAt` in the database, live rows only) and orders by `placed_at`, over a 60-second wait. It used to compare rows not EDITED in five minutes against every indexed document, which let one recent edit hide one missing customer.

**How to apply:** publishing? Pick the exact `EventType` literal — grep `types.ts`, never trust a doc's example name. Adding a consumer branch? Check a publisher exists in the same change, or write down that it does not.

Related: [[event-driven]], [[email-pipeline]], [[claude-md-drifted]]
