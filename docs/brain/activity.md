---
title: Activity, Jobs & Notifications — the awareness layer
node: activity
type: map
status: active
sources:
  - docs/124-activity-jobs-notifications.md
  - wizeworks/packages/db/prisma/schema/04-audit.prisma
  - wizeworks/packages/db/prisma/schema/55-import-jobs.prisma
  - wizeworks/packages/events/src/types.ts
---

# Activity, Jobs & Notifications

> How the platform answers three questions for every operator — tenant user and
> WizeWorks staff alike: **"is something running?"**, **"what happened?"**,
> **"what needs me?"**. The long-form design lives in
> [docs/124](../124-activity-jobs-notifications.md) (temporary — absorbed here
> as it's built).

**Names:** _awareness layer_ = internal/architecture (this node). **Pulse** =
the product-facing surface — the live view of Activity + Jobs + Notifications a
tenant opens to see their business breathing. **Audit is the one term Pulse does
not absorb** — the forensic ledger keeps its own name (security/settings
context), because a diff-and-IP record isn't a "heartbeat." The existing
workbench `usePulse` is **Pulse v0**, absorbed and grown by this layer, not a
collision.

## The four terms — use them precisely (this is the point of the node)

"Activity" was overloaded four ways and drifted. This layer commits to four
disjoint terms; every surface, endpoint, and table uses them exactly so:

- **Job** — async background work with a lifecycle (`queued → running → done |
  failed`) + progress. Someone starts it and leaves. *"Is it running?"* Backed
  by per-domain run-ledgers.
- **Audit** — the immutable, complete forensic record of every state change
  (actor / action / entity / before-after diff / ip / ua). *"Who did what?"*
  Backed by `AuditLog`. **The ledger.**
- **Activity** — a curated, human-readable **feed**, a *projection over* audit +
  events. *"What's been going on?"* **A view of audit, never its own table.**
- **Notification** — a **directed, actionable** item for one person, with
  read/unread + a delivery channel. *"What needs me?"* Backed by the new
  `Notification` table.

Two rules that fall out and must not be violated:
**Audit is the ledger; Activity is a view of it** (no "activity table").
**Notification ≠ Activity** (addressed + acknowledged vs. ambient context).

## The layered model — we own the bottom, the gap is the top

```
4. SURFACES    jobs tray · activity feed · notification center · admin views
3. READ-SPINE  GET /v1/{jobs,activity,notifications} — normalize ledgers → DTOs   ← MISSING
2. LEDGERS     AuditLog · CrmActivity · Notification(new) · ImportJob · run-ledgers
1. SUBSTRATE   the Pub/Sub EventType firehose, teed to the automation fan-in     ← mature
```

The expensive parts — a reliable firehose ([[event-driven]]), durable ledgers,
RLS — exist. The whole gap is **layer 3** (a thin read layer that answers across
ledgers) and most of **layer 4** (the surfaces). See [[awareness-read-spine]].

## What exists today (and the two anti-patterns to kill)

- **Jobs:** `ImportJob`/`ImportJobRow` ([schema 55](../../packages/db/prisma/schema/55-import-jobs.prisma), `import-worker`) is the one real async-job table; several per-domain run-ledgers exist (`AutomationRun`, `InventorySyncRun`, `BulkOpRevert`, `MarketSettlementRun`, `PartnerPayoutRun`). Polled per-id; **no unified job list.** Exports are synchronous, not jobs.
- **Audit:** `AuditLog` ([schema 04](../../packages/db/prisma/schema/04-audit.prisma)) — **coverage is EXTENSIVE: ~337 write sites / 89 files / 294 distinct `<module>.<entity>.<verb>` actions** (commerce 128 · crm 74 · inventory 34 · builder 31 · sitebuilder 21 · email-platform 11 · api-rest 38, measured 2026-07-19). Two writer shapes on one table: api-core `writeAudit(tx, request, auth, entry)` captures ip/UA; each module's own `writeAuditLog({…})` cannot (no request), so most rows have null ip/UA — the only real *write* gap. `CrmActivity` is a correct, narrow pre-materialized activity feed. Operator audit is the separate `wize_admin.platform_operator_audit_logs`. **No tenant-facing audit/activity API — the entire gap is read-side.**
  > ⚠️ An earlier survey claimed "~52 calls, CMS-biased, commerce uncovered" and it was **wrong** — it missed the per-module `writeAuditLog` wrappers. Don't re-derive that conclusion by grepping only `writeAudit`.
- **Notifications:** web-push only (`PushSubscription` + `push-worker` + `push.send`) + a scheduling `BookingNotification` delivery ledger. **No general `Notification` model, no in-app center/bell/unread.**

⚠️ **The poll-and-merge anti-pattern** — reinventing the audit log by polling
list endpoints and diffing. The workbench pulse did this and was **fixed in
Phase 2** ([activity.ts](../../apps/workbench/lib/api/activity.ts) now reads
`GET /v1/activity`). The legacy dashboard home "Recent activity"
([_home/activity.ts](<../../apps/dashboard/app/(dashboard)/_home/activity.ts>))
still does, and retires with `apps/dashboard`
(legacy — [[project_workbench_replaces_dashboard]]). **Don't add a third:** any
"what happened" surface reads `/v1/activity`, never a list endpoint.

**Surfaces are workbench-only.** Every UI target below is built in
`sparx/apps/workbench`; `apps/dashboard` gets no new work. The read-spine stays
app-agnostic (no route/href in the DTO — the workbench maps `kind` → a surface
key client-side, like the pulse) so admin/operator reuses it later.

## Key decisions

- **Read-spine, not a monolith.** No generic `Job` table, no `Activity` table.
  Layer 3 *normalizes* the existing ledgers into common DTOs; adding a producer
  teaches the projector one source, not a migration. [[awareness-read-spine]].
- **Only one new table — `Notification`** — because it carries per-user
  read/unread state no ledger holds. [[notification-model]].
- **Notifications are derived, never inlined — by an AUTOMATION ACTION, not a
  worker.** `platform.notify` ([notify.ts](../../packages/automation/src/actions/notify.ts))
  writes `Notification` rows; producers keep publishing domain events. Same
  discipline as the [[email-pipeline]]. Web-push becomes *one channel*, not the
  system.
  > An earlier plan called for a `notification-worker` Cloud Run service. It was
  > **dropped**: `automation-worker` already consumes the same `automation.trigger`
  > fan-in, so that was new ongoing spend duplicating existing work — and more
  > importantly, notification policy ("who, on what, but not overnight") IS a
  > rule engine's job, so as an action it inherits conditions, gates, versioning
  > and the run ledger instead of freezing rules in code. **Don't reintroduce a
  > notifications worker.**
- **One exception, on an OWNERSHIP axis: notices where sparx is a party.** The
  derive-don't-inline rule governs the tenant's own business (an order fails, a
  visitor leaves feedback on their site, a task lands on a colleague) — their
  audience, their conditions, their policy. A reply to the account holder's own
  workbench feedback is correspondence with US: no rule anyone would author, no
  sane off-switch. It is written directly in the causing transaction via
  `writePlatformNotice`
  ([platform-notice.ts](../../services/api-rest/src/lib/platform-notice.ts)).
  Not "1:1 vs fan-out" — a task assigned to one named person is 1:1 and still
  the tenant's policy. Ask only: _is sparx a party to this conversation?_
  Automation cannot serve this case anyway: the fan-in is best-effort, rules are
  tenant-authored (so it would be optional), and `platform.notify` resolves by
  ROLE — which would leak one person's private thread to every owner.
- **Reads are audit, not activity.** The log records reads too (`mcp.list_*`,
  `mcp.get_*`) — "who looked at this?" is a real forensic question, so
  `/v1/audit` keeps them and `/v1/activity` filters them out in SQL. Found by
  running it: reads were ~45 of the newest 200 rows, crowding out everything
  that actually happened.
- **Collapse consecutive identical rows in the feed UI.** Bulk operations write
  one audit row per record; real data had a run of **18**, which owned the whole
  first screen. The Pulse pane folds consecutive same-(action, actor, subject)
  rows into one line with a `×N` count. Presentation-side on purpose — the API
  returns true rows; nothing is hidden, the count says how many.
- **Audience-agnostic, scope-parameterized.** Model DTOs/projectors tenant-first
  but not tenant-coupled — the admin/operator console ([docs/76](../76-admin-portal-spec.md))
  inherits jobs/activity/notifications cross-tenant by widening scope, instead of
  growing a parallel system. [[awareness-audience-symmetry]].

## Build sequence

1. **Jobs read-spine + status-bar tray** — ✅ **DONE**: `GET /v1/jobs` projector (`ImportJob` + `InventorySyncRun`), the status-bar jobs chip, and the `platform.pulse` surface (actives + last 50 runs). No migration. *(the original trigger)*
2. **Audit promotion** — ✅ **DONE** (read-side only; write side was already covered): `GET /v1/activity` (humanized) + `/v1/audit` (forensic) sharing one filter set (`?entityType=&entityId=` **is** the entity timeline); the action→sentence registry ([activity-language.ts](../../services/api-rest/src/lib/activity-language.ts)) — namespace convention + 10 overrides + safe fallback, covering all 294 actions and any future one; the workbench pulse re-pointed off its poll-and-merge onto the real log; the full feed added to the Pulse surface. *(highest value)*
3. **Notification system** — `Notification` model + `notification-worker` + in-app center (workbench chrome); fold in the admin feedback inbox. *(net-new)*
4. **Admin/operator surfaces** — cheap once the projectors exist.

## Sources & long-form
- [docs/124](../124-activity-jobs-notifications.md) — the full design (data model, API, worker, roadmap, open decisions). Temporary; absorbed here as phases land.
- Substrate: [[event-driven]], [[event-catalog]]. Delivery pattern: [[email-pipeline]].

## Quarantine
- None yet. When Phase 2 lands, mark the poll-and-merge pulse/home-activity
  implementations superseded rather than silently removing their rationale.
</content>
