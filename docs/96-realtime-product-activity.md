# Sparx Platform — Realtime Product Activity Channel

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-14

---

## 1. Overview

A **per-product realtime channel** that pushes live "activity" to shoppers currently viewing a product detail page (PDP): _someone just purchased this_, a _new review landed_, a _question was answered_, _stock is running low_, _N people are viewing_. One channel, several event types, all scoped to a single product.

The headline use case is the **purchase toast** — while you're looking at the demo widget, if someone else buys it, a toast slides in: "Someone just purchased this." This is social proof / urgency, and it's the reason we stand up the channel. Once the channel exists, live reviews and Q&A ride it for almost nothing.

**This is an enhancement layer, never load-bearing.** The PDP is server-rendered and SSR-first (docs/18, docs/46). Reviews, Q&A, price, and stock all render correctly with no socket connection at all — the realtime channel only makes an _already-correct_ page feel alive for connected viewers. A shopper with JS off, a crawler, or a client that hasn't connected yet sees the cache-accurate SSR page. See §3.

**Module:** rides on `commerce` activation; per-tenant toggles per activity type (§9). No new paid module.

---

## 2. Why Build It

- **Conversion.** "Someone just bought this" and "12 people are viewing" are among the highest-leverage social-proof signals on a PDP. We can deliver them first-party, anonymized, and on-brand — no third-party script, no PII leaving the tenant.
- **It's nearly free once built.** We already run a socket.io server with a Redis adapter for Live Chat (docs/56). A second namespace + per-product rooms is incremental. Reviews/Q&A live-updates are just more event types on the same pipe.
- **Consistency with the cache layer.** We just wired publish/approve events to bust the storefront cache (review.published, question.published, question.answered → commerce scope). That makes the _next load_ fresh. This channel makes the _current_ tab update without a reload — the two layers compose (§3).

---

## 3. Relationship to the SSR + cache-bust layer

There are now three layers of "freshness," each a strict fallback for the one above it:

| Layer                        | Mechanism                                                                                   | Who it serves                                    | Latency               |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------- |
| **SSR render**               | Server component fetches at request time (`next: { revalidate: 60, tags }`)                 | Everyone, every load                             | request time          |
| **Cache bust**               | Domain event → `cache-revalidation-worker` → `POST /api/revalidate` busts `commerce:<slug>` | The _next_ navigation/load                       | seconds after publish |
| **Realtime push** (this doc) | Domain event → fanout → socket room → open tab updates in place                             | Connected viewers of that product, **right now** | sub-second            |

The realtime layer **must not** be required for correctness. If the socket never connects, the cache-bust layer guarantees the next load is right. Treat realtime as "the page you're staring at animates"; treat cache-bust as "the page is correct when you load it."

---

## 4. Architecture

```
 order.paid / review.published / question.* / inventory.low
        │  (Google Pub/Sub — @sparx/events)
        ▼
 activity-fanout-worker            (Cloud Run, Pub/Sub push — new)
   • resolve event → affected productId(s)
   • build an anonymized ActivityEvent (§7)
   • apply per-tenant toggles + rate limit (§8, §9)
        │  POST /internal/activity   (shared secret, like the revalidate secret)
        ▼
 api-rest  ──  socket.io "/ws/activity" namespace
   • broadcast to room  product:<tenantId>:<productId>
   • Redis adapter fans out across all api-rest replicas
        │  (socket.io)
        ▼
 storefront PDP client
   • toast for purchase / low-stock
   • prepend new review card / insert answered Q&A in place
```

Two reuse decisions, both deliberate:

