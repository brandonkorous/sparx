---
title: Event-driven side effects
node: architecture
type: rule
status: active
sources:
  - packages/events/src/publisher.ts
  - packages/events/src/types.ts
---

Business side effects go through **Google Pub/Sub**, not inline in request handlers. **Topic name == event type** (per-topic Terraform `for_each`), so a typed `EventType` can't publish to an unprovisioned topic.

- `publishEvent()` **never fails the calling request** — it catches + logs. Batches 100 msgs / 50ms and tees every event to the automation fan-in topic.
- **Dev:** `GCP_PROJECT_ID` unset → `LocalDispatchPublisher` POSTs the exact Pub/Sub push envelope to local workers (`SPARX_DEV_WORKER_ROUTES`), or a logging no-op.
- **~14 Pub/Sub workers** under `services/` consume events (email, search reprojection, module provisioning, …).

**Why:** inline side effects couple request latency to downstream work and can't be retried or fanned out.

**How to apply:** publish an event; add a worker to consume it. Adding an event = add the literal to `EventType` + provision the topic/subscribers in Terraform + apply. The real catalog is [[event-catalog]] — the doc examples `order.created`/`customer.updated` **do not exist**.

Related: [[event-catalog]], [[modules-are-flags]], [[infrastructure]]
