# 124 — Activity, Jobs & Notifications: the awareness layer

Version: 1.4.0
Author: Brandon Korous
Last Updated: 2026-07-19

> **Names.** _Awareness layer_ is the internal/architecture name (this doc). The
> product-facing surface is **Pulse** — the live view a tenant opens to see their
> business breathing: the activity feed, the running-jobs tray, and the
> notification center. The one term Pulse does **not** absorb is **Audit** — the
> cold, complete forensic ledger keeps its own name and lives in a
> security/settings context, because dressing a diff-and-IP record as a
> "heartbeat" would be dishonest. Pulse is the warm human view; Audit is the
> forensic view of the same substrate. The existing workbench `usePulse`
> heartbeat is **Pulse v0** — this layer absorbs and grows it, it isn't a
> collision.
>
> **Surfaces = workbench, always.** `sparx/apps/workbench` is the staff app going
> forward; `apps/dashboard` is legacy and gets no new work (see
> [[project_workbench_replaces_dashboard]]). Every UI target here — the jobs
> tray, the Pulse surface, the notification center — is built in the workbench.
> The dashboard's poll-and-merge "Recent activity" is named only as a
> current-state anti-pattern; it retires by attrition with the app, it is not
> re-pointed. The read-spine (`GET /v1/jobs`, `/v1/activity`, `/v1/notifications`)
> stays app-agnostic so admin/operator reuses it later.

## Purpose

Three questions a person operating a sparx tenant asks constantly, and one more
their WizeWorks operator asks across all tenants:

- **"Is something running?"** — I kicked off an import / a bulk price change /
  a sync and walked away. Did it finish? Did it fail?
- **"What happened?"** — who changed this product, when did that order refund,
  what did my teammate publish while I was out?
- **"What needs me?"** — a payment failed, stock hit zero, a job errored, a
  customer is waiting in chat. Surface it before I go looking.

Today each of these is answered by a **different, incomplete, or missing**
mechanism, and two of the surfaces we ship (the workbench pulse, the dashboard
home "Recent activity") _reinvent_ a log we already keep by polling list
endpoints instead of reading it. This doc defines the **awareness layer**: one
coherent set of systems that answers all three for both audiences, built on the
event substrate we already own.

The trigger was concrete: the workbench status bar needs a "jobs running" chip
and there was no unified way to ask "what jobs are running." That gap is one
face of a larger missing layer — this doc addresses the layer, and the status
bar becomes its first surface.

## The vocabulary problem (read this first)

**"Activity" is currently overloaded four ways** — shopper realtime activity
([docs/96](96-realtime-product-activity.md)), CRM activity (`CrmActivity`), the
dashboard home "Recent activity" card, and the audit trail. That ambiguity is
itself a source of drift. This layer commits to **four precise terms**, and
they are used exactly this way everywhere from here forward:

| Term             | Definition                                                                                                                                                                                   | The question             | Read/write                               | System of record                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| **Job**          | A unit of async background work with a lifecycle (`queued → running → done \| failed`) and progress. Someone starts it and leaves.                                                           | "Is it running?"         | Written by producers, polled by surfaces | Per-domain run ledgers (`ImportJob`, `AutomationRun`, …)                               |
| **Audit**        | The immutable, complete forensic record of every state change: actor, action, entity, before/after diff, IP, UA.                                                                             | "Who did what, exactly?" | Append-only, machine-complete            | `AuditLog`                                                                             |
| **Activity**     | A curated, human-readable **feed** — a projection _over_ audit + events, scoped to an entity or the whole tenant. Not every audit row is activity; not every activity line is one audit row. | "What's been going on?"  | Read-only projection                     | derived (no table of its own; `CrmActivity` is a domain-specific pre-materialized one) |
| **Notification** | A **directed, actionable** item for a specific person, with read/unread state and a delivery channel.                                                                                        | "What needs me?"         | Derived from events by rules, per-user   | `Notification` (new)                                                                   |

The distinction that matters most: **Audit is the ledger; Activity is a view of
it.** We do not build an "activity table" — we build audit coverage plus
projections. And **Notification ≠ Activity** — a notification is addressed to a
person and demands a decision (read it, act on it); an activity line is ambient
context nobody has to acknowledge.

## The layered model

