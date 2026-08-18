# sparx Platform — Event Bus Unification & Automation Fan-In

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-10

---

## 1. Why this doc exists

The automation engine ([docs/81](81-automation-module.md)) cannot be built until the event substrate is coherent. Today sparx publishes events through **three separate paths** with **two divergent `EventType` definitions**, and there is no single topic an engine can subscribe to in order to see "every event." This is the Phase-0 blocker for docs/81.

It is also worth doing on its own merits: a unified registry + a single fan-in hardens the bus for _every_ consumer (the search indexer, outbound webhooks, the email/push workers), and removes a class of "publisher in path A can't name an event path B knows" bugs.

Scope: the event **registry** (the typed vocabulary), the **publish paths**, and the new **fan-in** topic. It does _not_ change business logic or per-module event semantics.

---

## 2. Current state — the fragmentation

Three publish paths:

| #   | Path                                                                                          | What it does                                                                                               | `EventType` source                                                                                          | Used by                                                  |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | [`wizeworks/packages/api-core/src/pubsub.ts`](../packages/api-core/src/pubsub.ts) `publish()` | Enqueues outbound webhook deliveries **and** publishes to per-type Pub/Sub topic                           | its **own** local `EventType` union (L22-71)                                                                | api-rest route handlers                                  |
| 2   | [`wizeworks/packages/events/`](../packages/events/src/publisher.ts) `publisher.ts`            | Per-type Pub/Sub publish only                                                                              | [`wizeworks/packages/events/src/types.ts`](../packages/events/src/types.ts) — a **different, larger** union | standalone Cloud Run workers (e.g. `b2b-overdue-worker`) |
| 3   | [`wizeworks/packages/crm/src/pubsub-bridge.ts`](../packages/crm/src/pubsub-bridge.ts)         | Tees CRM's two in-process buses (CRM bus `crm.*` + platform bus `order.*`) to real Pub/Sub for the indexer | CRM's own `CrmEvent` / `PlatformEvent` types                                                                | commerce-indexer (Pub/Sub push)                          |

The two unions have **drifted**: `api-core`'s is missing `order.paid`, `cart.*`, `inventory.low`, and the entire `b2b.*` set that `@wizeworks/events` carries. The envelope is consistent across paths (`SparxEvent<T> = { type, tenantId, actorId, occurredAt, data }`; topic name == event type), which is the one thing that makes consolidation tractable.

Consequences that block docs/81:

- **No authoritative "all events" list.** The automation trigger catalog (docs/81 §5.2) has nothing single to read; some triggers it lists aren't in either union.
- **No single subscribe point.** Per-type topics + no wildcard means an engine that wants "everything" would need N subscriptions.
- **Drift risk between code and infra.** Each event needs a Terraform topic; nothing asserts the union and the provisioned topics agree.

---

## 3. Target state

### 3.1 One canonical registry

`@wizeworks/events` becomes the **single source of truth** for `EventType` and shared payload contracts:

- Consolidate both unions into one **superset** there.
- `api-core` deletes its local `EventType` and re-exports / depends on `@wizeworks/events`. (Runtime is unchanged — topics are named by string today; this is a type-level unification.)
- CRM's `crm.*` vocabulary is represented in the canonical union (namespaced, not flattened) so the whole event surface is enumerable in one place.

> **Footgun:** any service that newly depends on `@wizeworks/events` needs the `COPY` lines in its Dockerfile + the transitive closure (the package-wiring footgun). Most backends already install it; verify per service.

### 3.2 Publish paths stay layered, registry shared

