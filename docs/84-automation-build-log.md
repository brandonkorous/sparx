# Sparx Platform — Automation Feature Build Log

**Version:** 1.0
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

> **▶ RESUME HERE:** Slice C — engine core (`@sparx/automation`). Slices A + B
> are DONE: schemas package (7/7 tests) + data model (3 tables, RLS, migration
> `20260730000000_automation_engine` applied to docker, 0 drift, client regen'd).
> Next: scaffold `packages/automation` — trigger registry, entity resolver,
> condition evaluator, **gated dispatcher** (§7.1), action executor, `handleTrigger`
>
> - `runAutomationTick` durable run state machine, service layer. Test against
>   docker DB with synthetic envelopes. Build incrementally (resolver+evaluator
>   first, then gates, then run machine).

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

| Artifact                                                    | Purpose                                                                          | Status |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| `packages/automation-schemas` (`@sparx/automation-schemas`) | Zod schemas + types (trigger/condition/action/automation/gate)                   | ☑      |
| `packages/automation` (`@sparx/automation`)                 | Engine: registries, evaluator, gates, executor, run state machine, service layer | ☐      |
| `services/automation-worker`                                | Cloud Run push consumer on `automation.trigger` + advisory-lock tick             | ☐      |
| `packages/db` (3 tables)                                    | `automations` / `automation_runs` / `automation_run_steps` + RLS                 | ☑      |
| `services/api-rest` routes                                  | `/v1/automations` CRUD + internal trigger/tick endpoints                         | ☐      |
| `apps/dashboard` surface                                    | List / detail / builder / run history (docs/34 standard)                         | ☐      |
| MCP write-tool                                              | AI authoring path (mirrors crm `mcp/write-tools.ts`)                             | ☐      |

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

### Slice C — engine core (`@sparx/automation`) — Phase 1 ☐

- ☐ Trigger registry / catalog (event + schedule kinds; module ownership)
- ☐ Entity resolver registry (hydrate fields under `withTenant` — §5.3)
- ☐ Condition evaluator (all operators, AND/OR, against resolved fields)
- ☐ **Gated dispatcher** — only path to an effect; global chain + per-action manifest
  (empty must be explicit); `GateResult` allow/deny/transform/defer; coverage test (§7.1)
- ☐ Action executor — thin calls into gated capability services; bulk via revert ledger
- ☐ `handleTrigger` — match active automations, loop-guard, hydrate, eval, idempotent upsert
- ☐ `runAutomationTick` — advisory-lock tick, cursor advance, durable `wait`, fail-stop
- ☐ Scheduled-predicate trigger class — `(schedule, query)` → one run per matched row
- ☐ Service layer — automation CRUD (create/update/pause/clone "Duplicate to edit")
- ☐ Run + per-step history logging (incl. `gated` decisions + `gate_log`)
- ☐ Integration tests against docker DB with synthetic envelopes

### Slice D — `services/automation-worker` ☐

- ☐ Cloud Run push handler → `handleTrigger`
- ☐ Tick endpoint (Cloud Scheduler) → `runAutomationTick`
- ☐ env.ts, Dockerfile (COPY closure), `cloud-run-worker` TF module (Slice E)

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
  Next session resumes at Slice C (engine core).