```
┌─────────────────────────────────────────────────────────────────┐
│ 4. SURFACES    jobs tray · activity feed · notification center    │
│                entity timelines · status-bar chips · admin views  │
├─────────────────────────────────────────────────────────────────┤
│ 3. READ-SPINE  GET /v1/jobs · GET /v1/activity · GET /v1/          │
│    (MISSING)    notifications — normalize ledgers → common DTOs    │
├─────────────────────────────────────────────────────────────────┤
│ 2. LEDGERS     AuditLog · CrmActivity · Notification(new) ·        │
│                ImportJob · AutomationRun · InventorySyncRun ·      │
│                BulkOpRevert · MarketSettlementRun · PartnerPayoutRun│
├─────────────────────────────────────────────────────────────────┤
│ 1. SUBSTRATE   the Pub/Sub EventType catalog (~200 events),        │
│    (mature)     already teed into the automation fan-in            │
└─────────────────────────────────────────────────────────────────┘
```

**We own layers 1 and 2. The whole gap is layer 3, and most of layer 4.** This
is the central insight: the expensive part (a reliable event firehose, durable
ledgers, RLS) exists. What's missing is the thin read layer that answers across
ledgers, and the surfaces that consume it.

## Current state — grounded inventory

### Jobs — one real table, several run-ledgers, no unified read

- `ImportJob` / `ImportJobRow` ([schema 55](../packages/db/prisma/schema/55-import-jobs.prisma)) — CSV imports (products, customers, b2b accounts, discounts), processed by `import-worker`. The one true async-job table. Polled per-job at `GET /v1/commerce/products/import/:jobId` (and crm/b2b analogues).
- Per-domain run ledgers, each its own shape: `AutomationRun`/`AutomationRunStep` (schema 71), `InventorySyncRun` (schema 66), `BulkOpRevert` (schema 67), `MarketSettlementRun` (schema 80), `PartnerPayoutRun` (schema 83), `RollupAutomationDailyRuns` (schema 75).
- **Exports are synchronous** (`GET /v1/export/products` streams CSV) — not jobs.
- **No generic job table, no cross-entity job-list endpoint.** Each type polls its own id.

### Audit & Activity — a real log we barely surface

- `AuditLog` ([schema 04](../packages/db/prisma/schema/04-audit.prisma)) — append-only, FORCE-RLS, `{actor, action, entityType, entityId, diff:{before,after}, ip, ua}`.
- **Coverage is EXTENSIVE, not partial** — **~337 write sites across 89 files, emitting 294 distinct `action` strings**, consistently namespaced `<module>.<entity>.<verb>` (`crm.order.created`, `commerce.product.bulk_price_adjusted`, `inventory.transfer.shipped`, …). Measured 2026-07-19: commerce 128 · crm 74 · inventory 34 · builder 31 · sitebuilder 21 · email-platform 11 · api-rest services 38.
  > ⚠️ **Corrects v1.0 of this doc**, which claimed "~52 calls, mostly CMS, commerce largely uncovered" and made closing that gap the headline of Phase 2. That was a measurement error — it counted only direct `writeAudit` imports and missed the **per-module `writeAuditLog` wrappers**. Order/product/price/inventory mutations _do_ write audit. **There is no meaningful coverage gap; the gap is entirely on the read side.**
- **Two writer shapes, one table.** `writeAudit(tx, request, auth, entry)` ([api-core/src/audit.ts](../packages/api-core/src/audit.ts)) is used by api-rest routes and captures `ipAddress` + `userAgent` from the request. Each module also has its own `writeAuditLog({tx, tenantId, actorId, actorType, action, entityType, entityId, diff})` (e.g. [commerce/src/audit.ts](../packages/commerce/src/audit.ts)) which writes the same `audit_logs` row but **cannot capture ip/UA** — it has no request. So ~300 of the 337 rows have null ip/UA. That is the one real audit _write_ gap, and it is a forensic-completeness nicety, not a blocker for the activity feed.
- `CrmActivity` (schema 30) — append-only, month-partitioned, per-customer/deal timeline. A domain-specific, pre-materialized _activity feed_ (correct pattern, narrow scope). Surfaced at `crm/customers/.../activity-timeline.tsx`.
- **No tenant-facing audit/activity API** (`GET /v1/audit` does not exist). The only audit _reads_ today are the operator console, an AI report, and booking history.
- The visible activity surfaces **bypass the log entirely**: the workbench pulse ([activity.ts](../apps/workbench/lib/api/activity.ts)) polls `/v1/orders` + `/v1/crm/customers` and diffs; the dashboard home "Recent activity" ([\_home/activity.ts](<../apps/dashboard/app/(dashboard)/_home/activity.ts>)) merges CMS + inventory + email _list_ data. Both reimplement, shallowly, what `AuditLog` already records.
- Operator (staff) audit is a **separate** raw-SQL table `wize_admin.platform_operator_audit_logs` — the cross-tenant audit ledger, already written by `logOperatorAction`.