The three paths exist for real reasons (webhook-enqueue lives with `api-core`'s `publish`; workers can't pull the webhook stack; CRM's two-bus semantics are load-bearing). Keep them — but they all import the **one** registry. No path invents its own event names.

### 3.3 The fan-in topic

Add **one** topic — `automation.trigger` — that every publish path tees a copy into, after its normal per-type publish, carrying the original type as a message attribute:

```
publish(order.paid) ──► topic "order.paid"        (existing per-type consumers: indexer, webhooks)
                   └──► topic "automation.trigger" attributes={ type: "order.paid", tenantId } (NEW)
```

The `automation-worker` is the **sole** subscriber (Cloud Run push). This is modeled directly on the existing tee in `pubsub-bridge.ts`, which already wraps a publisher and tees each event to a second topic.

**Decision — tee, not per-type subscriptions, not a wildcard.** A wildcard subscription doesn't exist (per-topic bus). N per-type subscriptions are operationally heavy and must be edited every time an event is added. One fan-in topic + one subscription is cheap and additive; per-type topics remain for targeted consumers. Trade-off: the fan-in carries _all_ events — fine for a single push consumer that filters by active automations and ignores the rest.

> **CRM two-bus caveat:** the tee must sit where **both** `crm.*` and platform `order.*` events pass, or be installed on both bridge wrappers — otherwise `crm.*` events silently never reach automations. This is the known two-bus footgun; treat it as a test case.

### 3.4 Envelope + loop-guard field

The fan-in message is the same `SparxEvent<T>` envelope plus `{ type, tenantId }` attributes. It also carries `__automationDepth` (default 0) so the engine's loop-guard (docs/81 §7) can refuse runaway cascades.

---

## 4. New events to add (launch trigger set)

The docs/81 §5.2 **`[ADD]`** triggers, promoted to the canonical registry + provisioned topics + emitted at source:

| Event                                                   | Source today → change                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `email.opened` / `clicked` / `bounced` / `unsubscribed` | Arrive via the Mailgun webhook into `email-platform` — **promote onto the bus** |
| `form.submitted`                                        | CMS form handler — emit on submit                                               |
| `site.published` / `site.unpublished`                   | Builder publish flow — emit on publish/unpublish                                |
| `domain.verified`                                       | Generic verification (distinct from existing `domain.purchased`)                |
| `crm.deal.stage_changed` (+ won / lost)                 | Promote from the generic `crm.deal.updated`                                     |
| `module.activated` / `module.deactivated`               | Consumed in CRM today — make first-class bus topics                             |
| `webhook.received`                                      | New inbound-webhook endpoint (docs/81 §10)                                      |
| `product.published` / `unpublished`                     | Only `product.created/updated/deleted` exist — add publish state                |

Each: add literal to canonical `EventType` → provision per-type topic + fan-in is automatic (tee) → emit at the source.

---

## 5. Migration plan (expand → contract, no big bang)

Each step is independently shippable and reversible; the tee is additive, so existing consumers are unaffected throughout.

1. **Expand:** add the canonical superset registry to `@wizeworks/events`.
2. **Point:** `api-core` re-exports the canonical `EventType`; fix any resulting type mismatches. No runtime change.
3. **Provision:** add the `automation.trigger` topic + push subscription (Terraform `for_each` addition).
4. **Tee:** install the fan-in tee in all three publish paths (api-core `publish`, `@wizeworks/events` publisher, CRM bridge).
5. **Grow:** add the `[ADD]` events incrementally, as each trigger is actually needed by docs/81.
6. **Contract:** delete `api-core`'s local `EventType` union once nothing references it.

Steps 1–4 unblock docs/81 Phase 1; steps 5–6 run alongside docs/81 build.

---

## 6. Risks / footguns

- **Topic ↔ union drift.** Every canonical event needs a provisioned topic. Add a **parity test** asserting `EventType` members and provisioned topics agree (or generate the Terraform `locals` topic list from the union). Without it, a publisher can name a topic that doesn't exist.
- **Double delivery.** Every event now lands on its per-type topic **and** the fan-in. Consumers must be idempotent; the automation engine already dedupes on `(automation_id, dedupe_key)` (docs/81 §7).
- **No ordering.** Pub/Sub is unordered. Automations must not assume event sequence — the engine hydrates current entity state (docs/81 §5.3) rather than trusting payload order.
- **CRM two-bus.** As §3.3 notes — install/verify the tee on both CRM bus wrappers, or `crm.*` triggers silently disappear.
- **Dockerfile wiring.** Any service newly depending on `@wizeworks/events` needs the `COPY` lines + transitive closure, or the image build fails (lint/tsc won't catch it).
- **Fan-in volume / cost.** The firehose carries all events. One subscription keeps it cheap; watch egress, but acceptable for Phase 1 (revisit only on a stated scale trigger).

---

## 7. Checklist

- [ ] Canonical `EventType` + shared payloads consolidated in `@wizeworks/events` (superset of both unions)
- [ ] `api-core` re-exports canonical; local union deleted (contract step)
- [ ] `crm.*` vocabulary represented in the canonical registry
- [ ] `automation.trigger` topic + push subscription provisioned (Terraform)
- [ ] Fan-in tee installed in api-core `publish`, `@wizeworks/events` publisher, CRM `pubsub-bridge` (both bus wrappers)
- [ ] `EventType` ↔ Terraform-topic parity test
- [ ] `[ADD]` events emitted at source + topics provisioned (incremental, per docs/81 need)
- [ ] End-to-end: an event reaches `automation.trigger` and the engine dedupes a redelivery
