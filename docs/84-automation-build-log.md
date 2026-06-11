# Sparx Platform — Automation Feature Build Log

**Version:** 1.3
**Author:** Brandon Korous
**Last Updated:** 2026-06-10

---

## 0. What this doc is

The **living build state** for the Automation feature. The design lives in
[docs/81](81-automation-module.md) (engine) and [docs/82](82-event-bus-unification.md)
(event substrate); this doc tracks **what is actually built**, in what order, and
**where to resume** when context shifts. Update the status markers + the
`▶ RESUME HERE` pointer every working session.

Status legend: ☐ not started · ◐ in progress · ☑ done · ⃠ deferred/blocked

> **▶ RESUME HERE:** Slice F — module action executors, seed system automations,
> retire crons. Slices A + B + C + **D are DONE**. The worker
> (`services/automation-worker`) is built + green (4/4 e2e against docker as
> `sparx_app`): Cloud Scheduler tick → `runScheduleTick` + `runAutomationTick`,
> Pub/Sub push → `handleTrigger`, deployed via Cloud Run + a per-minute Cloud
> Scheduler job (Terraform in `terraform/envs/prod/automation.tf`). **The schedule
> tick is now LIVE-capable** — so the cron-replacement system automations need only
> Slice F (executors + seed), NOT the Slice E event fan-in.
>
> **Next (Slice F, in order):** (1) register the module action executors
> (`crm.add_tag` / `crm.create_task` / `email.send` / …) into the worker through
> the `registerAction` seam — until then a non-`platform.*` action fails its step
> with `UnregisteredActionError` (loud, by design). (2) Seed the Managed/Locked
> system automations (inactivity, dunning, win-back) via `upsertSystemAutomation`.
> (3) Parity-check against the cron outcome-tests, then DELETE the crons.
>
> **Slice E (event fan-in, docs/82)** is still required for EVENT-triggered
> automations to fire live (the push handler is wired + the subscription block is
> stubbed in `automation.tf`); it can land before or after F. F alone makes the
> scheduled sweeps live.
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

| Artifact                                                    | Purpose                                                                                                    | Status |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| `packages/automation-schemas` (`@sparx/automation-schemas`) | Zod schemas + types (trigger/condition/action/automation/gate)                                             | ☑      |
| `packages/automation` (`@sparx/automation`)                 | Engine: registries, evaluator, gates, executor, run state machine, service layer                           | ☑      |
| `services/automation-worker`                                | Cloud Run: Cloud Scheduler tick (schedule + run advance) + push consumer on `automation.trigger`           | ☑      |
| `packages/db` scan helpers                                  | `find_due_automation_runs` / `find_active_scheduled_automations` SECURITY DEFINER (cross-tenant discovery) | ☑      |
| `terraform/envs/prod/automation.tf`                         | Cloud Run service + Cloud Scheduler tick job + runtime/scheduler SAs (push sub deferred to E)              | ☑      |
| `packages/db` (3 tables)                                    | `automations` / `automation_runs` / `automation_run_steps` + RLS                                           | ☑      |
| `services/api-rest` routes                                  | `/v1/automations` CRUD + internal trigger/tick endpoints                                                   | ☐      |
| `apps/dashboard` surface                                    | List / detail / builder / run history (docs/34 standard)                                                   | ☐      |
| MCP write-tool                                              | AI authoring path (mirrors crm `mcp/write-tools.ts`)                                                       | ☐      |

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

### Slice E — Phase 0 event substrate (docs/82) ☐

- ☐ Canonical `EventType` superset in `@sparx/events`; api-core re-exports; delete local union
- ☐ `automation.trigger` topic + push sub (Terraform); tee from all 3 publish paths
  (api-core `publish`, `@sparx/events`, CRM `pubsub-bridge` — both bus wrappers)
- ☐ Net-new `[ADD]` events emitted + topics provisioned (email engagement, form.submitted,
  site.published, domain.verified, deal-stage, module.activated, webhook.received)
- ☐ `EventType` ↔ Terraform-topic parity test
- ☐ `__automationDepth` carried on the envelope

### Slice F — Phase 2 seed + retire crons ☐

- ☐ Re-express CRM sweep (5 behaviors) as Managed system automations
- ☐ Re-express B2B dunning ladder as Locked + Managed system automations
- ☐ Parity-verify vs existing engines (the outcome-tests already guard these), then DELETE crons
- ☐ Seed remaining default Managed automations (abandoned-cart, win-back, fulfilled→review)

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
