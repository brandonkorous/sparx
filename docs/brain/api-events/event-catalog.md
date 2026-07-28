---
title: The event catalog
node: api-events
type: reference
status: active
sources:
  - packages/events/src/types.ts
---

The **single source of truth** for events is the `EventType` union in `packages/events/src/types.ts` — **topic name == event type**. Use the REAL names; several doc examples are wrong.

## ⚠️ Doc examples that don't exist

`order.created` and `customer.updated` (cited in both CLAUDE.md files) are **not real**. Real:

- **Orders:** `order.{placed, paid, fulfilled, delivered, cancelled, refunded, payment_failed}`.
- **Generic entity change** (reprojection / search): `search.entity.changed` — there is no `customer.updated`.
- **Domain verify:** `email.domain.verified`; **domain purchase:** `domain.purchased`.

Real families (abbrev.): `tenant.created`, `module.{activated,deactivated}`, `content.entry.*`, `media.*`, `email.send`, `builder.{published,rolled_back}`, `product`/`variant.*`, `price.recomputed`, `inventory.*`, `cart`/`checkout.*`, `order.*`, `payment.*`, `subscription.*`, `return.*`, `review.*`, `b2b.*`, `booking.*`, `dropship.*`, `partner.*`, `bootcamp.*`, `chat.message.received`, `push.send`, `import.job.created`, `feedback.*`. Shared payload contracts live in `types.ts`.

## A consumer can exist with no publisher, and it is silent

`builder.{published,rolled_back}` were added in 2026-07 to close exactly that gap. `cache-revalidation-worker` had a `builder.` branch mapping onto the `builder:<slug>` tag, and every storefront page/layout/frame/style read already carried the tag — but **nothing ever emitted the event**, so the branch was dead code and the tag was never purged. Nothing failed, because all 19 storefront routes are `force-dynamic` and nothing is cached.

That is the shape to watch for: a purge path is only exercised once caching is switched on, so a missing publisher looks perfectly healthy right up until it silently serves a stale page — or, worse, keeps serving the broken page a **rollback** was performed to remove.

**How to apply:** publishing? Pick the exact `EventType` literal — grep `types.ts`, never trust a doc's example name. Adding a consumer branch? Check a publisher exists in the same change, or write down that it does not.

Related: [[event-driven]], [[email-pipeline]], [[claude-md-drifted]]
