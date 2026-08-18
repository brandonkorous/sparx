# sparx Platform — Automation Module Spec

**Version:** 1.6
**Author:** Brandon Korous
**Last Updated:** 2026-06-11

---

## 1. Overview

The sparx Automation capability is a cross-module workflow engine built into the platform. It handles automations that span multiple sparx modules — the things external tools like Zapier and Make.com can't do well because they lack deep access to your unified data layer.

External automation platforms (Zapier, Make.com, n8n) are first-class integration partners for reaching outside sparx. They are not competitors to this engine — they are complementary. sparx Automations handles internal cross-module logic; Zapier handles external service connections.

It is built **on top of the machinery that already exists** — the typed Pub/Sub event bus (`@wizeworks/events`, [wizeworks/packages/api-core/src/pubsub.ts](../packages/api-core/src/pubsub.ts)), the durable outbound webhook engine ([wizeworks/packages/api-core/src/webhook-delivery.ts](../packages/api-core/src/webhook-delivery.ts)), and the daily Cloud Scheduler ticks ([wizeworks/packages/crm/src/schedulers/automation-triggers.ts](../packages/crm/src/schedulers/automation-triggers.ts)). It does not introduce a new queue runtime or a new delivery model.

**Module vs. platform capability.** Automations is **a platform-level capability, not a separately-gated module.** Any tenant with at least one active module that emits or consumes triggers gets it — there is no `automations` module slug to activate, no separate 404 gate, and the `automation-worker` always runs. (This is a deliberate exception to the "disabled module runs no workers" rule, because automations only have value _connecting_ other modules; gating them behind their own flag would be circular.) The dashboard surface is visible whenever ≥1 trigger-capable module is active.

**Included with:** Any active sparx module — no separate charge
**Volume metering:** see §11 (a business decision, not yet-built infra)
**Build timeline:** Month 4–5 (after core modules stable)

---

## 2. What This Is and Isn't

### What sparx Automations handles

```
✅ Triggers from any sparx module (order, CRM, email, inventory, etc.)
✅ Actions in any sparx module (send email, create task, update deal, etc.)
✅ Cross-module conditional logic (if/then)
✅ Durable delays and scheduled actions (survive redeploys — see §7)
✅ AI-assisted automation creation (describe in plain English → built for you)
✅ Execution history and error visibility
✅ Outbound webhooks to external URLs
✅ Inbound webhooks (trigger automations from external systems)
✅ Official Zapier, Make.com, and n8n connectors
```

### What sparx Automations does NOT handle

```
❌ Native integrations to Slack, Google Sheets, Asana, etc.
   → Use official Zapier/Make.com connectors for these
❌ Complex multi-branch flows (MVP: simple if/then chains)
❌ Sub-minute scheduling intervals
❌ Code execution (no custom JS/Python steps)
```

No code-execution steps is a deliberate, permanent constraint — consistent with the platform-wide rule that tenant-authored trees are **declarative and never execute arbitrary code** (same stance as tenant components). The automation rule is a typed JSON document; the AI assistant authors that document, and the engine validates it server-side.

The division is clean: **inside sparx** is the automation engine's job. **Outside sparx** is Zapier/Make's job. Tenants use both — they are complementary, not competing.

---

## 3. What Already Exists (Don't Rebuild)

sparx already runs a lot of automation-shaped machinery. It is the **starting material** for this engine, not a parallel runtime to preserve: its events feed the bus the engine consumes, and its fixed behaviors become the engine's seed **system automations** (§3.1). What exists today, verified in the repo:

```
Event substrate:
  → Typed Pub/Sub bus, one topic per event type
    wizeworks/packages/api-core/src/pubsub.ts + wizeworks/packages/events/src/types.ts
  → Durable outbound webhook delivery (HMAC, 8-attempt backoff, dead-letter)
    wizeworks/packages/api-core/src/webhook-delivery.ts
  → CRM two-bus bridge (CRM bus + platform bus → real Pub/Sub)
    wizeworks/packages/crm/src/pubsub-bridge.ts

Scheduled / triggered engines already shipped:
  → CRM daily trigger sweep (inactive, high-value, deal-closing, credit,
    quote-expiry) — wizeworks/packages/crm/src/schedulers/automation-triggers.ts
  → CRM segment membership evaluation
    wizeworks/packages/crm/src/consumers/segment-evaluator.ts (+ segment-projection.ts)
  → B2B overdue escalation cron (0/7/14/30-day dunning)
    services/b2b-overdue-worker/src/cron.ts
  → Email broadcasts + suppression
    wizeworks/packages/email-platform/src/services/{broadcast,suppression}-service.ts
  → Scheduled content publish — wizeworks/services/api-rest/src/lib/scheduled-publish.ts
```

> ⚠️ **Reality check before you cite "already built."** These are _event emitters and fixed-rule engines_, not tenant-configurable automations. There is no abandoned-cart "sequence builder," no lead-scoring UI, and no pipeline-stage automation UI today — those would either be this capability or live in their owning module. Don't list a feature here without a file to point at.

