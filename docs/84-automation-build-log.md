# Sparx Platform — Automation Feature Build Log

**Version:** 1.10
**Author:** Brandon Korous
**Last Updated:** 2026-06-11

---

## 0. What this doc is

The **living build state** for the Automation feature. The design lives in
[docs/81](81-automation-module.md) (engine) and [docs/82](82-event-bus-unification.md)
(event substrate); this doc tracks **what is actually built**, in what order, and
**where to resume** when context shifts. Update the status markers + the
`▶ RESUME HERE` pointer every working session.

Status legend: ☐ not started · ◐ in progress · ☑ done · ⃠ deferred/blocked

> **▶ RESUME HERE:** Slice F3 (retire the b2b-overdue cron) + the email-driven-seed CONTENT FORK
> (a user decision — see below). **F2 backfill COMPLETE** this session: existing module-active
> tenants are now back-filled with their system automations via a daily worker reconcile pass.
> **Slice E COMPLETE** (event-driven activation live) and **F1 email send executors COMPLETE**.
> Slices A–D + **E1–E4** + **F2-a (dunning)** + **F2 backfill** done; **F1** has CRM (6) + B2B
> (escalate) + **email (`send_campaign` / `send_internal`)**. The engine can SEND email and now
> SEEDS every module-active tenant (forward via activation, backward via reconcile).
>
> **F2 backfill (this session):** SECURITY DEFINER `find_tenants_with_active_module(p_module)`
> (migration `20260804000000`, REVOKE PUBLIC / GRANT sparx_app) → `reconcileSystemSeeds(db)` in
> `@sparx/automation-actions` (distinct owning modules → scan module-active tenants → idempotent
> `seedSystemAutomations` per tenant) → worker `POST /internal/cron/reconcile-seeds` (same
> tick-auth) → a DAILY Cloud Scheduler job (`automation-reconcile-seeds`, 02:07 UTC, automation.tf).
> Self-healing: also covers any dropped `module.activated` event. Tests: automation-actions
> reconcile 2/2 (active-seeded / inactive-skipped + idempotent), worker route 2/2 (403 + authorized
> backfill). The seed/run gate still blocks execution for a tenant inactive at runtime, so seeding a
> later-disabled tenant is harmless.
>
> **Next — Slice F3 (retire the b2b cron):** now SAFE to do (backfill closed the "existing tenants
> have no unified dunning automation" gap that blocked it). Parity-verify vs
> `b2b-overdue-worker/test/integration/escalation.test.ts` (swap it to drive the engine), then
> DELETE `services/b2b-overdue-worker` AND its Terraform (Cloud Run + Cloud Scheduler) + the
> build-images/deploy-prod matrix entries — a TF-managed-resource deletion, mirror same session (no
> drift). Until F3 lands, a newly-activated b2b tenant runs BOTH the cron and the engine dunning →
> escalation stays monotonic/idempotent (safe) but can double-emit the `b2b.invoice.overdue`
> reminder once; F3 ends that.
>
> **⚠ Email-driven-seed CONTENT FORK (needs a product decision — do NOT guess):** win-back /
> quote-expiry as a _system_ seed can't be turnkey. A coded `win-back` template can't render a
> working CTA (BrandTokens carry `storeName` + `logoUrl` but NO site URL — see `brand.tsx`), and the
> Builder `defer` path needs a tenant-authored email that doesn't
> exist at seed time. So "ship win-back on" needs one of: (A) add a `siteUrl` to brand resolution +
> ship a real coded `win-back` template (+ register in `@sparx/email` send.tsx AND the email-worker
> `handler.ts` `TemplateSendSchema` — the worker validates against a CLOSED union); (B) provision a
> default win-back **Builder email** per tenant on email activation + seed the automation referencing
> it (most on-brand, most work); (C) seed win-back as **draft**, tenant completes + activates. The
> _mechanism_ is fully built (schedule + customer scanner + `email.send_campaign`); only the content
> source is the open decision. Surfaced to the user this session. Older context below.
>
> **(historical) F2-a (B2B dunning ladder) done** — the riskiest piece (docs/81 §3.1's canonical
> Locked behavior) is built, tested, and live-able on the schedule tick.
>
> **F2-a delivered:** a reusable `b2bEscalationService.escalateAccount` in `@sparx/crm` (the
> escalation logic that previously lived ONLY inline in `b2b-overdue-worker/cron.ts` — the
> "no reusable service" risk this log flagged, now closed); a `b2b_account` scanner + the
> `b2b.escalate_overdue` executor in `@sparx/automation-actions` (calls the service, publishes
> the same `b2b.*` notifications the cron did); a `seedSystemAutomations` catalog with the
> **Locked** dunning automation; and a 4/4 engine-path test mirroring the escalation parity
> oracle (invoice→overdue, account→credit_hold@14d / suspended@30d, monotonic). The worker
> already installs it (`installModuleActions` → `installB2bActions`); closure unchanged.
>
> **⚠ Fixed a pre-existing 8-table RLS bug en route** (migration `20260801000000`) — see the
> Slice F2 notes. b2b_invoices (+ 7 sibling b2b/import tables) had `current_setting(
'app.current_tenant_id')` (wrong GUC name, no missing_ok → THROWS under `sparx_app`). It
> blocked the dunning scan and is a latent prod bug for any `sparx_app` access to those tables.
>
> **Next:** (F2 wiring) call `seedSystemAutomations` per tenant. ARCH FORK: it must run where
> `module.activated` is published in-process → either an api-rest consumer (adds an
> api-rest → `@sparx/automation-actions` dep + Dockerfile closure) OR a worker-native reconcile
> pass (needs a cross-tenant "tenants with b2b active" SECURITY DEFINER scan) OR Slice E's
> Pub/Sub fan-in to the worker. Plus an existing-tenant backfill. (F2 cont.) the CRM-sweep +
> email-driven seeds (inactivity/win-back/quote-expiry/deal-closing) — these need the email
> executors (`email.send_campaign` / `send_internal`) first (F1 cont.). (F3) parity-check then
> DELETE the crons.
>
> **Slice E (event fan-in, docs/82) — DONE.** EVENT-triggered automations now fire live: every
> publish path tees to `automation.trigger`, the worker subscribes, and `module.activated` is
> actually published (the toggle routes). Was the prerequisite for the F2 seed wiring below.
>
> **⚠ Prod-correctness finding (Slice D):** the engine's cross-tenant tick scans
> originally assumed a BYPASSRLS `sparx_owner` connection. **Prod grants no ambient
> RLS bypass** (docs/16 §4, Decision F3 — even `sparx_owner` is non-superuser and
> FORCE-RLS-bound). A plain cross-tenant `findMany` would return **zero rows in
> prod, silently** (no automation ever runs, no error). Fixed in this slice — see
> the Slice D notes.

---

## 1. Build sequencing (and why it inverts docs/81 §12)

docs/81 §12 lists **Phase 0 (event substrate) first** because the engine can't
_receive live triggers_ without the `automation.trigger` fan-in. That ordering is
about going **live**, not about **building**. The engine's machinery (resolver,
condition evaluator, gate layer, action executor, run state machine, idempotency,
loop-guard) is fully buildable and testable by feeding it **synthetic** envelopes —
it does not need the fan-in to exist yet.

