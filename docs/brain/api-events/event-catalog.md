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

Real families (abbrev.): `tenant.created`, `module.{activated,deactivated}`, `content.entry.*`, `media.*`, `email.send`, `product`/`variant.*`, `price.recomputed`, `inventory.*`, `cart`/`checkout.*`, `order.*`, `payment.*`, `subscription.*`, `return.*`, `review.*`, `b2b.*`, `booking.*`, `dropship.*`, `partner.*`, `bootcamp.*`, `chat.message.received`, `push.send`, `import.job.created`, `feedback.*`. Shared payload contracts live in `types.ts`.

**How to apply:** publishing? Pick the exact `EventType` literal — grep `types.ts`, never trust a doc's example name.

Related: [[event-driven]], [[email-pipeline]], [[claude-md-drifted]]