1. **Same socket.io server, new namespace.** The Live Chat server is already attached to the Fastify HTTP server at `/ws/chat` with the Redis adapter when `REDIS_URL` is set (`services/api-rest/src/index.ts`, `websocket/chat-namespace.ts`). We add a sibling **`/ws/activity`** namespace on the same `io` instance — separate auth, separate rooms, shared transport + adapter. We do **not** overload the chat namespace (different auth model, different blast radius).
2. **Event → side-effect via a Cloud Run worker + internal HTTP**, mirroring `cache-revalidation-worker`. api-rest stays a request/response service; the worker owns the Pub/Sub subscription and POSTs to an internal broadcast endpoint. Any replica that receives the POST broadcasts through the Redis adapter, so all subscribers across pods get it. (Respects the service-boundary rule — api-rest doesn't grow a Pub/Sub consumer; cf. docs/02, services/CLAUDE.md.)

We keep the **broadcaster-getter** decoupling pattern from chat (`getChatBroadcaster()`): the internal route calls `getActivityBroadcaster()?.emit(...)`, the websocket layer installs the real implementation at boot, and it's a no-op in tests.

---

## 5. Channel, rooms, and scoping

- **Namespace:** `/ws/activity`.
- **Room:** `product:<tenantId>:<productId>`. Tenant id is in the key so a productId collision across tenants can never cross-leak (defense in depth on top of resolving productId within the authenticated tenant).
- **Subscription model:** a client joins exactly one product room (the PDP it's on). Joining N products (a PLP) is out of scope for Phase 1 — PLPs don't need live activity.
- **Read-only:** clients **receive** `ActivityEvent`s and **cannot emit** them. The only client→server messages are `subscribe` / `unsubscribe` (and an internal `ping` for liveness). Activity originates solely from the trusted fanout worker.

---

## 6. Auth & handshake

Storefront viewers are anonymous shoppers — there is no chat token and no login. The data we broadcast is **already public or anonymized** (a published review, an answered question, "someone bought this" with no identity). So the subscription bar is "does this product exist and is it sellable on this site," not "who are you."

Handshake: `{ tenant: <slug>, productId: <uuid> }`.

Server validates, on join:

1. Resolve `tenant` slug → tenantId (reject unknown / placeholder tenant).
2. `isModuleEnabled(tenantId, 'commerce')` — else reject.
3. Product exists, `status = active`, not soft-deleted, and visible on the resolved site (respects `commerce_product_properties` site scoping, docs/49).
4. Rate-limit handshakes per IP (§8).

On success the socket joins `product:<tenantId>:<productId>` and receives a `hello` with the current viewer count (§10) and nothing else (no backfill — activity is ephemeral, §7).

---

## 7. Wire protocol

Events are small, typed, and **ephemeral** — there is no history, no store, no replay. A late joiner sees only what happens after it joins (plus the live viewer count).

```ts
type ActivityEvent =
  | {
      kind: 'purchase';
      productId: string;
      at: string;
      region?: string;
      qty: 'one' | 'few' | 'many';
    }
  | {
      kind: 'review';
      productId: string;
      at: string;
      review: { id: string; rating: number; author: string | null; title: string; excerpt: string };
    }
  | {
      kind: 'qa';
      productId: string;
      at: string;
      question: { id: string; excerpt: string; answered: boolean };
    }
  | { kind: 'stock'; productId: string; at: string; level: 'low' | 'out'; available?: number }
  | { kind: 'viewers'; productId: string; count: number }; // bucketed, see §10
```

Source-event → `ActivityEvent` mapping (owned by the fanout worker):

| Domain event (@sparx/events)               | Activity   | Notes                                                                                                                             |
| ------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `order.paid`                               | `purchase` | Canonical "money received." Resolve order → line items → productIds; one event per distinct product. `qty` bucketed, never exact. |
| `review.published`                         | `review`   | Reuses the public review shape (author = displayName, excerpt = first ~140 chars).                                                |
| `question.published` / `question.answered` | `qa`       | `answered` reflects whether an official answer exists.                                                                            |
| `inventory.low` / `inventory.depleted`     | `stock`    | Phase 3. Only when the tenant shows stock counts.                                                                                 |

`purchase` deliberately carries **no order id, no customer, no exact quantity, no city** — see §8.

---

## 8. Privacy, anonymization & abuse

This is the part that has to be right, because purchase activity is derived from real orders.

- **No PII, ever.** A `purchase` event is `{ region?, qty }`. `region` is **state/province-level only**, derived from the order's shipping region, and is **opt-in** per tenant (default: off → "Someone just purchased this", no place). Never name, email, city, order id, or exact count.
- **Quantity is bucketed:** `one` (1), `few` (2–4), `many` (5+). Prevents "someone bought 37 of these" fingerprinting.
- **Debounce + coalesce per product:** at most one `purchase` toast per product per **30s** (configurable); a burst coalesces into one ("Several people just purchased this" when ≥3 in the window). Stops a flash sale from machine-gunning toasts.
- **Read-only sockets** (§5) — a client cannot forge activity.
- **Handshake rate-limit:** per-IP cap on connections + joins; idle sockets timed out. The internal broadcast endpoint is shared-secret (`SPARX_ACTIVITY_SECRET`), same posture as `SPARX_REVALIDATE_SECRET`.
- **Honesty:** we only ever emit events for things that actually happened. No synthetic / "fake it" purchase toasts — that's a dark pattern and a trust risk. (If a tenant ever wants "recent sales" seeding, it must be real historical orders, clearly framed, and is a separate decision.)

---

## 9. Tenant settings & gating

Live activity is a storefront display choice; some tenants (B2B distributors, somber brands) won't want purchase theater. A per-site setting:

```ts
liveActivity: {
  purchases: boolean; // default false — opt-in, it's the loudest
  purchasesRegion: boolean; // default false — show state/province
  reviews: boolean; // default true — low-key, high-trust
  qa: boolean; // default true
  stock: boolean; // default false — only if stock counts are shown
  viewers: boolean; // default false
}
```

Stored on the site/property settings (per-site, docs/49). The fanout worker reads it and drops events the tenant has disabled **before** broadcasting (so disabled types never hit the wire). Authored in the dashboard under Storefront → Settings.

---

## 10. Viewer presence ("N people viewing") — Phase 3

The socket room size _is_ the viewer count (via the Redis adapter's room cardinality). On join/leave we recompute and broadcast a **bucketed** `viewers` count:

- Buckets: hide `< 3`; then `3`, `5`, `10`, `25`, `50`, `100+` (round down to the nearest bucket). Bucketing avoids "you are the only person here" and resists headcount fingerprinting.
- Debounced (max one `viewers` update / 5s / product).
- Privacy-safe by construction: a count, never identities.

---

## 11. Client integration (storefront)

- A small client module (`@sparx/site-ui` activity client, or a `apps/site` hook `useProductActivity(productId)`) connects on PDP mount, joins the room, and exposes an event stream; disconnects on unmount; reconnects with backoff; gives up quietly after N attempts (fallback = static page).
- **Purchase / stock** → a toast (reuse the storefront toast surface), respecting `prefers-reduced-motion` (no slide, just appear), auto-dismiss, capped to one visible at a time.
- **Review** → the reviews section (already SSR-rendered, docs: just shipped) prepends the new card and bumps the ★ summary. The section becomes hydration-aware: SSR list + client-appended live items, deduped by id.
- **Q&A** → likewise inserts/updates the answered question in place.
- Everything is additive over the server-rendered DOM; first paint and SEO are unchanged.

---

## 12. Scaling & cost

- **Transport already provisioned.** socket.io + Redis adapter exist for chat. Phase-1 infra runs Redis in a GKE pod, not Memorystore (docs/03 §3) — fine for this; per-product rooms are cheap (membership sets in Redis). Revisit only at the same scale trigger chat does.
- **Fan-out cost** is O(subscribers) per event, handled by the adapter across pods. Purchase events are low-frequency and debounced; review/Q&A are rare; presence is bucketed + debounced. No hot loops.
- **Connection budget:** idle timeout + per-IP cap keep socket counts bounded. A product with no viewers has an empty room and costs nothing.
- The `activity-fanout-worker` is a thin Cloud Run consumer (cf. `cache-revalidation-worker`), scales to zero.

---

## 13. Security review checklist

- [ ] Sockets are receive-only; no client can emit activity.
- [ ] `purchase` payloads contain no PII and bucketed quantity; region opt-in + state-level.
- [ ] Internal broadcast endpoint is shared-secret; not reachable publicly.
- [ ] Room key is tenant-scoped (`product:<tenantId>:<productId>`); productId resolved within the authenticated tenant.
- [ ] Per-IP handshake/join rate limits; idle timeout.
- [ ] Tenant toggles applied at the worker, before the wire.
- [ ] No synthetic activity — events reflect real domain events only.

---

## 14. Phasing

**Phase 1 — Purchase toast (the headline).**
`/ws/activity` namespace + `product:<tenantId>:<productId>` room + handshake auth + `getActivityBroadcaster()` + internal `POST /internal/activity` (shared secret). New `activity-fanout-worker` consuming `order.paid` → anonymized `purchase` event → broadcast. Storefront PDP toast. Tenant `liveActivity.purchases` toggle (default off).

**Phase 2 — Live reviews & Q&A.**
Fanout `review.published` / `question.published` / `question.answered` → `review` / `qa` events. Reviews/Q&A sections subscribe and live-insert. (These events already exist on the bus as of the reviews/Q&A work — Phase 2 is "map + broadcast + client-merge," no new domain events.)

**Phase 3 — Presence & stock.**
Bucketed `viewers` count from room cardinality; `stock` toasts from `inventory.low` for tenants showing stock counts.

---

## 15. Open questions

1. **Order → productIds resolution.** Does `order.paid`'s payload carry line-item productIds, or does the worker read the order? Prefer enriching the event so the worker stays storage-light; otherwise the worker does one tenant-scoped read. (Decide when wiring Phase 1.)
2. **`@sparx/site-ui` vs `apps/site` for the client.** A reusable activity client in `@sparx/site-ui` lets the Builder render path and the legacy PDP share it; an `apps/site` hook is simpler to start. Lean shared once Phase 2 needs both reviews + Q&A to merge live.
3. **B2B suppression.** Should purchase toasts auto-suppress on B2B/wholesale contexts regardless of toggle? Likely yes (wholesale buyers don't want consumer theater) — gate on the active sales channel, not just the tenant toggle.
4. **Region source for guest/digital orders** with no shipping address — fall back to "no region" (the default), never to IP geolocation (PII / consent surface).