So the build order front-loads the self-contained, testable core and **defers the
Phase-0 fan-in surgery** (which touches three shared publish paths + Terraform,
the highest cross-agent-collision risk) until the engine exists to validate it:

1. **Slice A — schemas** (`@sparx/automation-schemas`) — net-new, zero collision.
2. **Slice B — data model** (Prisma + RLS migration) — net-new tables.
3. **Slice C — engine core** (`@sparx/automation`) — registries, evaluator, gates,
   executor, run state machine, service layer. Tested against docker DB with
   synthetic events.
4. **Slice D — worker** (`services/automation-worker`) — Cloud Run push + tick.
5. **Slice E — Phase 0 event substrate** (docs/82) — canonical registry, fan-in
   topic + 3 tees, `[ADD]` events, Terraform, parity test. Wires the engine live.
6. **Slice F — Phase 2** — seed system automations, parity-check, retire the crons.
7. **Slice G — Phase 3 UI** · **Slice H — Phase 4 AI** · **Slice I — Phase 5 external**
   · **Slice J — Phase 6 advanced**.

Trigger-type strings in the catalog reference existing event-type literals; Slice E
reconciles them into the one canonical registry. No build blocker from deferring E.

### Package / service inventory (what this feature introduces)

| Artifact                                                    | Purpose                                                                                                                                                                                     | Status |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `packages/automation-schemas` (`@sparx/automation-schemas`) | Zod schemas + types (trigger/condition/action/automation/gate)                                                                                                                              | ☑      |
| `packages/automation` (`@sparx/automation`)                 | Engine: registries, evaluator, gates, executor, run state machine, service layer                                                                                                            | ☑      |
| `packages/automation-actions` (`@sparx/automation-actions`) | Module executors + scanners + seed catalog (composition root) — calls existing services via `registerAction`. CRM + B2B + email-send done; email sequence + commerce pending                | ◐      |
| `packages/email-sends` (`@sparx/email-sends`)               | Lean email enqueue primitive (`enqueueSend`: suppression + `ScheduledSend` write). `@sparx/db` only — NO render/React deps, so the worker can enqueue without the email-platform UI closure | ☑      |
| `packages/crm` `b2bEscalationService`                       | Reusable per-account dunning ladder (extracted from the cron); publisher-agnostic, tx-aware                                                                                                 | ☑      |
| `packages/db` RLS GUC fix (`20260801000000`)                | Corrects 8 b2b/import tables' `tenant_isolation` policy (`app.current_tenant_id` → `current_tenant_id()` + WITH CHECK)                                                                      | ☑      |
| `packages/modules` (`@sparx/modules`)                       | Module-enablement primitives (extracted from `@sparx/auth` so lean backends probe flags without the auth/email/UI closure)                                                                  | ☑      |
| `services/automation-worker`                                | Cloud Run: Cloud Scheduler tick (schedule + run advance) + push consumer on `automation.trigger`                                                                                            | ☑      |
| `packages/db` scan helpers                                  | `find_due_automation_runs` / `find_active_scheduled_automations` SECURITY DEFINER (cross-tenant discovery)                                                                                  | ☑      |
| `packages/db` backfill scan (`20260804000000`)              | `find_tenants_with_active_module(p_module)` SECURITY DEFINER — discovers module-active tenants for the seed reconcile pass                                                                  | ☑      |
| `reconcileSystemSeeds` + worker reconcile endpoint          | Daily backfill: seed system automations for already-module-active tenants (`POST /internal/cron/reconcile-seeds` + Cloud Scheduler `automation-reconcile-seeds`)                            | ☑      |
| `terraform/envs/prod/automation.tf`                         | Cloud Run service + Cloud Scheduler tick job + runtime/scheduler SAs (push sub deferred to E)                                                                                               | ☑      |
| `packages/db` (3 tables)                                    | `automations` / `automation_runs` / `automation_run_steps` + RLS                                                                                                                            | ☑      |
| `services/api-rest` routes                                  | `/v1/automations` CRUD + internal trigger/tick endpoints                                                                                                                                    | ☐      |
| `apps/dashboard` surface                                    | List / detail / builder / run history (docs/34 standard)                                                                                                                                    | ☐      |
| MCP write-tool                                              | AI authoring path (mirrors crm `mcp/write-tools.ts`)                                                                                                                                        | ☐      |

---

## 2. Phase checklist (mirrors docs/81 §12, annotated with build reality)

### Slice A — `@sparx/automation-schemas` ☑

- ☑ Package scaffold (package.json, tsconfig, vitest, eslint inherited)
- ☑ Trigger schema (event vs schedule kinds; `triggerToColumns`/`triggerFromColumns`)
- ☑ Condition / ConditionGroup schema (operators, AND/OR — docs/81 §5.3)
- ☑ Action schema (typed `type` + opaque `config`; per-action config validated at dispatch)
- ☑ Gate-decision + run/step status shapes (allow/deny/transform/defer; `gate_log` — §7.1)
- ☑ Automation CRUD input schemas (create/update/clone; origin/locked system-managed)
- ☑ Barrel + schema-validation unit tests (7/7 green)
- ☐ Wire into Dockerfiles of consumers as they appear (footgun: COPY lines)

> **zod v4 gotcha (learned here):** a bare `z.unknown()` is **non-optional** — a
> missing key errors before any `.refine` runs. Use `z.unknown().optional()` for
> truly-optional unknown values. Also: `.superRefine` + `ctx.addIssue` was a
> silent no-op in this setup; `.refine((v) => boolean, {path})` is reliable.

### Slice B — data model ☑

- ☑ Prisma models `Automation` / `AutomationRun` / `AutomationRunStep` (`71-automation.prisma`)
- ☑ Hand-authored migration `20260730000000_automation_engine` — tables + `ENABLE`+`FORCE`
  RLS + `tenant_isolation` on all three (`tenant_id` on run_steps); `UNIQUE(automation_id,
dedupe_key)`. DDL generated Prisma-exact via `migrate diff` then RLS hand-appended.
- ☑ RLS form: `current_tenant_id()` + `WITH CHECK` (per push_subscriptions), quoted idents.
- ☑ Tenant relations declared on all 3 (3 inverse fields added to `Tenant` in `02-tenant.prisma`).
- ☑ Applied to docker (`migrate deploy`, 89/89), drift-check shows **0 automation drift**,
  client regenerated, `@sparx/db` typecheck clean.
- ☑ Indexes incl. owner-scoped tick scan `(status, resume_at)`.

> **Note — pre-existing repo index-name drift:** `migrate diff` reports ~dozens of cosmetic
> `ALTER INDEX … RENAME` lines for OTHER tables (hand-authored short names vs Prisma's
> auto names). Not ours — the 3 automation tables used Prisma-exact names → 0 added drift.
> A repo-wide cleanup is a separate sweep, out of scope here.

