# 128 — Session Attribution: joining traffic to money

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-07-20

## Purpose

This doc captures one decision so it does not get lost: **how a sale gets
attributed to the traffic that produced it, without adding any tracking
capability the platform does not already have.**

Scope is deliberately narrow. This is not the analytics product doc — the metric
model, dashboards and per-module templates are a separate piece of work. This
doc covers only the join key, because everything else can be built later and
this cannot: attribution is only possible for data captured _from the moment the
capture changes forward_. Every day this is not shipped is a day of traffic that
can never be attributed retroactively.

Related: [97-analytics-reporting-architecture.md](97-analytics-reporting-architecture.md)
§6 (event-capture pipeline), [08-site-builder-prd.md](08-site-builder-prd.md),
[packages/db/prisma/schema/76-site-analytics.prisma](../packages/db/prisma/schema/76-site-analytics.prisma).

---

## 1. The problem

Site analytics and commerce live in the same database, under the same tenant,
and **cannot currently be joined**.

`SiteAnalyticsEvent` identifies a visitor only by `visitorHash` — a salted hash
of `(UTC date + tenant + client IP + user-agent)`, computed server-side at
ingestion, never reversible to an IP, and **rotated at UTC midnight** so
cross-day tracking is impossible by construction. `sessionHash` is the same
thing with a 30-minute window folded in.

An `Order` row carries none of this. So the platform can report that a tenant
received 4,000 visits and that it took $12,000, and has no way to say whether
those facts are related.

This is the single most valuable question a tenant has — _"which of the things I
do actually makes money"_ — and it is the question a hosted commerce platform is
uniquely positioned to answer, because it owns both sides of the join. Answering
it currently requires a third-party tag manager and a weekend.

## 2. The constraint that does not move

The privacy model is why sparx sites need **no consent banner**. It is not
negotiable and this change must not weaken it:

- No cookies set, no PII stored.
- Visitor identity is a salted hash that is never reversible.
- Identity **rotates at UTC midnight** — no cross-day tracking exists.
- DNT and obvious bots are dropped at the edge before a row is written.

Any attribution design that requires a persistent visitor id, a cookie, a
device fingerprint, or cross-day identity is **rejected on arrival**. It would
convert a banner-free product into one that needs consent infrastructure in
every jurisdiction we operate in, which is a far larger cost than the feature is
worth.

## 3. The decision

**Attribute within the visitor-day, and persist only the derived attribution —
never the hash.**

At order creation, the server:

1. Recomputes `visitorHash` from the request it is already handling — same salt,
   same algorithm, same `(date + tenant + IP + user-agent)` inputs.
2. Looks up that visitor's **earliest event today** for the tenant/property.
3. Copies the _derived_ attribution onto the order: source class, referrer host,
   landing path.
4. **Discards the hash.** It is a lookup key, not a stored column.

Two properties make this acceptable where a cookie would not be:

- **It creates no new identity.** The hash already exists, is already computed
  on every pageview, and already expires at midnight. Attribution reads it; it
  does not extend it.
- **Nothing durable is linkable.** The order stores `"instagram.com"`, not a
  visitor. Two orders from the same person on the same day are not joinable
  after the fact, and were never joinable across days.

### Why visitor-day and not session

The obvious design is to stamp `sessionHash`. It is wrong: the session hash
folds in a 30-minute window, so a visitor who browses for 40 minutes and then
buys carries a _different_ session hash than the one on their landing hit. That
silently misattributes exactly the considered purchases that matter most — the
long browse is the high-intent one.

`visitorHash` is stable for the whole UTC day, which is the natural window: it
is already the longest identity the system holds, so using all of it costs
nothing extra and captures the realistic shopping journey.

### Why first touch, not last

Within a single day the first event is the one that **acquired** the visitor.
Last-touch inside a day mostly credits the tenant's own site for a visitor it
already had. Multi-touch attribution is explicitly out of scope — it requires
cross-day identity and is therefore permanently unavailable to us. That is a
deliberate trade, and the honest framing for the UI is _"where today's buyers
came from"_, not _"the customer journey"_.

## 4. Schema

Additive columns on `Order`, all nullable — an order with no matching traffic is
normal, not an error:

| Column                      | Type            | Meaning                                                                                                                                                          |
| --------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attribution_source`        | `varchar(20)`   | `search` \| `direct` \| `social` \| `referral` — same vocabulary as `SiteAnalyticsEvent.source`, so reports do not need a mapping table                          |
| `attribution_referrer_host` | `varchar(255)`  | e.g. `instagram.com`. Null for direct                                                                                                                            |
| `attribution_landing_path`  | `varchar(2048)` | The first path this visitor saw today                                                                                                                            |
| `attribution_resolved_at`   | `timestamptz`   | When attribution ran. Distinguishes "we looked and found nothing" from "we never looked" — without it, a backfill cannot tell which orders it still owes work to |

Tenant-scoped by virtue of living on `Order`; no new RLS surface.

**No hash column.** Storing `visitorHash` on a durable row would freeze an
identity that is otherwise designed to expire, which is precisely the property
that keeps this consent-free. If a future need for session-level analysis
appears, it gets argued on its own merits — not smuggled in here.

The same three columns generalise to any conversion worth attributing —
`Customer` (signup), and later a form submission or a booking. Name them
identically wherever they land.

## 5. Where attribution legitimately does not exist

These are normal and must render as _"not from web traffic"_, never as an error
or a zero that drags an average down:

- Orders created by staff in the dashboard or workbench.
- B2B orders placed through an account portal or a rep.
- Phone, POS, and manually-entered orders.
- Subscription renewals and recurring invoices — the renewal is not an
  acquisition and must not be credited to whatever the customer browsed that day.
- Visitors who sent DNT, or were classified as bots, and so were never captured.
- Any order placed on a **different day** to the visit that produced it. This is
  the real and permanent limitation of the design, and reporting must state it
  plainly rather than quietly under-reporting.

Reporting therefore always carries an **"unattributed"** bucket with an honest
label. A dashboard that shows only attributed revenue implies a precision the
data does not have.

## 6. Known risks to verify before building

1. **IP/UA continuity between browsing and checkout.** The whole mechanism rests
   on the checkout request producing the same hash inputs as the pageview
   beacon. Different origin, a proxy hop, an in-app browser handoff, or a
   server-side checkout call would break the recompute. **Verify with real
   traffic before committing to this design** — if continuity does not hold, the
   fallback is passing an opaque server-issued token through the checkout
   payload, which is more moving parts but not more tracking.
2. **Attribution must not be on the checkout hot path.** It is a lookup against
   an append-only table during order creation. If it is slow or fails, the order
   must still be placed — resolve asynchronously off an existing order event
   rather than inline, consistent with the platform's event-driven side-effect
   rule.
3. **Raw event retention bounds attribution.** Doc 97 §6 proposes dropping raw
   partitions after 30–90 days. Attribution must run before the events it reads
   are dropped. Since it resolves at order time this is not a live concern, but
   any **backfill** is bounded by retention and must say so.

## 7. Open questions

- Does attribution belong to the **order** or to the **customer's first order**?
  Crediting every repeat purchase to its own day's traffic overstates paid
  channels for customers who were acquired once and return directly.
  Recommendation: store per order, and report _acquisition_ separately using
  first-order-only.
- Should a **quote → invoice → paid** flow in the invoicing module carry
  attribution through from the quote? It is the same question as subscription
  renewals and probably has the same answer: attribute the acquisition, not the
  document.
- Is attribution exposed on the **order detail** surface, or only in aggregate?
  Per-order it is weak evidence; in aggregate it is the product.

## 8. Implementation checklist

- [ ] Verify hash-input continuity between the collect beacon and checkout (§6.1).
      **Nothing else starts until this is confirmed.**
- [ ] Migration: four additive nullable columns on `Order` (§4). Pipeline only —
      the Cloud SQL instance is private-IP, per [packages/db/CLAUDE.md](../packages/db/CLAUDE.md).
- [ ] Extract the visitor-hash computation into a shared helper so ingestion and
      attribution cannot drift. Two copies of a hash definition is one bug.
- [ ] Resolve attribution off the existing order event, not inline in the handler.
- [ ] Report: revenue and order count by `attribution_source`, with an explicit
      unattributed bucket.
- [ ] Backfill is **not possible** for orders placed before the columns exist.
      State this in the UI for the cutover window rather than showing a
      misleading empty chart.
