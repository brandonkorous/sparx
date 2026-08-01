# services/ — backend services & Pub/Sub workers

Scoped guidance for everything under `services/`. Loads when working in this tree. See root [CLAUDE.md](../CLAUDE.md) for cross-cutting rules.

## Runtime: no corepack, no pnpm in the release path

A service's ENTRYPOINT + start command is `node --import tsx` — **not** `tsx/esm`, **not** `pnpm exec`. The package manager is **build-time only** and must never appear in the release/runtime path. (Regressed 7 services once; fixed in `e2f15d7`.)

New workspace packages a service depends on need explicit `COPY` lines in that service's Dockerfile, plus the transitive closure. `tsc`/`lint` pass without them but the image build fails. Prefer server-safe subpaths (e.g. `@sparx/cms-editor/serialize`) to keep React deps out of backends.

## Side effects are event-driven — and the broker is NOT a cloud service

Business events (`order.placed`, `order.paid`, `email.send`, `search.entity.changed`) are **published**, then consumed by workers. Do **not** inline side effects in request handlers.

**Which broker is chosen by `EVENT_BROKER`, never by a cloud provider's env var.** `nats` (in-cluster JetStream, the default everywhere) and `pubsub` (Google Cloud) are adapters behind one interface in [packages/events/src/transport.ts](../packages/events/src/transport.ts). Domain code calls `createPublisher({ logger })` and passes **no project id** — if you are about to write `process.env.GCP_PROJECT_ID` in a package under `packages/` or `services/`, stop: that is the bug this replaced.

**Why this is stated so firmly.** The selector used to be `GCP_PROJECT_ID`, read directly in nine domain packages. Set → Pub/Sub; unset → a fire-and-forget HTTP path written as a _dev convenience_. Migrating to Azure unset it and silently moved production onto that path: no queue, no retry, no dead-letter, and every `publishEvent` still returning success. An unset broker now **throws at boot** under `NODE_ENV=production`. Never reintroduce a default that degrades — a config mistake must fail a rollout, not become silent data loss.

Workers run as plain Deployments in-cluster on every provider. (`email-worker` + `media-worker` ran on **Cloud Run** under the GCP deployment; the `cloud-run-worker` Terraform module applies only there.)

## Email path

Outbound email defaults to publishing `email.send` to Pub/Sub. `email-worker` consumes the event, renders `@sparx/email` React Email templates, and POSTs to the provider (console in dev, **Mailgun HTTP API** in prod via `/v4/domains` for multi-tenant). Postal is decommissioned.

Direct `sendTemplate()` / `sendEmail()` calls are an escape hatch reserved for **synchronous-required flows only** (OTP codes, future 2FA). A non-OTP direct send needs justification in the PR description.

## Respect service boundaries

Don't bundle functionality into a service whose name/docs exclude it (e.g. GraphQL belongs in `api-graphql`, not `api-rest`). Shortcuts compound into multi-file refactors later.

## Deploys

Cluster mutations route through `bootstrap.yml` / `deploy-prod.yml` / `db-migrate.yml` — never raw `kubectl` apply/edit (`kubectl get`/`logs` for reads are fine). "Deploy to production" only rolls app images; platform-apply is a separate workflow. Any imperative change to a TF-managed resource must be mirrored into Terraform the same session.