### Slice C — engine core (`@sparx/automation`) — Phase 1 ☑

- ☑ Trigger/entity resolver registry (event resolvers + schedule scanners; `registerResolver`/`registerScanner` seam; built-ins for customer/deal/order + customer scanner)
- ☑ Condition evaluator (all 12 operators, AND/OR, numeric/date coercion, against resolved fields) — pure, unit-tested
- ☑ **Gated dispatcher** — only path to an effect; global chain (tenant-active, kill-switch, module-active) + per-action manifest (empty must carry a justifying note — enforced at registration); `GateResult` allow/deny/transform/defer; coverage test (§7.1)
- ☑ Action registry + built-in executor (`platform.webhook` w/ egress SSRF gate) + `registerAction` seam for module executors; `platform.wait`/`platform.stop` are run-loop control flow
- ☑ `handleTrigger` — match active automations, loop-guard (`__automationDepth` vs `max_depth`), hydrate, eval, idempotent upsert (`dedupeOf`)
- ☑ `runAutomationTick` — advisory-lock (`4242_4250`) cross-tenant scan on owner conn; per-step transaction (durable: step N commits before N+1); cursor advance, durable `wait`, gate `defer` park, fail-stop
- ☑ `runScheduleTick` — `(schedule, predicate)` scan → one run per matched row; window-scoped dedupe; UTC cadence arithmetic (daily/weekly/monthly/once)
- ☑ Service layer — CRUD + `setAutomationStatus` + clone ("Duplicate to edit") + `upsertSystemAutomation` seed; **locked** tier rejects edit/status/delete; origin/locked system-managed
- ☑ Run + per-step history logging (`completed`/`gated`/`failed`/control; `gate_log` audit trail; `completeRun`/`failRun`)
- ☑ Integration tests against docker (35/35: 12 engine end-to-end incl. idempotency/wait/fail-stop/gated/transform/defer/kill-switch/SSRF + schedule, 9 service, 14 unit)

> **Decisions logged in Slice C:**
>
> - **Engine envelope is `TriggerEnvelope` (`type: string`)**, not the strict `SparxEvent`
>   `EventType` union — the engine handles `schedule.*` + the docs/81 §5.2 `[ADD]`
>   trigger types not yet in the canonical registry. `SparxEvent` is assignable to it;
>   Slice E reconciles the registry.
> - **Module action executors (crm/email/commerce/b2b) register via the `registerAction`
>   seam in a later slice**, where the engine is wired with those service packages — keeps
>   `@sparx/automation` deps lean (`@sparx/db` + `@sparx/events` + schemas). Slice C ships
>   the platform-level `platform.webhook` as the one real built-in effect; the integration
>   suite exercises the machinery via stand-in executors registered through the same seam.
> - **`dispatch` throws `UnregisteredActionError` for an unwired action** — a loud failure,
>   never a silent no-op (so a not-yet-registered module action is visible, not skipped).
> - **Skips are log-only in Slice C** (condition-not-met / max-depth don't persist a run row),
>   to avoid row explosion on high-volume events; persisted "evaluated, didn't match" history
>   is a UI-slice (G) concern.
> - **Per-step transactions, not per-run** — the durable property (a redeploy resumes mid-run,
>   never replays a committed step) requires each step to commit independently; wrapping a
>   whole run in one tx would roll back earlier committed steps on a later failure.

### Slice D — `services/automation-worker` ☑

- ☑ Tick endpoint `POST /internal/cron/tick` (Cloud Scheduler) → `runScheduleTick` then `runAutomationTick` — **this alone makes scheduled system automations live; no event fan-in needed**
- ☑ Cloud Run push handler `POST /` → `handleTrigger` (wired + tested; goes live once Slice E provisions the `automation.trigger` subscription)
- ☑ `env.ts` (sparx_app DATABASE_URL — NO owner conn), `runtime.ts` (engine deps + `runTick`/`ingest`), side-effect-free `server.ts` + thin `index.ts`, `Dockerfile` (COPY closure: automation + automation-schemas + db + events), `.env.example`
- ☑ End-to-end integration test (4/4) driving the REAL HTTP server against docker **as `sparx_app`**: push → run enqueued → tick → completed; tick-auth 403; non-trigger ack
- ☑ Terraform `automation.tf`: Cloud Run service + per-minute Cloud Scheduler job (OIDC) + runtime SA + scheduler-invoker SA; `cloudscheduler.googleapis.com` added to bootstrap; `terraform validate` + `fmt` clean
- ☑ CI: `automation-worker` added to `build-images.yml` matrix + the `gcloud run services update` loop in `deploy-prod.yml`
- ⃠ **Module action executors (crm/email/commerce/b2b) deferred to Slice F** — you can't register an executor that doesn't exist yet; wiring lands with the executors + the seeded automations that use them. The worker registers `platform.webhook` + the control-flow built-ins now.
- ⃠ **Pub/Sub push subscription deferred to Slice E** — the `automation.trigger` topic + 3 publish-path tees are Slice E. The IAM `run.invoker` for the pubsub invoker SA + the subscription stub are pre-placed in `automation.tf`.

> **Decisions logged in Slice D:**
>
> - **CROSS-TENANT DISCOVERY VIA `SECURITY DEFINER`, NOT A BYPASSRLS CONNECTION.**
>   Slice C's ticks did a plain cross-tenant `automationRun.findMany` /
>   `automation.findMany`, assuming the worker connects as a BYPASSRLS
>   `sparx_owner` (the run-tick header even said so). **That is wrong for prod:**
>   docs/16 §4 (Decision F3) grants NO ambient RLS bypass — prod `sparx_owner` is
>   a non-superuser, FORCE-RLS-bound, and sees **0 rows** on a tenant table without
>   a GUC (the documented backfill footgun). The tick would have returned zero due
>   runs in prod **silently** — every automation dead, no error. Fixed by mirroring
>   the existing, prod-proven `find_due_scheduled_entries` /
>   `find_pending_webhook_deliveries` pattern: migration `20260731000000` adds
>   `find_due_automation_runs(p_limit)` + `find_active_scheduled_automations()`
>   SECURITY DEFINER (owned by `sparx_owner`, granted `sparx_app`); the ticks call
>   them for DISCOVERY only, then drive each run/automation under `withTenant`
>   (RLS-scoped). The worker connects as **`sparx_app`** via the existing
>   `database-url` secret — no owner secret, no new BYPASSRLS role.
> - **Tests now run the ticks through a real `sparx_app` (NOBYPASSRLS) client**
>   (`appDb` in `test/helpers.ts`), with setup/asserts on `ownerDb`. Local
>   `sparx_owner` is a superuser, so running ticks on it would MASK exactly the
>   bug above; `appDb` exercises the prod RLS boundary honestly. 35/35 still green.
> - **Tick auth = OIDC (prod) OR internal-cron token (local/manual).** Cloud
>   Scheduler authenticates with an OIDC token as a dedicated
>   `sparx-automation-scheduler` SA (run.invoker on the service); the worker also
>   checks the `email` claim against `TICK_INVOKER_SA`. This keeps the shared cron
>   secret OUT of the scheduler-job config/TF state. The token path remains for
>   local `curl` + manual invocation.
> - **Schedule tick THEN run tick, in one tick** — a run the schedule tick just
>   enqueued advances in the same invocation rather than waiting a full interval.
> - **First-deploy ordering:** the new image must exist before `terraform apply`
>   creates the Cloud Run service (it pins `:latest`). Sequence: push to `main`
>   (build-images builds `automation-worker`) → bootstrap-apply (enables
>   `cloudscheduler`) → platform-apply (creates service + scheduler) →
>   deploy-prod (rolls the real tag). Same bootstrapping every Cloud Run worker used.

### Slice E — Phase 0 event substrate (docs/82) ☑

**E1 — canonical registry ☑**

- ☑ `@sparx/events` is now the single superset (`+module.activated/deactivated`,
  `search.reindex.requested`, `chat.message.received`, `push.send` — the api-core-only events
  folded in). `api-core/pubsub.ts` deleted its local `EventType` union and re-exports the
  canonical one (type-only ⇒ no runtime dep; every service that COPYs api-core already COPYs
  `@sparx/events`, so zero Dockerfile-closure risk). Full workspace typecheck 35/35.

**E2 — fan-in topic + subscription ☑**

- ☑ `automation.trigger` topic (main.tf) + a Cloud Run **push** subscription
  (`automation.trigger.automation-worker` in automation.tf) → the worker's `POST /`, OIDC as
  `pubsub_invoker`, DLQ after 5 attempts. The worker is the SOLE subscriber. `terraform
validate` clean. (`module.activated`/`deactivated` topics already existed — empty-subscriber.)

**E3 — fan-in tee ☑**

- ☑ Tee installed in all THREE publish paths: `@sparx/events` `CloudPubSubPublisher`, api-core
  `CloudPubSubPublisher`, and the CRM bridge's BOTH bus wrappers (`CrmPubSubPublisher` for
  `crm.*` + `PubSubTeePlatformBus` for `order.*` — the two-bus footgun, docs/82 §3.3). Shared
  `teeToFanIn` helper (`@sparx/events/fan-in`); inlined in the CRM bridge to keep `@sparx/crm`
  off an `@sparx/events` dep. Carries `__automationDepth` from the envelope (default 0) for the
  loop-guard. Unit test 3/3; best-effort (a tee failure never fails the per-type publish).

