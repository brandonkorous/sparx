---
title: The REST API
node: api-events
type: reference
status: active
sources:
  - services/api-rest/src/app.ts
  - services/api-rest/src/routes/v1/
---

`services/api-rest` — **Fastify**. `app.ts` is a `createApp()` factory (tests import it with no `listen()`); `index.ts` adds `listen()` + signal handling. Shared Fastify primitives (auth, error envelope, db helpers, audit, pubsub) live in **`@sparx/api-core`**.

- Routes in `src/routes/v1/` — **46 domain entries**, one file/folder per domain (ai, b2b, billing, builder, chat, commerce, content, crm, dropship, email, inventory, invoicing, marketplace, partner, scheduling, search, seo, tenant, users, webhooks, …).
- Module data routes acquire a `*-context.ts` gate (throws `MODULE_DISABLED` → 404) **before** touching data ([[modules-are-flags]]).
- The error handler maps domain errors (`CrmNotFoundError`, `CommerceValidationError`, …) to the platform envelope.

**How to apply:** new endpoint → add under the domain folder in `v1/`, gate the module, use `@sparx/api-core` primitives — and write the service-layer function first ([[one-service-many-transports]]).

Related: [[mcp-server]], [[one-service-many-transports]]
