# BUG-006 — Half the event catalog had no Pub/Sub topic, so every publish silently failed

Status: **FIXED (terraform) 2026-07-24 — awaiting `terraform apply`**
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

## Verify after apply

- `gcloud pubsub topics list` returns all 134 event types.
- Place an order → no `pubsub: publish failed` lines in api-rest logs.

## Worth doing next

A CI check that diffs the `EventType` union against the terraform `topics` map and fails
the build on drift would end this recurrence permanently — it has now cost three separate
silent-failure incidents.