### Notifications — web-push fan-out only, no inbox

- `PushSubscription` (schema 70) + `push-worker` + `push.send` event + `settings/notifications` opt-in UI. Generic (`{userId,title,body,url,tag}`), but today's primary producer is live chat.
- `BookingNotification` (schema 78) — a scheduling-specific _delivery ledger_ (confirmation/reminder/…), not a general center.
- **No general `Notification` model. No in-app bell, no unread count, no inbox.** Toasts are transient and die on navigation.

### Substrate — mature

- `EventType` in [wizeworks/packages/events/src/types.ts](../packages/events/src/types.ts): ~200 events across tenant lifecycle, content, media, email, commerce (catalog / cart / orders / payment / subscriptions / returns / reviews / gift cards / configurator), inventory, domains, b2b, scheduling, dropship, search, chat, partner, forms, feedback, import.
- `publishEvent()` catches+logs (never fails the request), batches, and **tees every event to the automation fan-in topic** — so a consumer can already see the entire firehose in one place. That fan-in is the natural feed for a notification rule engine.

## Target architecture

### Principle: read-spine over ledgers, not a monolith

We do **not** collapse the run-ledgers into one generic `Job` table, and we do
**not** build an `Activity` table. Each domain ledger is richer than a generic
row (import has per-row results; automation has per-step; payout has Stripe
refs). Instead, layer 3 is a **normalizing read layer** that projects them into
common DTOs. Adding a producer means teaching the projector one more source, not
migrating data. This is the zero-migration path and the seam the admin app
reuses cross-tenant.

The one exception is **Notifications**, which genuinely need a new table —
they carry per-user read/unread state that no existing ledger holds.

### Jobs

- **`GET /v1/jobs?state=active|all&limit=`** → `Job` DTO: `{ id, source, kind, label, status, progress?, startedAt, finishedAt?, error? }`. `source` names the backing ledger (`import` | `automation` | `inventory-sync` | `bulk-op` | …). The DTO is **app-agnostic — no route/href**: where a job's output lives is a per-app concept, so the consumer maps `kind` → its own surface (the workbench resolves `kind` → a surface key client-side, the way the pulse assigns surfaces). Baking a path in would couple the read-spine to one consumer.
- Backed today by `ImportJob` + the run-ledgers via a projector in api-rest. No new table.
- Producers already exist; this is purely additive read + a projector.
- **Surface:** the workbench status-bar **jobs chip** (the original trigger, built) + a full **Pulse surface** in the workbench — a dockable pane over `state=all` (running + recent history). A job row opens the workbench surface its output lands in.

### Audit & Activity

The write side is already done (337 sites, 294 actions). **This is a read-side
phase**, which makes it far cheaper than v1.0 of this doc assumed:

1. **Add the tenant read surface.** `GET /v1/activity` (the human feed) and
   `GET /v1/audit` (the raw forensic view, filterable by entity/actor/action)
   — projections over `AuditLog` (+ `CrmActivity` where richer). An entity
   timeline is the same query filtered to one `entityType/entityId`.
2. **Build the action→sentence registry.** The one genuinely hard part, and the
   phase's real cost: 294 machine actions have to become owner-readable
   sentences. It resolves by **namespace convention** (`<module>.<entity>.<verb>`
   parses into module hue + a default sentence) with an explicit override table
   for the ones whose default reads badly — never 294 hand-written entries.
   Unknown actions must degrade to a sane humanized string, because new actions
   ship continuously and an unmapped one must not produce a blank feed row.
3. **Retire the reinvention.** Re-point the workbench pulse at `GET /v1/activity`.
   The legacy dashboard home "Recent activity" needs no rework — it dies with
   `apps/dashboard` (see the Surfaces note above). One source of truth.

Activity lines are **rendered from audit rows by that registry** — turning
audit's machine record into a business owner's readable sentence, in the
[audience](brain/business/audience.md) voice.

### Notifications

- **New `Notification` model** (see below) — the only net-new table.
- **A `platform.notify` AUTOMATION ACTION writes the rows — not a new worker.**

  > ⚠️ **Supersedes v1.0–1.2 of this doc**, which specified a new
  > `notification-worker` Cloud Run service. That was written before confirming
  > that `automation-worker` **already consumes the same `automation.trigger`
  > fan-in** and that actions are a typed registry
  > ([automation-schemas/action.ts](../packages/automation-schemas/src/action.ts)).
  > A second subscriber would have been a whole always-on service duplicating
  > work already being done — new ongoing spend for no capability.

  The decisive argument isn't cost, though: **notification policy is precisely
  what a rule engine is for.** "Tell the owners when a payment fails, but not
  under $5, and not overnight" is a condition set plus a gate — tenant-editable,
  versioned, with a run ledger and loop-guard. Frozen in worker code it would be
  none of those, and the per-user preferences this layer needs would have to be
  rebuilt from scratch.