**E4 — `module.activated` publish + consumers ☑**

- ☑ **automation-worker** dispatches `module.activated` → `seedSystemAutomations({tenantId},
{module})` (a provisioning signal, not a trigger). `seedSystemAutomations` filters the catalog
  by the activated module. So once `module.activated` is published, the worker seeds the dunning
  automation via the fan-in — no second subscription.
- ☑ **Publish lynchpin** — `routes/v1/tenant.ts` `announceModuleTransition(log, tenantId, actorId,
slug, enabled)` publishes `module.{activated,deactivated}` to BOTH buses: api-core `publish()`
  (→ per-type Pub/Sub topic + webhook enqueue + fan-in tee → worker) and `publishPlatformEvent()`
  (→ in-process bus → CRM/Email consumers, awaited so seeding completes before the route returns).
  Wired into BOTH the per-slug `PATCH` and the bulk `PUT /v1/tenant/modules` (onboarding modules
  step), **transition-gated** (fires only on an actual on/off change). Idempotent consumers make a
  redundant announce harmless.
- ☑ **CRM** in-process consumer was already wired (`registerModuleActivationConsumers`) — now
  actually driven by the publish above (it was dead before: no publisher existed).
- ☑ **Email** in-process consumer — `services/api-rest/src/lib/email-module-activation.ts`
  (`registerEmailModuleActivationConsumer`, wired in `index.ts`): on `module.activated` for
  `email`, calls `automationService.provisionDefaults`. Lives at the api-rest composition root
  (not in `@sparx/email-platform`) because the platform bus is owned by `@sparx/crm` and email
  must not depend on CRM. Unit test 2/2 (mock email service + real in-memory bus; CI-safe, no DB).