**What does NOT exist yet, and is the actual scope of this doc:** a tenant-facing, cross-module, user-defined rule engine — a place where a tenant says "when X happens and Y is true, do Z" across modules, with run history and an AI author. That's everything below.

### 3.1 One engine — every tenant-facing automation lives here (Locked / Managed / Custom)

**Scope.** This section is about **tenant-facing** behaviors — automations acting on the tenant's _own_ business: their customers, orders, B2B accounts, emails. sparx's own _operational_ automations (tenant provisioning, our billing, module-activation plumbing, infra) are a different thing entirely — they stay in core and are never surfaced here. Everything below is about the tenant's platform, not ours.

**Decision (supersedes the v1.1–v1.2 "mirror the cron" idea).** There is **one** automation runtime. We do **not** keep parallel hardcoded automation engines beside it. Every tenant-facing behavior shaped like an automation — _when X (event or schedule), if Y, do Z_ — is defined and executed on this engine, in one of three tiers:

- **Locked** — system-origin, non-disable-able. The tenant sees the full definition and run history but can't switch it off (e.g. credit-hold escalation, order-confirmation send).
- **Managed** — system-origin, disable-able + clonable. Opinionated defaults the tenant may turn off or **Duplicate to edit** (dunning cadence, 90-day inactivity, abandoned-cart, win-back, quote-expiry — e.g. the thresholds in [automation-triggers.ts:38-44](../packages/crm/src/schedulers/automation-triggers.ts#L38-L44)).
- **Custom** — tenant-authored from scratch.

All three are rows in `automations`, distinguished by `origin` + `locked` (§6). Same executor, same run log, same retry / idempotency / loop-guard, same observability — hardened once, shared by everything.

**Why one place, not two.** Two runtimes for the same behavior is a permanent tax — two places to fix a bug, two places to drift. The earlier drafts proposed keeping the crons and _mirroring_ them as read-only cards; that was wrong for the reason it sounds wrong: a mirror is a **second source of truth** that silently diverges from the cron it claims to describe. The card shouldn't _describe_ the automation — it **is** the automation.

**"Battle-tested" doesn't apply here, and the timing inverts it.** The hardcoded engines (`automation-triggers.ts`, `b2b-overdue-worker`) have zero production traffic and zero validated behavior — there is no known-good asset to protect, so "don't disturb working code" carries almost no weight on greenfield. And unification is _cheapest now_, before there's data, traffic, or coupling to migrate around; postponing it until after launch is exactly when it gets expensive. So those services are the engine's **first seed definitions** (re-expressed as Locked / Managed system automations), not a runtime to preserve. Build each behavior _as_ an automation once — never twice.

**The one real boundary: automations vs. inline invariants.** "One place for automations" is _not_ "cram everything into the engine." A few adjacent things are not automations **by shape** — they're invariants enforced inline in a code path, not _when→do_ workflows:

- **Email suppression / unsubscribe** — a filter applied _at send time_, not a triggered action.
- **Tax calculation** — computed _during_ checkout, not a reaction to it.
- **RLS** — a database invariant.

These stay as inline guards. (This is a _shape_ argument, not the discredited "battle-tested" one — suppression isn't an automation no matter how proven it is.) Everything that genuinely is _when→if→do_ — dunning, inactivity, abandoned-cart, deal-closing, quote-expiry, segment recompute — moves onto the one engine.

**"Duplicate to edit" is the onboarding superpower.** Because the system behaviors are real automations (not mirrors), a tenant can clone the 90-day-inactivity automation, retune it to 30 days, and ship — learning the whole model from a working example. Zapier/Make can't do this; they have no first-party behaviors to expose. The system-automation catalog _is_ the best template library (§9).

> **De-confliction.** When a tenant clones a Managed automation, the clone flow prompts "disable the system version?" so the customer doesn't get the behavior twice. One active source per behavior.

---

## 4. The AI Automation Assistant

The defining feature. Instead of a drag-and-drop canvas, tenants describe what they want and the assistant authors the typed rule (no code, validated server-side):

```
Tenant: "When a fleet customer hasn't ordered in 45 days,
         send them a re-engagement email and create a
         follow-up task for the sales team."

AI builds:
  TRIGGER:    Schedule · daily sweep (customer inactivity)
  CONDITION:  customer.type = 'fleet'
              AND days_since_last_order >= 45
  ACTION 1:   Email · Send campaign [Fleet Re-engagement]
  ACTION 2:   CRM · Create task
              Title: "Follow up — {{customer.name}} inactive 45d"
              Assigned to: Sales team
              Due: 3 days from now

[Preview automation]  [Edit]  [Activate]
```

```
Tenant: "After a B2B quote is approved, convert it to an
         invoice and notify the account manager."

AI builds:
  TRIGGER:    B2B · b2b.quote.responded
  CONDITION:  quote.status = 'approved'
  ACTION 1:   Commerce · Create invoice from quote
  ACTION 2:   Email · Send internal notification
              To: quote.assigned_staff
              Subject: "Quote approved — {{customer.name}}"

[Preview automation]  [Edit]  [Activate]
```

The AI reads the tenant's active modules and only offers triggers and actions from modules they have enabled. A tenant without B2B active never sees B2B triggers. A tenant without Email active never sees email-send actions. The assistant authors via an MCP write-tool, mirroring the builder/CRM `mcp/write-tools.ts` pattern, so the same authoring path is available to any AI agent — not just the dashboard.

---

## 5. Automation Structure

Every automation has four components:

```
TRIGGER       → What starts the automation
CONDITION     → Optional filter (run only if...)
ACTIONS       → What happens (one or more, in sequence)
SETTINGS      → Active/inactive, run limits, error handling
```

### 5.1 How triggers reach the engine (the fan-in)

> **Correction vs. v1.0.** There is **no wildcard subscription.** sparx provisions **one Pub/Sub topic per event type** and subscribers only see their own topic — both publishers say so explicitly ([pubsub.ts:1-7](../packages/api-core/src/pubsub.ts#L1-L7), [publisher.ts:1-6](../packages/events/src/publisher.ts#L1-L6)). `pubsub.subscribe('*')` cannot exist.

The engine consumes a single **fan-in topic** — `automation.trigger` — that every publish path _also_ tees into, carrying the original event type as a message attribute. This is exactly the pattern the CRM bridge already uses to tee two buses into Pub/Sub for the commerce-indexer ([pubsub-bridge.ts](../packages/crm/src/pubsub-bridge.ts)). The tee must be installed at **all three publish paths**, because the bus is fragmented today:

1. `api-core`'s `publish()` — does webhook-enqueue **and** Pub/Sub ([pubsub.ts:154-188](../packages/api-core/src/pubsub.ts#L154-L188))
2. `@wizeworks/events`'s publisher — Pub/Sub only (used by standalone workers)
3. CRM's `publishCrmEvent` — its own two-bus path

The `automation-worker` is a **Cloud Run push consumer** on `automation.trigger` (per the `cloud-run-worker` default), not a GKE pod and not a long-lived `subscribe()` loop.

> **Prerequisite — reconcile the event registry.** The two `EventType` unions have drifted: [api-core/pubsub.ts:22-71](../packages/api-core/src/pubsub.ts#L22-L71) is missing `order.paid`, `cart.abandoned`, `inventory.low`, and the whole `b2b.*` set that [events/types.ts](../packages/events/src/types.ts) carries. The fan-in must tap a **superset**, so reconciling these into one canonical registry is a Phase-0 task, not an afterthought.

### 5.2 Triggers

All triggers come from the sparx event bus or the scheduler. Triggers are annotated **[exists]** (an event type is already published) or **[ADD]** (the event must be emitted + its topic provisioned in Terraform before the trigger is real).

**Commerce triggers:**

- Order placed `order.placed` **[exists]**
- Order paid `payment.captured` **[exists]**
- Order fulfilled `order.fulfilled` **[exists]**
- Order cancelled / refunded `order.cancelled` / `order.refunded` **[exists]**
- Cart abandoned `cart.abandoned` **[exists]**
- Inventory below threshold `inventory.low` **[exists]**
- Product published / unpublished **[ADD]** (only `product.created/updated/deleted` exist)

**CRM triggers:**

- Customer created / updated `crm.customer.*` **[exists]**
- Segment membership changed `crm.segment.entered` **[exists]**
- Deal updated `crm.deal.updated` **[exists]**
- Deal stage-specific (won / lost / stage changed) **[ADD]**
- LTV / high-value threshold (via daily sweep) **[exists]**

**Email triggers:**

- Opened / clicked / bounced / unsubscribed **[ADD]** — these arrive via the Mailgun webhook into `email-platform`'s webhook-service today; they are **not** bus events. Promote to bus topics first.

**B2B triggers:**

- Quote submitted / responded `b2b.quote.*` **[exists]**
- Invoice overdue `b2b.invoice.overdue` **[exists]**
- Account credit hold / suspended `b2b.account.*` **[exists]**
- PO received **[ADD]**

**CMS triggers:**

- Page / entry published `content.entry.published` **[exists]**
- Form submitted **[ADD]**

**Builder triggers:**

- Site published / unpublished **[ADD]**
- Domain purchased `domain.purchased` **[exists]**; generic "domain verified" **[ADD]**

**Platform triggers:**

- Tenant signup `tenant.created` **[exists]**
- Module activated / deactivated **[ADD]** (consumed in CRM today, not a first-class bus topic)
- Inbound webhook received `webhook.received` **[ADD]** (see §10)

**Scheduled triggers** (reuse the existing daily Cloud Scheduler tick; sub-minute excluded):

- Every day at [time]
- Every week on [day] at [time]
- Every month on [day] at [time]
- One time at [date/time]

> **Scheduled triggers run a predicate, not just a clock.** "Customer inactive 45 days" has no per-record event — inactivity is the _absence_ of activity, detectable only by a scan. So a scheduled trigger is a `(schedule, query)` pair: on each tick the engine runs the predicate for the tenant and starts **one run per matched row**. This is exactly what `runDailyAutomationTriggers(ctx)` does today ([automation-triggers.ts:56-73](../packages/crm/src/schedulers/automation-triggers.ts#L56-L73)) — in the unified model (§3.1) that becomes a set of scheduled system automations rather than a bespoke service.

### 5.3 Conditions

> **Correction vs. v1.0.** Event payloads are **thin IDs**, not rich records. The CRM sweep emits `{ customerId, reason, daysInactive }` ([automation-triggers.ts:87-93](../packages/crm/src/schedulers/automation-triggers.ts#L87-L93)) — there is no `customer.type` or `order.total` on the wire. So a condition like `customer.type = 'fleet'` requires the engine to **hydrate** the referenced entity from the database first.

The engine carries an **entity resolver registry**: a small, per-entity-type function that, given the IDs on the trigger event, loads the canonical record (under `withTenant`, RLS-scoped) and exposes a flat, documented field set for condition evaluation. Conditions reference **resolved fields**, never raw payload keys. The AI assistant only offers fields the resolver actually exposes.

```typescript
interface Condition {
  field: string; // resolver-exposed path, e.g. 'customer.type' | 'order.total'
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'contains'
    | 'not_contains'
    | 'in'
    | 'not_in'
    | 'is_set'
    | 'is_not_set';
  value: unknown;
}

// A group combines leaf conditions AND/OR nested sub-groups, so a rule can express
// mixed precedence like `A AND (B OR C)`. Nesting is bounded (MAX_CONDITION_DEPTH =
// 3 levels) and the schema is built as explicit finite levels (NOT z.lazy), so it
// stays a finite, $ref-free JSON-Schema — safe for REST validation AND MCP tool
// registration. A flat (all-leaf) group is the original shape, so existing stored
// automations parse unchanged.
interface ConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (Condition | ConditionGroup)[]; // a child may be a nested sub-group
}
```

### 5.4 Actions

Actions run in sequence. If one fails, subsequent actions are skipped and the error is logged (with a per-step record — §6).

> **Correction vs. v1.0.** Mutating actions **call existing services**; they never re-implement domain logic. Anything that bulk-mutates priced or financial data routes through the established service **and** the `bulk_op_reverts` revert ledger + destructive-action confirm rails (e.g. "apply discount" reuses `bulkPriceService`). An automation must not become a back door around the safety rails the dashboard already enforces.

**Email actions:** send campaign to customer · send internal notification to staff · add/remove from sequence (all publish `email.send` or its sequence equivalent — never direct-send except OTP).

**CRM actions:** create task · update deal stage · add note · add/remove customer tag · update customer field.

**Commerce actions:** create invoice (from order or standalone) · apply discount (via `bulkPriceService` + revert ledger) · update inventory quantity · create order (B2B reorder).

**B2B actions:** create quote · convert quote to invoice · update account terms.

**Platform actions:** send outbound webhook (POST to external URL) · **Wait** (durable delay — persists `resume_at`, see §7) · **Stop** (end automation, log reason).

---

## 6. Data Model

> **Correction vs. v1.0.** This is authored as **Prisma schema + a hand-edited RLS migration** (per the `db-migration` skill), _not_ raw DDL. Every tenant-scoped table gets `ENABLE` **and** `FORCE` RLS plus a `tenant_isolation` policy. The illustrative SQL below includes that — and `automation_run_steps` now carries its own `tenant_id` (a join alone cannot satisfy FORCE RLS).

New idempotency / durability columns vs. v1.0 are flagged inline.

```sql
CREATE TABLE automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
                  -- draft | active | paused | error
  trigger_type    VARCHAR(100) NOT NULL,
                  -- 'order.placed' | 'crm.deal.updated' | 'schedule.daily' ...
  trigger_config  JSONB NOT NULL DEFAULT '{}',
  conditions      JSONB NOT NULL DEFAULT '[]',
  actions         JSONB NOT NULL DEFAULT '[]',
                  -- [{ type, config, delay_seconds }]
  ai_generated    BOOLEAN NOT NULL DEFAULT false,
  ai_prompt       TEXT,
  origin          VARCHAR(10) NOT NULL DEFAULT 'user',   -- NEW: user | system (§3.1)
  locked          BOOLEAN NOT NULL DEFAULT false,         -- NEW: system + non-disable-able (§3.1)
  cloned_from     UUID REFERENCES automations(id),        -- NEW: "Duplicate to edit" lineage
  max_depth       SMALLINT NOT NULL DEFAULT 3,  -- NEW: loop-guard ceiling (§7)
  run_count       INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  last_error_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE automation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id     UUID NOT NULL REFERENCES automations(id),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  trigger_event     JSONB NOT NULL,
  dedupe_key        TEXT NOT NULL,                 -- NEW: at-least-once guard (§7)
  cause_depth       SMALLINT NOT NULL DEFAULT 0,   -- NEW: cascade depth (§7)
  status            VARCHAR(20) NOT NULL DEFAULT 'running',
                    -- running | waiting | completed | failed | skipped
  cursor_index      INTEGER NOT NULL DEFAULT 0,    -- NEW: next action to run
  resume_at         TIMESTAMPTZ,                   -- NEW: durable-delay wake time
  actions_total     INTEGER NOT NULL,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  UNIQUE (automation_id, dedupe_key)               -- NEW: dedupe
);

CREATE TABLE automation_run_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES automation_runs(id),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),  -- NEW: RLS needs this
  action_index    INTEGER NOT NULL,
  action_type     VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                  -- pending | running | completed | failed | skipped | gated
  input           JSONB,
  output          JSONB,
  error           TEXT,
  gate_log        JSONB,  -- NEW: [{ gate, decision, reason }] policy-decision audit (§7.1)
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

-- RLS: ENABLE + FORCE + tenant_isolation on all three (hand-edited, not Prisma).
ALTER TABLE automations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations          FORCE  ROW LEVEL SECURITY;
ALTER TABLE automation_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs      FORCE  ROW LEVEL SECURITY;
ALTER TABLE automation_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_run_steps FORCE  ROW LEVEL SECURITY;
-- one policy per table:
--   CREATE POLICY tenant_isolation ON <t>
--     USING (tenant_id = current_tenant_id())
--     WITH CHECK (tenant_id = current_tenant_id());
```

---

## 7. Execution Engine

> **Rewritten vs. v1.0** to match how sparx actually runs work: a Cloud Run push consumer on the fan-in topic, a **durable, resumable** run state machine (no parked promises), and the advisory-lock tick pattern proven by `webhook-delivery.ts`. **No `subscribe('*')`. No BullMQ** — BullMQ appears in no sparx code; the platform's async substrate is Pub/Sub + Cloud Run + advisory-lock loops.

`services/automation-worker/` (Cloud Run push, `cloud-run-worker` TF module):

```typescript
// 1) INGEST — Cloud Run push handler on the single fan-in topic.
//    Matching + condition eval happen here; execution is handed to the
//    durable run table, NOT an in-memory queue.
export async function handleTrigger(envelope: SparxEvent): Promise<void> {
  const { type, tenantId } = envelope;

  await withTenant({ tenantId }, async (tx) => {
    const automations = await tx.automation.findMany({
      where: { status: 'active', triggerType: type },
    });

    for (const a of automations) {
      // Loop guard: refuse to spawn beyond the automation's max_depth.
      const depth = (envelope.data.__automationDepth as number | undefined) ?? 0;
      if (depth >= a.maxDepth) {
        await logSkipped(tx, a.id, envelope, 'max_depth_exceeded');
        continue;
      }

      // Hydrate the referenced entity, then evaluate conditions against
      // RESOLVED fields (not raw payload).
      const entity = await resolveEntity(tx, type, envelope.data);
      if (!evaluateConditions(a.conditions, entity)) {
        await logSkipped(tx, a.id, envelope, 'condition_not_met');
        continue;
      }

      // Idempotent insert: (automation_id, dedupe_key) is UNIQUE, so an
      // at-least-once redelivery collapses to one run.
      await tx.automationRun.upsert({
        where: {
          automationId_dedupeKey: { automationId: a.id, dedupeKey: dedupeOf(envelope) },
        },
        create: {
          automationId: a.id,
          tenantId,
          triggerEvent: envelope,
          dedupeKey: dedupeOf(envelope),
          causeDepth: depth,
          status: 'running',
          cursorIndex: 0,
          actionsTotal: a.actions.length,
        },
        update: {}, // already enqueued — no-op
      });
    }
  });
}

// 2) ADVANCE — advisory-lock tick (mirrors runWebhookDeliveryTick): picks up
//    runs that are 'running' OR ('waiting' AND resume_at <= now), executes
//    actions from cursor_index forward, and PERSISTS progress after each step.
export async function runAutomationTick(logger: Logger): Promise<void> {
  if (!(await tryAdvisoryLock(AUTOMATION_TICK_LOCK))) return;
  try {
    const due = await selectDueRuns(100); // 'running' or wake-due 'waiting'
    for (const run of due) {
      await withTenant({ tenantId: run.tenantId }, async (tx) => {
        const a = await tx.automation.findUnique({ where: { id: run.automationId } });
        for (let i = run.cursorIndex; i < a.actions.length; i++) {
          const action = a.actions[i];

          // Durable delay: instead of sleeping the process, park the run.
          if (action.type === 'wait') {
            await tx.automationRun.update({
              where: { id: run.id },
              data: {
                status: 'waiting',
                cursorIndex: i + 1,
                resumeAt: new Date(Date.now() + action.delaySeconds * 1000),
              },
            });
            return; // a later tick resumes it
          }

          try {
            const out = await executeAction(tx, action, run); // gated dispatch (§7.1) → existing services
            await logStepCompleted(tx, run.id, i, out);
            await tx.automationRun.update({
              where: { id: run.id },
              data: { cursorIndex: i + 1 },
            });
          } catch (err) {
            await logStepFailed(tx, run.id, i, err);
            await tx.automationRun.update({
              where: { id: run.id },
              data: { status: 'failed' },
            });
            return; // stop on first failure
          }
        }
        await completeRun(tx, run.id);
      });
    }
  } finally {
    await releaseAdvisoryLock(AUTOMATION_TICK_LOCK);
  }
}
```

Key properties this buys, all matching existing platform patterns:

- **Durable delays** — a "Wait 24h" parks the run (`status='waiting'`, `resume_at`) and a later tick resumes it. A redeploy or scale-to-zero is harmless; nothing is held in memory.
- **Idempotency** — Pub/Sub is at-least-once, so a redelivery collapses on the `(automation_id, dedupe_key)` unique index.
- **Loop / cascade guard** — actions that emit events stamp `__automationDepth + 1`; the engine refuses past `max_depth`, so rule A → event → rule B → … can't run away.
- **Tenant safety / origin-scoped execution** — every read/write is inside `withTenant` under FORCE RLS, exactly like the existing schedulers and webhook tick. The scheduler iterates active tenants and invokes each scheduled automation once per tenant — what `runDailyAutomationTriggers(ctx)` already does. The rare action needing owner context + per-tenant `set_config` (e.g. recompute credit-used) is flagged on the action, not the default — never a blanket cross-tenant bypass.

### 7.1 Gated execution (mandatory policy layer)

The invariant set on a platform like this only grows — consent, quiet hours, frequency caps, regional send rules, spend limits, embargoed SKUs. They must not land as scattered inline `if` checks; that re-creates the divergence the one-engine decision (§3.1) removed. Instead, **every action passes a gate chain by construction.**

**Gate vs. condition — different owners, different mutability.**

- **Condition** (§5.3) is _tenant intent_: "should this rule run for this record." The author writes, edits, and removes it.
- **Gate** is a _platform guardrail_: "is this effect permitted, right now, for this tenant." The platform owns it; the author cannot edit or remove it. Gates are the Locked layer made structural — conditions are subtractive (the tenant narrows), gates are non-negotiable (the platform constrains).

**Two enforcement points, one contract.**

1. **Capability-boundary gate (the backstop).** Suppression / tax live on the _capability_ (the send / charge service), so they protect **every** caller — automation, dashboard, API, MCP. Automation actions are thin calls into those same gated services; the engine never re-implements the effect, so it cannot bypass the gate.
2. **Workflow gate (the `{gated}` step).** Before dispatch the engine runs its own chain for policies about the _automation acting_ — loop-guard, quiet hours, frequency caps, per-tenant rate limits, kill-switch, module-active.

**The contract is richer than allow/deny** — a gate can _shape_ an effect, not only veto it (suppression filters a recipient list; tax annotates an amount; quiet-hours parks the run via the §7 `resume_at`):

```ts
type GateResult =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string } // policy skip — NOT a failure
  | { kind: 'transform'; input: EffectInput } // suppression filters; tax annotates
  | { kind: 'defer'; resumeAt: Date; reason: string }; // quiet hours → park & resume

type Gate = (ctx: TenantCtx, effect: EffectInput) => Promise<GateResult>;
```

**Mandatory _by rule_, not by discipline.** Four structural guarantees:

1. **The gated dispatcher is the only path to an effect.** Handlers are never called directly; the engine reaches them solely through `dispatch()`, which always runs the chain. No ungated path exists — including for an action written tomorrow.
2. **Every action descriptor declares a gate manifest — empty is allowed but must be _explicit and justified_, never silent.** A descriptor with no manifest field fails registration. The _declaration_ is mandatory; its contents may be empty for now: `gates: [] // reviewed: pure internal tag write, no external effect`.
3. **A global gate chain runs first, for every action** — loop-guard, tenant-active, module-active, kill-switch — so even a zero-gate action is gated.
4. **A structural test asserts coverage** — every registered action type has a manifest entry (CI-enforced, like the module-slug lists). The payoff: add a suppression gate to the "email capability" class once, and **every current and future email action inherits it retroactively, with no call-site edits.**

**`deny` is not `failed`.** A gate-denied step records status `gated` with the gate name + reason (`gate_log`, §6) — distinct from `failed` and `skipped`. A Locked automation that's suppression-denied did its job correctly; the run history shows "blocked by suppression policy." That log doubles as the **compliance audit trail** (proof you checked CAN-SPAM / tax and what you decided) and honors transparency-over-magic — gates are loud, never silent drops.

**Guardrail against over-build:** gates are small, single-concern, typed functions in a registry — **not** a general policy DSL (no OPA/Rego). The moment "the gate engine" needs its own authoring UI, it has become a second product. Keep them as code, composable, and dumb.

Universal gating is a dividend of the one-engine decision: one dispatcher means each policy is enforced once and inherited by Locked, Managed, and Custom alike — instead of N times across N engines.

---

## 8. Dashboard UI

### Automation List

```
Automations

[+ New automation]  [Ask AI to build one]

Active (8)    Paused (2)    Draft (3)    Errors (1)

Fleet Re-engagement          CRM + Email    Active    847 runs  ✓
  Last run: 2 hours ago

Quote → Invoice Auto-convert  B2B + Commerce Active   124 runs  ✓
  Last run: 1 day ago

VIP Customer Alert            CRM            Paused    —
  Paused by you on Jun 3

New Customer Welcome          Email          ERROR     ↑ fix
  Failed: Email template deleted
```

### Automation Detail / Builder

Two views: **Visual** (for reviewing) and **AI chat** (for building):

```
Fleet Re-engagement Automation

TRIGGER
  Schedule · daily inactivity sweep

CONDITION
  customer.type = 'fleet'
  AND days_since_last_order >= 45

ACTIONS
  1. ⏱ Wait 24 hours          (durable — parks the run)
  2. 📧 Send email · Fleet Re-engagement Campaign
  3. ✓  Create CRM task
        "Follow up — {{customer.name}} inactive 45d"
        Assigned to: Sales team · Due: 3 days

[Edit]  [Pause]  [View runs]
```

### Execution History

```
Run history · Fleet Re-engagement

#847  Ranchero Trucking Co.   Completed   2h ago    ✓ all 3 steps
#846  Pacific Forge Logistics  Completed  6h ago    ✓ all 3 steps
#845  Northwind Supply         Failed     8h ago    ✗ step 2: template missing
#844  Halcyon & Reed           Skipped    1d ago    ~ condition not met (22 days)
```

Run detail shows each step, input/output data, timing, and errors — enough to debug any failure without guessing. This follows the docs/34 working-area standard (PageHeader / FilterBar / detail view), like every other list+detail surface.

---

## 9. Automation Templates Library

Pre-built automations a tenant can activate in one click — the same shape as Tenant Blueprints (`@wizeworks/blueprints`): a declarative, versioned, parameterized definition that expands into a real `automations` row on install.

```
Popular templates:

Commerce
  → Abandoned cart recovery (3-email sequence)
  → Low inventory alert to staff
  → Order fulfilled → request review

CRM
  → New customer → welcome task for sales
  → Deal won → create invoice automatically
  → Customer inactive 90 days → re-engagement

B2B
  → Quote approved → convert to invoice
  → Fleet reorder reminder (usage-based)
  → Net terms overdue → escalation sequence

AI-generated (new)
  → Describe your workflow → AI builds it
```

Templates are starting points — tenants customize them before activating. A template referencing a not-yet-enabled module is shown but greyed, with a one-line "activate the X module to use this."

The strongest "templates" aren't hypothetical — they're the **read-only system automations from §3.1**, already running on the tenant's real data. Each Managed one carries a **Duplicate to edit** action that forks it into a `user`-origin, editable automation (`cloned_from` set). Learning by cloning something that already works beats authoring from a blank canvas, and it's a transparency win Zapier/Make can't match.

---

## 10. External Integrations

### Official Zapier App

Published in Zapier's app directory. Handles all external service connections. Built over the existing REST API + the durable outbound webhook engine — Zapier triggers subscribe to `WebhookSubscription` rows; Zapier actions call documented API endpoints.

**Triggers available in Zapier:** new order placed · order status changed · new customer created · deal stage changed · invoice paid · form submitted · inbound webhook (catch-hook).

**Actions available in Zapier:** create customer · create order · update deal stage · send email campaign · create invoice · create CRM task.

### Official Make.com App

Same trigger/action set as Zapier, in Make.com's module format.

### Inbound Webhooks

Tenants get a unique webhook URL they can give to any external system:

```
POST https://api.sparx.works/webhooks/tenant/{tenant_id}/{webhook_id}
Authorization: Bearer {webhook_secret}

Body: any JSON payload

→ Fires automation trigger: 'webhook.received'   [ADD — new event type]
→ Payload available (via the resolver) to automation conditions + actions
```

This lets any external system (ERP, POS, custom app) trigger sparx automations without Zapier. The `webhook.received` event is **net-new** (§5.2) and must be added with its topic before this works.

---

## 11. Pricing

Automations are included with any active sparx module. No separate charge. Charging for automations would mean the platform doesn't fully work without paying an extra fee — that's a worse product, not a different tier. The modules are what you pay for; automations are how those modules talk to each other.

```
Included with any active module:
  Unlimited automations (draft, active, paused)
  Full execution history (30-day retention)
  AI automation assistant
  Official Zapier + Make.com connectors
  Inbound webhook triggers
  Automation templates library
```

> **Open decision — volume metering is not free to build.** A "50,000 runs/mo included, $1 per additional 10,000" overage would introduce **consumption-based billing the platform does not have today**, and it sits in slight tension with the "modules, not plans — no usage tiers" principle. Treat metering as a **deferred, optional** add-on with its own metering + invoicing work, not a launch requirement. Ship the capability flat-rate-included first; revisit metering only if a tenant's run volume actually threatens unit economics.

---

## 12. Implementation Checklist

> **This engine is foundational, not a late feature.** Because core tenant behaviors _are_ automations (§3.1), the engine + gate layer must exist before the things that depend on it, and it **replaces** the hardcoded crons rather than sitting beside them. The phases below are ordered by **dependency, not calendar** — Phase 0–2 are the platform substrate; UI, AI, and external connectors layer on after.

### Phase 0 — Event substrate (blocking prerequisite → docs/82)

- [ ] Unify the divergent `EventType` unions into one canonical registry in `@wizeworks/events` (docs/82 §3)
- [ ] Provision the `automation.trigger` fan-in topic + tee it from all three publish paths — api-core `publish`, `@wizeworks/events`, CRM `pubsub-bridge` (docs/82 §3.3)
- [ ] Emit the net-new `[ADD]` trigger events + provision their topics (email engagement, `form.submitted`, `site.published`, `domain.verified`, deal-stage, `module.activated`, `webhook.received`) (docs/82 §4)
- [ ] `EventType` ↔ Terraform-topic parity test (docs/82 §6)
- [ ] Confirm the platform-capability (not gated module) stance (§1)

### Phase 1 — Foundational engine + gate layer

- [ ] `automations` / `automation_runs` / `automation_run_steps` via Prisma + hand-edited RLS (ENABLE+FORCE+tenant_isolation; `tenant_id` on all three; `origin`/`locked`/`cloned_from`; `gated` status + `gate_log`)
- [ ] `services/automation-worker` — Cloud Run push consumer on `automation.trigger`
- [ ] **Gated dispatcher** — the only path to an effect; global gate chain + per-action gate manifest (empty must be explicit); `GateResult` allow/deny/transform/defer; CI coverage test (§7.1)
- [ ] Entity resolver registry (hydrate fields for conditions) (§5.3)
- [ ] Condition evaluator (all operators, AND/OR)
- [ ] Action executor — thin calls into the gated capability services; bulk-mutations via the revert ledger (§5.4)
- [ ] Scheduled-predicate trigger class — `(schedule, query)` → one run per matched row (§5.2)
- [ ] Durable run state machine + advisory-lock tick (`resume_at`, `cursor_index`)
- [ ] Idempotency (`dedupe_key` unique) + loop guard (`cause_depth` / `max_depth`)
- [ ] Run + per-step history logging (incl. gate decisions)

### Phase 2 — Seed system automations + retire the crons

- [ ] Re-express the CRM sweep (`automation-triggers.ts`: inactive, high-value, deal-closing, credit-near-limit, quote-expiry) as Managed system automations
- [ ] Re-express the B2B dunning ladder (`b2b-overdue-worker`: 0/7/14/30-day → overdue / credit-hold / suspend) as Locked + Managed system automations
- [ ] Parity-verify against the existing engines, then **delete the crons** (no parallel runtime)
- [ ] Seed the remaining default Managed automations (abandoned-cart, win-back, order-fulfilled → review)

### Phase 3 — Dashboard UI

- [ ] Automation list with Locked / Managed / Custom tiers + status (docs/34 standard)
- [ ] Read-only system-automation viewer + **Duplicate to edit** (forks to `user` origin)
- [ ] Custom automation builder (trigger + conditions + actions)
- [ ] Execution history with per-step detail, including `gated` (policy-blocked) outcomes
- [ ] Error-state UI with fix suggestions
- [ ] Template library sourced from the system-automation catalog (§9)
- [ ] Pause / resume / delete (delete behind `useConfirm`; Locked cannot be disabled)

### Phase 4 — AI assistant

- [ ] AI automation authoring from natural language (MCP write-tool)
- [ ] AI reads active modules + resolver-exposed fields + applicable gates (offers only valid options)
- [ ] Preview before activation
- [ ] AI suggests fixes for failed / gated automations

### Phase 5 — External integrations

- [ ] Official Zapier app (published)
- [ ] Official Make.com app
- [ ] Inbound webhook endpoints + `webhook.received` event
- [ ] n8n connector (community maintained)

### Phase 6 — Advanced

- [ ] Multiple branches (if/else)
- [ ] Loop actions (for-each over a collection)
- [ ] Extended run-history retention
- [ ] Automation usage analytics
- [ ] (If approved) volume metering + overage billing (§11)