- Producers keep publishing domain events and never write notifications
  directly — the same derive-don't-inline discipline as the
  [email pipeline](brain/api-events/email-pipeline.md).

- **The one exception: notices where sparx is a party to the conversation.**
  The rule above governs everything about the TENANT'S OWN BUSINESS — an order
  fails, stock runs out, a visitor leaves feedback on their site, a task lands on
  a colleague. Who hears about those and when is the owner's policy, which is
  what the rule engine is for.

  A reply to the account holder's own workbench feedback is not that. The tenant
  is not the sender, cannot choose the audience, and would never author a rule
  for it — "notify me when my software vendor replies to me" has no sensible
  off-switch. Those are platform mechanics, written directly in the transaction
  that caused them via `writePlatformNotice`
  ([api-rest lib/platform-notice.ts](../services/api-rest/src/lib/platform-notice.ts)).

  **The axis is ownership, not recipient count** — the distinction that is easy
  to get wrong. A task assigned to one named person is also 1:1 and is still
  emphatically the tenant's policy (their assignment rules, their quiet hours),
  so it goes through the engine. The question to answer before writing a row
  directly is only: _is sparx a party to this conversation?_

  Three properties make the automation path unable to serve that case, and they
  are the reason this is an exception rather than laziness: the fan-in is
  explicitly **best-effort** (`pubsub.ts` swallows tee failures — fine for a
  marketing rule, not for "we answered you"); rules are tenant-authored with no
  seeded/system concept, so it would be **optional**; and `platform.notify`
  resolves recipients **by role**, which would publish one person's private
  correspondence to every owner, the opposite of [docs/112](112-feedback.md) §9.

  Same shape as the email pipeline's narrow escape hatch for OTP: the default is
  the queue, the exemption is stated, and it is justified by a property the queue
  cannot provide.

- **Delivery is multi-channel off the same row:** in-app center (new), web-push
  (already built — becomes one channel, not the whole system), and email digest
  (reuses `email.send`, see [email pipeline](brain/api-events/email-pipeline.md)).
  Channel selection is a per-user preference.
- **Surface:** an in-app **notification center** (bell + unread count) in both
  the workbench chrome, plus the status bar's "needs attention"
  signal. The admin **feedback inbox** ([docs/112](112-feedback.md)) becomes its
  first admin-side consumer rather than a bespoke build.

### Audience symmetry — why admin comes nearly free

Each system is **audience-agnostic, scope-parameterized**:

- Tenant user → scoped to their `tenant_id` (RLS does this automatically).
- WizeWorks operator → cross-tenant, through the existing `/internal/operator*`
  seam, reading the same projectors with the tenant filter lifted (and the
  operator audit table as the cross-tenant audit ledger, already written).

Model the DTOs and projectors **once, tenant-first but not tenant-coupled**, and
the admin app ([docs/76](76-admin-portal-spec.md)) inherits jobs, activity, and
notifications by pointing the same read-spine at operator scope. Building these
tenant-only and re-deriving them for admin later would be the drift trap.

## Data model changes

Only **one new table.** Everything else is read-layer + audit coverage.

```prisma
// wizeworks/packages/db/prisma/schema/NN-notifications.prisma  (FORCE-RLS, tenant-scoped)
model Notification {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String    @map("tenant_id") @db.Uuid
  userId      String    @map("user_id") @db.Uuid      // the addressed staff user
  kind        String    @db.VarChar(100)              // e.g. order.payment_failed, job.failed, inventory.depleted
  title       String    @db.VarChar(255)
  body        String?   @db.Text
  href        String?   @db.VarChar(500)              // deep-link to the thing
  module      String?   @db.VarChar(30)               // module hue for the row
  severity    String    @default("info") @db.VarChar(20) // info | success | warning | danger
  entityType  String?   @map("entity_type") @db.VarChar(100)
  entityId    String?   @map("entity_id") @db.Uuid
  readAt      DateTime? @map("read_at") @db.Timestamptz
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, readAt])       // unread-count + inbox query
  @@index([tenantId, createdAt(sort: Desc)])
  @@map("notifications")
}
```

A `NotificationPreference` model (per-user, per-kind, per-channel toggles) is a
fast-follow once the center exists; until then the worker applies sane defaults.

RLS: standard tenant-isolation FORCE-RLS ([data node](brain/data.md) /
[wizeworks/packages/db/CLAUDE.md](../packages/db/CLAUDE.md)) — and the migration follows
the per-tenant `set_config` backfill discipline if it ever backfills.

