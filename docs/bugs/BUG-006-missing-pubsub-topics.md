# BUG-006 — Half the event catalog had no Pub/Sub topic, so every publish silently failed

Status: **✅ FIXED — APPLIED + VERIFIED IN PRODUCTION 2026-07-24**
Severity: High — no user-visible break, but every downstream consumer of ~half the
platform's events received nothing
Found: 2026-07-24, production payments E2E (seen on a real paid order)
Surface: `terraform/envs/prod/main.tf` (`module.pubsub` → `topics`)

## Symptom

Placing a real order logged, from api-rest:

```
pubsub: publish failed … "5 NOT_FOUND: Resource not found (resource=payment.captured)."
pubsub: publish failed … "Resource not found (resource=checkout.completed)."
```

The order still completed and was marked paid — publishes are best-effort and the failure
is caught + logged — which is exactly why this went unnoticed. The money moved; the
events did not.

## Root cause

The terraform `topics` map had drifted from the `EventType` union in
`packages/events/src/types.ts`. Diffing the deployed topics against the code catalog:

- **134** event types declared in code
- **83** topics provisioned
- **66** declared types with **no topic at all**

Missing families included the whole commerce funnel (`checkout.started/completed/expired`,
`cart.created/updated/recovered`), payments (`payment.captured`, `payment.failed`,
`order.payment_failed`), and every event for bookings, B2B, returns, reviews,
subscriptions, gift cards, store credit, inventory transfers/counts, providers, template
installs, imports, and chat.

This is the **third** recurrence of the same class — the file already documents
`order.placed` (2026-07-12: "the topic itself was never provisioned, so every
`order.placed` publish silently failed in production") and the dropship family before it.
Nothing keeps the map and the union in lockstep.

## Fix

All 66 missing types added to the `topics` map as topic-only (`= []`), grouped by domain
with a comment recording this recurrence.

Cost is nil: a Pub/Sub **topic** costs nothing to exist — only **subscriptions** carry
retention cost, and every entry added here has an empty subscriber list. A subscriber
gets added to a list when its worker actually ships.

## Second catalog found on apply (2026-07-24)

Right after the 66-topic apply, a live order still logged
`crm-pubsub: publish failed … resource=crm.pipeline.created`. Cause: there are
**two** parallel event catalogs, and the first fix only closed one of them:

- `EventType` in `packages/events/src/types.ts` — 134 names (the 66-topic fix)
- **`CrmTopic` in `packages/crm/src/events.ts`** — 31 names, its own bus
  (`crm-pubsub`) bridged to the same Pub/Sub project. Only the 4 `crm.customer.*`
  topics had ever been provisioned; the other **22** (`crm.pipeline.*`,
  `crm.deal.*`, `crm.task.*`, `crm.segment.*`, `crm.activity.recorded`,
  `crm.b2b_account.*`, `crm.customer.subscribed`, `crm.billing_document.converted`)
  had no topic.

All 22 added to the terraform `topics` map (topic-only, `= []`) and applied.
Final state: **171 topics, 0 declared-but-unprovisioned** across BOTH unions.

## Verify after apply

- `gcloud pubsub topics list` returns every name from both unions (171 total).
- Place an order + refund it → no `pubsub: publish failed` / `crm-pubsub: publish
  failed` lines in api-rest logs. **Confirmed 2026-07-24**: publish-failure count
  dropped to 0 after both applies; the workbench activity feed shows live
  "Checkout completed" entries (proof a previously-dead topic now flows).

## Recurrence guard — added 2026-07-24

`scripts/check-event-topics.mjs` (run via `pnpm check:events`, wired as the
**Event ↔ topic parity** CI job in `.github/workflows/ci.yml`) now fails the
build when any event declared in code has no topic in terraform. It unions BOTH
catalogs — `EventType` (`packages/events`) AND `CrmTopic` (`packages/crm`) — so
it catches exactly the gap that this session's first hand-diff missed. Pure
Node, no install, so it runs fast and in parallel with the heavy jobs. Any PR
adding an event without its topic now goes red before merge instead of failing
silently in production. If a THIRD catalog is ever introduced, add it to the
`CATALOGS` array in the script.