- ☑ **Dashboard cleanup** — the redundant `POST /v1/crm/bootstrap` follow-up in
  `settings/modules/actions.ts` is removed (the toggle's publish seeds CRM synchronously now). The
  `/v1/{crm,email}/bootstrap` ENDPOINTS stay as idempotent admin escape hatches (the email one is
  also a deliberate user button on the email-automations page — untouched).

**Verification:** my files typecheck clean (the only `tsc` errors in api-rest are 3 stale-Prisma-
client `BillingDocument*`/`Document*` refs from ANOTHER agent's uncommitted invoicing schema,
ungenerated because of the Windows `query_engine.dll` lock — not from this work; clear on next
`prisma generate`). Lint 0, prettier clean. Tests: email consumer 2/2, CRM `pubsub-bridge` 6/6.

**Parity test ⃠** — a strict `EventType` ↔ topics parity is NOT cleanly achievable yet: the
canonical union carries many aspirational events (b2b._, dropship._, subscription._) with no
topic, and the topics map has bridge names (`order.created`, `crm.customer._`, `domain.verified`)
absent from the union. A meaningful parity test needs the full union↔topic reconciliation
(rename bridge topics, represent `crm.\*` in the union) — a separate sweep, logged here so it
isn't silently skipped.

### Slice F — module executors + seed + retire crons ◐

**F1 — module action executors ◐ (CRM + B2B + email send done; email sequence\_\* + commerce pending)**

- ☑ `@sparx/automation-actions` package (the module-effect composition root) — keeps the
  engine lean; the worker calls `installModuleActions()` at boot.
- ☑ **6 CRM executors** — `crm.add_tag` / `remove_tag` / `add_note` / `update_field` /
  `create_task` / `update_deal_stage`, each CALLING `@sparx/crm/services` (never
  re-implementing). 7/7 e2e green: trigger → match → resolve → gated dispatch → executor →
  real CRM service → DB effect, run on the `sparx_app` client.
- ☑ **B2B `escalate_overdue` executor + `b2b_account` scanner** — calls the new reusable
  `b2bEscalationService.escalateAccount`, then publishes the same `b2b.invoice.overdue` /
  `b2b.account.credit_hold` / `b2b.account.suspended` events the cron emitted (on the
  `@sparx/events` bus via `ctx.deps.publisher`). The scanner resolves per-account
  `hasOverdueInvoices` / `maxDaysPastDue` / `utilization` (one aggregate query), so the dunning
  predicate AND a future credit-utilization predicate both read off it.
- ☑ Worker wiring: `installModuleActions()` (now CRM + B2B) + `installCrmPubSubBridge()` at boot;
  closure UNCHANGED (b2b lives in `@sparx/crm` + `@sparx/automation-actions`, both already
  COPY'd; `@sparx/events` promoted dev→prod dep but already in the closure).
- ☑ **2 email executors — `email.send_campaign` + `email.send_internal`** (`automation-actions/src/email.ts`,
  `installEmailActions`). Both PUBLISH a send (never direct-deliver, docs/81 §5.4): they call
  `enqueueSend`, which writes a `ScheduledSend` (`automationId: null`) that the api-rest `email-dispatch`
  tick turns into an `email.send`. `send_campaign` is a customer-addressed marketing send — recipient
  is the trigger's `customer.email`, skips a do-not-contact contact, body is a published Builder email
  (`defer`, personalized at dispatch) OR a coded template. `send_internal` is a staff notification (raw
  body, transactional scope, configured `to`).
  - **⚠ Closure decision (changed from the original plan):** `@sparx/email-platform` pulls in
    `@sparx/email` + `@sparx/ui` + `lucide-react` + React (peer) — importing it into the worker would
    blow up the deliberately-lean image (its Dockerfile is proud of "no React/UI/auth"). So instead of
    `automationService.enqueueSend`, the enqueue primitive lives in a NEW lean **`@sparx/email-sends`**
    (deps: `@sparx/db` only — no render libs): `enqueueSend(ctx, spec)` = suppression-check +
    `scheduledSend.createMany({skipDuplicates})`. The executor calls it; the worker COPYs only
    `packages/email-sends`. The render half stays in api-rest's dispatch tick (which has the email/builder
    libs). This still honors "executors call a service" while keeping the worker React-free.
  - Recipient/flag reads off the resolved `fields` via `entity.ts` (`requireStringField` for
    `customer.email`, `optionalBoolField` for `customer.doNotContact`). `installEmailActions()` wired into
    `installModuleActions()`; worker closure now 10 packages (added `email-sends`).
  - **Tests (docker DB):** `@sparx/email-sends` enqueue 4/4 (enqueue/payload/dueAt, marketing
    suppression skip, transactional-through-marketing-suppression, dedupe idempotency — on the sparx_app
    FORCE-RLS client); `automation-actions` email engine-path 2/2 (event → handleTrigger →
    runAutomationTick → ScheduledSend for `customer.email`; do-not-contact skip). Suite 13/13.
- ☐ `email.sequence_add` / `email.sequence_remove` (sequence membership — not yet built)
- ☐ Commerce executors (`commerce.*`)

**F2 — seed system automations ◐ (dunning + backfill done)**

- ☑ **B2B dunning ladder → Locked system automation** (`seedSystemAutomations` catalog). 4/4
  engine-path test mirrors the parity oracle: invoice→overdue, account→credit_hold@14d /
  suspended@30d, reminder event on fresh-overdue, monotonic on re-run. Schedule-tick-driven —
  live without Slice E.
- ☑ **Seed wiring — LIVE via Slice E** (the ARCH FORK resolved to "Slice E fan-in"). The toggle
  routes publish `module.activated` → fan-in → worker `ingest()` → `seedSystemAutomations({tenantId},
{module})`. So activating B2B now seeds the dunning automation for that tenant automatically.
- ☑ **Existing-tenant backfill** — `find_tenants_with_active_module(p_module)` SECURITY DEFINER scan
  (migration `20260804000000`) → `reconcileSystemSeeds(db)` (distinct owning modules → scan →
  idempotent `seedSystemAutomations` per tenant) → worker `POST /internal/cron/reconcile-seeds`
  (tick-auth) → daily Cloud Scheduler `automation-reconcile-seeds`. Covers pre-engine tenants AND
  self-heals a dropped `module.activated`. Tests: reconcile 2/2 (active-seeded / inactive-skipped +
  idempotent), worker route 2/2. A null-module (always-on) seed would need an all-tenants scan — none
  exist; the reconcile warns loudly if one is added so the gap isn't silent.
- ☐ Re-express CRM sweep (inactive/win-back/high-value/deal-closing/credit-near-limit/quote-expiry) —
  the _mechanism_ is built (customer scanner + `email.send_campaign`), but the email CONTENT SOURCE
  is an open product decision (see the RESUME "CONTENT FORK": coded+siteUrl vs Builder-authored vs
  draft). Don't ship a system seed that enqueues sends with no working CTA.
- ☐ Seed remaining default Managed automations (abandoned-cart, win-back, fulfilled→review)

**F3 — retire crons ☐**

- ☐ Parity-verify vs existing engines (the outcome-tests already guard these), then DELETE crons.
  The dunning oracle (`b2b-overdue-worker/escalation.test.ts`) stays 4/4; F3 swaps it to drive
  the engine, then deletes `b2b-overdue-worker` (its escalation logic now lives in the reusable
  service).

> **Decisions logged in Slice F1:**
>
> - **Executors CALL services, never re-implement (locked decision).** Each CRM executor
>   builds a `{ tenantId }` ctx and invokes `customerService.bulkTag` / `taskService.create`
>   / `dealService.moveStage` / etc. The service owns its own `withTenant` transaction, audit
>   row, and the published `crm.*` event (incl. the two-bus fan-out) — so events/audit happen
>   exactly once, at the source. The executor only maps `config` + the resolved trigger entity
>   (`fields['customer.id']` / `['deal.id']`) onto the call.
> - **Effect is ATOMIC with the step record (tx-injection — FIXED 2026-06-11).** Originally the
>   executor's service write committed in its OWN transaction, separate from the engine's
>   per-step commit (execute-then-record, at-least-once — so `create_task`/`add_note` could
>   duplicate on an ungraceful crash mid-step). Fixed: `TenantContext` gained an optional `tx`
>   and `withTenant` composes into it instead of opening a nested transaction; the executor
>   passes `ctx.tx` (the engine's per-step tx) to the CRM service, so the effect + the
>   `automation_run_steps` row + the cursor advance all commit as ONE unit. A crash now either
>   rolls back everything (resume re-runs cleanly) or commits everything (resume continues) —
>   no duplicate effect. Only the `crm.*` event publish stays outside the tx (it's a Pub/Sub
>   network call — inherently at-least-once, dedupe-keyed + consumers idempotent; a spurious
>   event on the rare crash-rollback is self-healing). The change to `withTenant` is opt-in
>   (the `tx` branch only triggers when a caller passes one) — default path unchanged; verified
>   by the full CRM suite (82/82) + RLS isolation.
> - **`create_task` needs a user** — `createdByUserId` is NOT NULL and a system automation has
>   no actor, so the action config's `assignedToUserId` doubles as the creator.
> - **Missing required entity field → loud `failed` step** (not a silent no-op): an action wired
>   to an entity its trigger can't resolve (e.g. a customer tag on a customer-less deal event)
>   throws, recording a `failed` step.
> - **`@sparx/crm` slimmed so the worker stays lean (FIXED 2026-06-11).** `@sparx/crm` had only
>   TWO things pulling its heavy deps: `manifest.ts` (a dashboard UI manifest — the only
>   `@sparx/ui`/`lucide-react`/React importer) and the event consumers' use of `@sparx/auth`'s
>   `isModuleEnabled`/`invalidateModuleCache` (which dragged in `auth → email → cms-editor`).
>   Both were misplaced. Fix: (1) `manifest.ts` → `apps/dashboard/.../crm/manifest.ts` (mirrors
>   the email-platform manifest split); (2) the session-free module-gate core → new
>   **`@sparx/modules`** package (deps: just `@sparx/db`); `@sparx/auth` re-exports it for its
>   ~40 importers (zero blast radius), `requireModule(session)` stays in auth. `@sparx/crm` now
>   deps = pubsub + commerce-schemas + crm-schemas + db + modules + zod — **no auth/ui/email/
>   cms-editor/react**. Worker COPY closure: **15 → 9 packages, no React**. Verified: db /
>   modules / auth / crm / dashboard / api-rest typecheck + crm 82/82 green.

> **Decisions logged in Slice F2 (B2B dunning):**
>
> - **Escalation logic extracted to a reusable service, NOT left inline.** The dunning ladder
>   lived only in `b2b-overdue-worker/cron.ts` (the "no reusable service" risk this log flagged).
>   It now lives in `b2bEscalationService.escalateAccount` (`@sparx/crm`), which the executor
>   calls. The cron can delegate to it until F3 retires it — no third copy.
> - **Per-account, not per-tenant batch.** The cron did one tenant-wide bulk UPDATE; the engine
>   runs one resumable run per scanned account, so the service escalates a SINGLE account. Same
>   observable outcome (every account with past-due invoices is processed), smaller commits.
> - **Service is publisher-agnostic; the executor publishes.** `escalateAccount` does pure DB
>   work and RETURNS the transition + freshly-overdue invoices; the executor emits the `b2b.*`
>   events on `@sparx/events` (via `ctx.deps.publisher`). Pushing those topics into a CRM service
>   that only knows the CRM two-bus would cross a bus boundary — and keeping it pure lets the
>   cron reuse the same method. The escalation commits atomically with the run-step (tx-injection:
>   the executor passes `ctx.tx`).
> - **The ladder lives in the action, not in conditions.** 14d→credit_hold / 30d→suspend are a
>   Locked credit INVARIANT (monotonic, two different effects), so they're encapsulated in
>   `escalateAccount` with the thresholds exposed as action config (a cloned Managed copy can
>   retune them). The predicate is just `hasOverdueInvoices = true` (the scan selector).
> - **escalation does NOT touch `credit_used`.** Marking an invoice unpaid→overdue keeps it in
>   the (unpaid,overdue) set credit_used sums, so the total is unchanged — the cron's defensive
>   resync was a no-op for the amount. credit_used stays an invoice-create/pay invariant.
>
> **⚠ Pre-existing RLS bug fixed en route (migration `20260801000000_fix_b2b_import_rls_guc`):**
> Eight tables — `b2b_invoices`, `b2b_account_contacts`, `purchase_approval_rules`,
> `b2b_pricing_tiers`, `b2b_tier_product_overrides`, `b2b_account_product_overrides`,
> `import_jobs`, `import_job_rows` — had `tenant_isolation USING (tenant_id =
current_setting('app.current_tenant_id')::uuid)`. That GUC name is **wrong** (`withTenant` sets
> `app.tenant_id`) AND lacks the `missing_ok` flag, so `current_setting` THROWS
> `unrecognized configuration parameter` rather than yielding "no rows" when the GUC is unset.
> Every prod path is affected: `sparx_app` always (FORCE RLS), and prod `sparx_owner` too
> (non-superuser, FORCE-bound — Decision F3). It went unnoticed because the only consumers so far
> ran as LOCAL `sparx_owner` (a superuser that bypasses RLS) — exactly the masking trap Slice D
> called out. The b2b dunning scan (reads `b2b_invoices` as `sparx_app` under `withTenant`) was
> the first path to hit it. Fix recreates all 8 policies in the canonical `current_tenant_id()`
> form + adds `WITH CHECK`. Applied to docker (91 migrations, 0 drift); ships via the DB Migrate
> pipeline. **Not bundled into another agent's feature — it's a DB-layer correctness fix and a
> new migration file, touching no other source.**

### Slice G — Phase 3 dashboard UI ☐ (see docs/81 §8)

### Slice H — Phase 4 AI assistant ☐ (MCP write-tool)

### Slice I — Phase 5 external (Zapier / Make / inbound webhooks) ☐

### Slice J — Phase 6 advanced (branches, loops, retention, metering) ⃠ (deferred)

---

## 3. Cross-cutting decisions already locked (from docs/81, don't relitigate)

- **Platform capability, NOT a gated module** — no `automations` slug, worker always runs.
- **One engine, three tiers** (Locked / Managed / Custom via `origin` + `locked`).
- **One fan-in topic** `automation.trigger` (NO wildcard subscribe); teed from 3 paths.
- **Durable resumable runs** (`resume_at`, `cursor_index`) + advisory-lock tick — NO BullMQ.
- **Idempotency** `UNIQUE(automation_id, dedupe_key)`; **loop-guard** `cause_depth`/`max_depth`.
- **Conditions over RESOLVED fields** (entity resolver hydrates; payloads are thin IDs).
- **Gated dispatcher is the only path to an effect**; gates ≠ conditions; `deny` ≠ `failed`
  (records `gated` + `gate_log`); gates are typed fns, not a policy DSL.
- **Actions call existing services** (never re-implement); bulk via `bulk_op_reverts` + confirm.
- **Inline invariants stay inline** (suppression, tax, RLS — not automations _by shape_).
- **Metering deferred** — ship flat-rate-included.

## 4. Test status

- Outcome-level tests already guard the behaviors Slice F will replace (cron→engine swap):
  `packages/crm/test/integration/automation-triggers.test.ts` (7),
  `overdue-task-reminders.test.ts` (3),
  `services/b2b-overdue-worker/test/integration/escalation.test.ts` (4). These are the
  **parity oracle** for Slice F — they must stay green through the swap.

## 5. Session log

- **2026-06-10** — Build log created. Sequencing decided (engine-core before Phase-0
  fan-in). **Slice A `@sparx/automation-schemas` DONE + committed** (`25164b9`) —
  trigger/condition/action/automation/run schemas + column-mapping helpers, 7/7
  tests, typecheck + lint clean. Grounded the Slice B RLS form (`current_tenant_id()`
  per push_subscriptions). **Slice B data model DONE** — 3 Prisma models + 3 Tenant
  inverses + migration `20260730000000_automation_engine` (Prisma-exact DDL + hand-added
  RLS), applied to docker (89/89), 0 drift, client regenerated, db typecheck clean.
  **Slice C engine core DONE** — `@sparx/automation` (`packages/automation`): condition
  evaluator (12 ops), entity-resolver + schedule-scanner registries (built-ins for
  customer/deal/order), gated dispatcher (global chain + per-action manifest +
  allow/deny/transform/defer), `platform.webhook` built-in + SSRF egress gate +
  `registerAction` seam, `handleTrigger` (loop-guard + idempotent upsert), `runAutomationTick`
  (advisory-lock, per-step-transaction durable run machine, wait/defer park, fail-stop),
  `runScheduleTick` (predicate scan + window dedupe), service layer (CRUD + clone + locked
  guard + system seed). **35/35 tests green** (12 engine e2e + 9 service + 14 unit) against
  docker; typecheck + lint + prettier clean. Decisions captured in Slice C checklist notes.
  Next session resumes at Slice D (`services/automation-worker`) — schedule-first path retires
  the crons without the Slice E fan-in.
- **2026-06-10 (cont.)** — **Slice D `services/automation-worker` DONE.** Built the
  Cloud Run worker: `POST /internal/cron/tick` (Cloud Scheduler) → schedule tick +
  run tick; `POST /` (Pub/Sub push, Slice-E-ready) → `handleTrigger`; `GET /healthz`.
  Side-effect-free `server.ts` + thin `index.ts`; `runtime.ts` builds the engine
  deps on the shared `@sparx/db` `prisma` (sparx_app) for one pool across ticks +
  ingest. **Caught + fixed a prod-correctness bug:** the Slice C ticks assumed a
  BYPASSRLS owner connection that prod does NOT grant (Decision F3) — they'd return
  0 due runs silently in prod. Replaced the cross-tenant `findMany`s with two new
  SECURITY DEFINER helpers (migration `20260731000000_automation_scan_helpers`,
  applied to docker), mirroring `find_due_scheduled_entries`. Upgraded the engine
  tests to drive ticks through a real `sparx_app` (`appDb`) client so the prod RLS
  boundary is actually exercised — 35/35 still green. Worker e2e suite 4/4 against
  docker. Terraform `automation.tf` (Cloud Run service + per-minute OIDC Cloud
  Scheduler job + runtime/scheduler SAs; push sub deferred to E); added
  `cloudscheduler.googleapis.com` to bootstrap; `terraform validate`/`fmt` clean.
  CI: `automation-worker` registered in build-images + deploy-prod Cloud Run loop.
  typecheck + lint + prettier clean across automation/automation-worker/db. Next:
  Slice F (module executors + seed system automations + retire crons) — the
  schedule tick is now live so this needs no Slice E fan-in.
- **2026-06-11** — **Slice F1 (CRM action executors) DONE.** New package
  `@sparx/automation-actions` (the module-effect composition root) with 6 CRM executors
  (`add_tag` / `remove_tag` / `add_note` / `update_field` / `create_task` /
  `update_deal_stage`), each CALLING `@sparx/crm/services` — never re-implementing, so the
  service's audit row + `crm.*` event (two-bus) happen once at the source. 7/7 e2e green
  driving the full engine path (handleTrigger → runAutomationTick) against docker on the
  `sparx_app` client, incl. the loud `failed`-step path when a required entity field is absent.
  Wired into the worker: `installModuleActions()` + `installCrmPubSubBridge()` at boot (real
  Pub/Sub for executor-emitted events; no-op without `GCP_PROJECT_ID`), package dep, Dockerfile
  COPY closure (+11 workspace dirs — runtime stays React-free via server-safe subpaths; the
  closure bloat is logged debt, fix = a `@sparx/crm-core` split). typecheck + lint + prettier
  clean across automation-actions + worker; worker e2e still 4/4. Next: F2 (seed system
  automations — schedule-tick-only, no Slice E) → F3 (parity-check + retire crons).
- **2026-06-11 (cont.)** — **Hardening pass on the two F1 judgment calls** (user-requested fix
  before live users). (1) **Idempotency → tx-injection:** `TenantContext` gained an optional
  `tx`; `withTenant` composes into it (no nested `$transaction`, no re-SET of the GUC); the CRM
  executors pass `ctx.tx`, so an effect commits ATOMICALLY with its `automation_run_steps` row +
  cursor advance — no duplicate `create_task`/`add_note` on an ungraceful crash mid-step. Opt-in
  (default `withTenant` path unchanged); verified CRM 82/82 (+ RLS isolation), automation 35/35,
  automation-actions 7/7. (2) **`@sparx/crm` slim-down:** found the only two heavy-dep culprits
  were misplaced — `manifest.ts` (dashboard UI) → moved to `apps/dashboard/.../crm/manifest.ts`;
  the session-free module-gate core → new **`@sparx/modules`** pkg (deps: just `@sparx/db`), with
  `@sparx/auth` re-exporting for its ~40 importers (zero blast radius). `@sparx/crm` dropped
  `auth`/`ui`/`lucide-react`/`react`; the worker COPY closure went **15 → 9 packages, no React**.
  Verified db/modules/auth/crm/**dashboard**/**api-rest** typecheck + crm 82/82; worker 4/4 +
  lean Dockerfile. typecheck + lint + prettier clean across all touched packages.
- **2026-06-11 (cont.)** — **Slice F2-a (B2B dunning ladder) DONE.** The riskiest seed (docs/81
  §3.1's canonical Locked behavior) end-to-end on the unified engine: (1) extracted the
  escalation logic from `b2b-overdue-worker/cron.ts` into reusable
  `b2bEscalationService.escalateAccount` (`@sparx/crm`) — per-account, publisher-agnostic,
  tx-aware (closes the "no reusable service" risk); (2) `b2b_account` scanner +
  `b2b.escalate_overdue` executor in `@sparx/automation-actions` (calls the service, publishes
  the cron's `b2b.*` events on `@sparx/events`); (3) `seedSystemAutomations` catalog with the
  **Locked** dunning automation; (4) `b2b.escalate_overdue` added to the `ActionType` enum.
  4/4 engine-path test mirrors the parity oracle (invoice→overdue, credit_hold@14d /
  suspended@30d, fresh-overdue reminder event, monotonic re-run) on the `sparx_app` client.
  Worker auto-installs it (`installModuleActions` → `installB2bActions`); closure unchanged.
  **Caught + fixed a pre-existing 8-table RLS GUC bug** (migration `20260801000000`) — the
  dunning scan reading `b2b_invoices` as `sparx_app` was the first path to hit the wrong
  `current_setting('app.current_tenant_id')` form (throws under FORCE RLS); recreated all 8
  policies in the canonical `current_tenant_id()` form + `WITH CHECK`, applied to docker (0
  drift). Verified: automation-schemas/crm/automation-actions typecheck + lint clean;
  automation-actions 11/11, automation 35/35, b2b-overdue-worker 4/4 (oracle still green),
  worker 4/4. Next: F2 seed WIRING (arch fork — see RESUME) + the email-driven CRM-sweep seeds.
- **2026-06-11 (cont.)** — **Slice E (event-bus unification, docs/82) E1–E3 + E4-worker DONE.**
  The seed-wiring arch-fork resolved to "do it right via Pub/Sub" (user call), which is exactly
  Slice E — so built it. **E1:** consolidated the two drifted `EventType` unions into one
  `@sparx/events` superset (folded in the 3 api-core-only events + `module.activated/deactivated`);
  `api-core` deletes its local union and re-exports the canonical one (type-only, zero
  Dockerfile-closure risk — verified every api-core-COPYing service already COPYs events). Full
  typecheck 35/35. **E2:** `automation.trigger` topic + Cloud Run push subscription to the worker
  (DLQ + OIDC); `terraform validate` clean. **E3:** the fan-in tee in all three publish paths
  (`@sparx/events` + api-core `CloudPubSubPublisher`, CRM bridge's BOTH bus wrappers — the
  two-bus footgun), shared `teeToFanIn` helper carrying `__automationDepth`; unit test 3/3,
  best-effort so a tee failure never fails the per-type publish. Updated the CRM bridge unit test
  for the new tee (82/82). **E4 (worker):** the worker dispatches `module.activated` →
  `seedSystemAutomations` (now module-filtered), so activation seeds the dunning automation via
  the fan-in. typecheck + lint + prettier clean across events/api-core/crm/automation-actions/
  worker; crm 82/82, automation-actions 11/11, worker 4/4, events 3/3. **Remaining E4 lynchpin:**
  publish `module.activated` from the `tenant.ts` toggle routes (DEFERRED — another agent's file)
  - the Email in-process consumer + retiring the dashboard bootstrap calls. Parity test deferred
    (needs the union↔topic reconciliation — logged, not silently skipped).
- **2026-06-11 (cont.)** — **Slice E COMPLETE — E4 publish lynchpin landed.** `tenant.ts` had
  settled (onboarding modules-first work committed-adjacent; my edits are purely additive), so I
  wired the publish. Added `announceModuleTransition(log, tenantId, actorId, slug, enabled)` to
  `routes/v1/tenant.ts`: publishes `module.{activated,deactivated}` to BOTH buses — api-core
  `publish()` (per-type topic + webhook enqueue + fan-in tee → worker) and `publishPlatformEvent()`
  (in-process → CRM/Email, awaited). Called from the per-slug `PATCH` AND the bulk `PUT
/v1/tenant/modules` (onboarding), transition-gated (only on a real on/off change). Added the
  **Email** in-process consumer `services/api-rest/src/lib/email-module-activation.ts`
  (`registerEmailModuleActivationConsumer`, wired in `index.ts`) → `automationService.
provisionDefaults` on `module.activated` for `email`; placed at the api-rest composition root so
  email doesn't depend on CRM (which owns the bus). Retired the dashboard's redundant `POST
/v1/crm/bootstrap` follow-up in `settings/modules/actions.ts` (the toggle seeds CRM synchronously
  now); the bootstrap endpoints stay as idempotent escape hatches. **Verify:** my files typecheck
  clean — the only api-rest `tsc` errors are 3 stale-Prisma-client `BillingDocument*`/`Document*`
  refs from another agent's ungenerated invoicing schema (Windows DLL lock blocks `prisma generate`;
  not this work). Lint 0, prettier clean. New email-consumer unit test 2/2 (mocked email service +
  real in-memory bus, CI-safe, no DB); CRM `pubsub-bridge` 6/6. Slice E is now fully live: activate
  a module → CRM/Email seed in-process within the request + system automations seed via the worker
  fan-in. **Next:** F2 cont. (email-driven seeds — need email executors) + existing-tenant backfill
  - F3 (retire the b2b cron). Parity test still deferred.
- **2026-06-11 (cont.)** — **F1 email send executors DONE.** With dev killed I regenerated the
  Prisma client (clearing the stale-invoicing-client noise; api-rest tsc 0) and built the email
  effects. Traced the send pipeline end-to-end and hit the key fork: `@sparx/email-platform` drags
  `@sparx/email` + `@sparx/ui` + React into anything that imports it — fatal for the deliberately
  React-free automation-worker. So instead of `automationService.enqueueSend`, I created a NEW lean
  **`@sparx/email-sends`** (deps: `@sparx/db` only): `enqueueSend(ctx, spec)` = suppression-check +
  `scheduledSend.createMany({skipDuplicates})` with `automationId: null`, riding the existing
  email-dispatch tick. Built `email.send_campaign` (customer `customer.email`, do-not-contact skip,
  Builder-email `defer` or coded template, marketing scope) + `email.send_internal` (raw staff note,
  transactional) in `automation-actions/src/email.ts`; added `requireStringField`/`optionalBoolField`
  to `entity.ts`; wired `installEmailActions()`; worker Dockerfile COPYs the lean `email-sends` (now
  10 pkgs, still no React). **Verify (docker DB up):** email-sends 4/4 (enqueue/suppression/dedupe on
  the sparx_app FORCE-RLS client), automation-actions 13/13 (incl. the new 2 engine-path email tests
  — caught + fixed a `ConditionGroup.logic` casing bug, it's `'AND'` not `'and'`), worker 4/4;
  typecheck (email-sends/automation-actions/worker) 0, lint 0, prettier clean. Full `pnpm typecheck`:
  all 35 typecheck tasks pass (only `@sparx/db#build` prisma-generate EPERMs — the user restarted
  `pnpm dev`, re-locking the Windows query_engine DLL; the client is already current, so it's a
  no-op env flake, not a code issue). **Next:** F2 cont. email-driven seeds (win-back / inactivity /
  quote-expiry / deal-closing) on top of these executors; backfill; F3.
- **2026-06-11 (cont.)** — **Slice F2 backfill DONE + email-seed content fork surfaced.** Started F2
  cont. (email-driven seeds) but tracing the path surfaced a genuine PRODUCT-CONTENT fork: a _system_
  seed can't produce a turnkey marketing email (coded `win-back` template can't render a working CTA
  — BrandTokens carry storeName/logoUrl but no site URL; the Builder `defer` path needs a
  tenant-authored email absent at seed time). The send MECHANISM is fully built; the content source
  is a real decision (coded+siteUrl / Builder-authored / draft-until-configured), so I did NOT guess
  — surfaced it to the user and pivoted to the UNBLOCKED, fully-complete prerequisite: the **F2
  backfill** (also the safe precondition for F3 — retiring the cron before back-filling existing b2b
  tenants would stop their dunning). Built: SECURITY DEFINER `find_tenants_with_active_module(p_module)`
  (migration `20260804000000`, REVOKE PUBLIC / GRANT sparx_app; applied to docker, 94 migrations, only
  mine pending) → `reconcileSystemSeeds(db)` in `@sparx/automation-actions` (distinct owning modules
  → cross-tenant scan → idempotent `seedSystemAutomations` per tenant; warns on an unsupported
  null-module seed) → worker `reconcileSeeds(logger)` + `POST /internal/cron/reconcile-seeds`
  (reuses `tickAuthorized`) → a DAILY Cloud Scheduler job `automation-reconcile-seeds` (02:07 UTC,
  automation.tf, same scheduler SA + existing run.invoker grant). Self-healing for dropped activation
  events too. **Verify:** automation-actions typecheck/lint clean + 15/15 (+2 reconcile:
  active-seeded/inactive-skipped + idempotent); automation-worker typecheck/lint clean + 6/6 (+2
  route: 403 + authorized backfill of a b2b tenant); `terraform fmt -check` + `validate` clean;
  prettier clean on all touched TS. Purely additive (new migration + new package export + new worker
  route + new TF job) — no existing export/behavior changed. **Next:** Slice F3 (retire the b2b cron,
  now unblocked — includes deleting `services/b2b-overdue-worker` + its TF, mirror same session) +
  the email-seed content fork once the user picks an approach.