## API surface (all under the read-spine)

| Endpoint                                                             | Returns                          | Backed by                                    |
| -------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| `GET /v1/jobs?state=active\|all`                                     | `Job[]`                          | projector over `ImportJob` + run-ledgers     |
| `GET /v1/activity?entity=&actor=&limit=`                             | `ActivityItem[]`                 | projection over `AuditLog` (+ `CrmActivity`) |
| `GET /v1/audit?…`                                                    | raw `AuditLog[]` (forensic)      | `AuditLog`                                   |
| `GET /v1/notifications?state=unread\|all`                            | `Notification[]` + `unreadCount` | `Notification`                               |
| `POST /v1/notifications/:id/read`, `POST /v1/notifications/read-all` | ack                              | `Notification`                               |

Operator equivalents live behind `/internal/operator*` with scope widened.

## Build sequence

Smallest-leverage-first; each phase ships independently and is production-complete.

**Phase 1 — Jobs read-spine + status-bar tray. ✅ COMPLETE.** `GET /v1/jobs`
projector over `ImportJob` + `InventorySyncRun`; the workbench jobs chip; and the
`platform.pulse` surface (dockable pane over `state=all`, running + recent
history, rows click through to where their output lands). No migration.
Unblocks the status bar (the original ask). _Smallest._

**Phase 2 — Audit promotion. ✅ COMPLETE.** `GET /v1/activity` (humanized) +
`GET /v1/audit` (forensic), sharing one filter set — `?entityType=&entityId=`
_is_ the entity timeline, which is why no separate endpoint exists for it. The
action→sentence registry ([activity-language.ts](../services/api-rest/src/lib/activity-language.ts))
resolves by namespace convention with a 10-entry override table and a safe
fallback, so all 294 actions — and every future one — render a sentence.
The workbench pulse now reads the real log (`NOTABLE_ACTIONS` filter) instead of
polling `/v1/orders` + `/v1/crm/customers`, and the Pulse surface gained the
full feed. **Read-side only** — the write side was already covered. _Highest
value — the log existed in full, we simply started using it._

**Phase 3 — Notification system.** `Notification` model + migration (the layer's
only migration); the `platform.notify` automation action + its executor; the
in-app notification center (bell + unread) in the workbench chrome; web-push and
email digest as further channels off the same row; fold the admin feedback inbox
onto it. _The real net-new system — but no new service._

Admin/operator surfaces for all three are a **Phase 4** once the tenant read
layer is proven — cheap because the projectors are audience-agnostic.

## Open decisions

1. ~~**Umbrella name.**~~ **Resolved (v1.1):** internal = _awareness layer_;
   product-facing = **Pulse** (the live surface over Activity + Jobs +
   Notifications). **Audit** retains its own name as the forensic view. See the
   Names callout at the top.
2. **Notification defaults.** Which event kinds notify by default, per module,
   before `NotificationPreference` ships? Needs a starter matrix (payment
   failed / job failed / stock depleted / chat waiting are obvious yeses).
3. **Activity retention & volume.** `AuditLog` is monthly-partition-ready and
   GCS-archived after 2 years (per schema note); the _activity feed_ projection
   needs a sane default window (30–90 days?) so it stays fast.
4. ~~**Job history depth.**~~ **Resolved in Phase 1:** the status-bar chip shows
   **actives only** (it hides itself when idle, so history there would be a
   permanently-open chip); the **Pulse surface** carries actives + the last 50
   runs. A failure therefore leaves the chip silently — surfacing it with an
   explanation is Phase 3's job. `ImportJob`'s 30-day retention bounds the tail.

## Non-goals

- **Not** shopper-facing realtime activity — that's [docs/96](96-realtime-product-activity.md) (social proof over sockets), a separate concern with a separate audience.
- **Not** a new generic `Job` table — the run-ledgers stay authoritative; layer 3 reads across them.
- **Not** an `Activity` table — activity is a projection of audit, never a third copy.
- **Not** replacing the automation module — automation _acts on_ the firehose; this layer _reports_ it. They share the substrate, not the surfaces.

## Related

- Brain node: [[activity]] (the durable map over this system).
- Substrate: [[event-driven]], [[event-catalog]].
- Adjacent specs: [docs/68](68-wizards-import-export-bulk.md) (imports/bulk), [docs/76](76-admin-portal-spec.md) (operator console), [docs/112](112-feedback.md) (feedback inbox), [docs/96](96-realtime-product-activity.md) (shopper realtime).
  </content>
  </invoke>
