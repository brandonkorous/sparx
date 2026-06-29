# Admin App — Feedback Triage & Response

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-29

> The WizeWorks-staff side of in-product feedback: the inbox where tenant-user submissions land, the
> triage controls, and the response composer that closes the loop back to the submitter. This is the
> **back door** of [docs/112-feedback.md](../../112-feedback.md) — read 112 first; it owns the data model,
> the events, and the dashboard (submitter) side. This doc fixes the **admin-app** surface only.
>
> Lives inside the unified WizeWorks admin portal ([docs/76-admin-portal-spec.md](../../76-admin-portal-spec.md))
> as the **sparx → Feedback** section. Anything here that conflicts with 76 defers to 76.

---

## 1. Overview

Every authenticated sparx dashboard user can send feedback (an idea, a problem, a question, praise) with
their context attached. Those submissions are written to `feedback_submissions` / `feedback_messages`
(112 §6). This section of `admin.wize.works` is where staff **read, triage, respond to, and report on**
them.

The loop:

```
tenant user submits  ──►  feedback.submitted  ──►  admin Feedback inbox (this doc)
                                                         │  staff triages + responds
                                                         ▼
                                              feedback.responded  ──►  email + in-app unread
                                                         │            (back to the submitter, 112 §8)
                                                         ▼
                                              status: shipped / answered / declined
```

It is **not** a support desk with SLAs, **not** live chat (112 §0). It is the mining + reply tool for a
feedback firehose.

---

## 2. Access

Per the admin role matrix ([76 §2](../../76-admin-portal-spec.md)):

| Role          | Feedback access                                |
| ------------- | ---------------------------------------------- |
| super_admin   | Full: read, triage, respond, delete, configure |
| sparx_admin   | Full (sparx product)                           |
| support       | Read + respond + triage (no delete, no config) |
| developer     | Read-only (to mine bug reports)                |
| billing_admin | No access (feedback isn't financial data)      |

Every triage action and every response is audit-logged with staff id, timestamp, and the action
(76 §2) — staff never share accounts.

---

## 3. Data access

The admin app reads `feedback_submissions` / `feedback_messages` **cross-tenant** through its own DB role
(76 §5 — "Direct PostgreSQL queries", separate connection that bypasses tenant RLS), exactly like the rest
of the support tooling. It never assumes the dashboard's tenant-scoped session.

Writes the admin app makes:

- `feedback_submissions.status`, `.assignee_staff_id`, `.internal_tags`, `.last_response_at`,
  `.user_unread`.
- `feedback_messages` rows with `author_kind = 'staff'`.
- Never edits the user's original `body`/`context`/`sentiment` — those are immutable evidence.

`internal_tags` and `assignee_staff_id` are **staff-only** and are never returned by any tenant-facing
(112 §7) endpoint.

---

## 4. The inbox

A filterable list at `admin.wize.works/sparx/feedback`.

### 4.1 Columns

| Column          | Source                                                                |
| --------------- | --------------------------------------------------------------------- |
| Category        | `category` icon (idea / problem / question / praise)                  |
| Title           | `subject`, or derived from the first line of `body`                   |
| Tenant          | resolved `tenant_id` → tenant name (link to the tenant detail, 76 §3) |
| Submitter       | `author_name` / `user_id` → name + email                              |
| Module          | `context.module` (where in the app it came from)                      |
| Sentiment       | `sentiment` 1–4 as a face, when present (pulse submissions)           |
| Status          | `status` badge (§6)                                                   |
| Age             | `created_at` relative                                                 |
| Unread-by-staff | a "new since you last looked" marker                                  |

### 4.2 Filters

Scope by **status**, **category**, **module/route** (`context.module`), **sentiment**, **tenant**,
**assignee**, **tag**, and **date range**. Sort by recency or by volume (group identical/similar — manual
in Phase 1; AI dedupe is future, 112 §14). A saved default view of `status = new` is the landing state.

### 4.3 Queues

Quick chips above the list: **New**, **Assigned to me**, **Awaiting reply** (user replied after a staff
message), **Planned/In-progress**, **Recently shipped**. These are stored filters, not new tables.

---

## 5. Submission detail

Opening a row shows the full picture so staff never have to ask "where were you / what were you doing":

- **Header:** category, derived title, status badge, tenant + submitter (links), age. Lifecycle actions
  (set status, assign, tag) teleport into the header chrome — consistent with the platform's detail-frame
  pattern.
- **Context panel:** the `context` payload rendered readable — route + route pattern, module/section,
  entity (with a deep link into that tenant's dashboard via impersonation, 76 §4), active site, device,
  viewport, theme, locale, **app version**, user agent, and the visit trail. Screenshot/attachments render
  as thumbnails with a lightbox.
- **Thread:** the original submission body (row 0) followed by `feedback_messages` in time order, staff vs
  user visually distinct. Internal notes are **not** a separate concept in Phase 1 — every staff message
  is sent to the user; if a staff-only note is needed, use `internal_tags` or the future internal-note
  flag (§9).
- **Compose reply:** a box that posts a `feedback_messages` row (`author_kind: 'staff'`) and publishes
  `feedback.responded`, which sends the response email + sets `user_unread` (112 §8). Optionally bundle a
  status change with the reply (e.g. reply + mark `shipped`).

---

## 6. Triage & lifecycle

**Status lifecycle:**

```
new ─► triaged ─► planned ─► in_progress ─► shipped
  │        │
  ├────────┴──────────────────────────────► declined
  └───────────────────────────────────────► answered   (a question, resolved with a reply)
```

| Status        | Meaning                               | Notifies the user?  |
| ------------- | ------------------------------------- | ------------------- |
| `new`         | Just arrived, untouched               | —                   |
| `triaged`     | Read + categorized internally         | No (silent)         |
| `planned`     | Accepted onto the roadmap             | Optional            |
| `in_progress` | Being built                           | Optional            |
| `shipped`     | Delivered                             | **Yes**             |
| `declined`    | Won't do (with a reason in the reply) | **Yes**             |
| `answered`    | Question resolved by a reply          | **Yes** (the reply) |

**Notify rule:** any **staff reply** notifies. A **status change alone** notifies only for `shipped` /
`declined` / `answered` (and `planned`/`in_progress` if staff tick "let them know"). `triaged` is always
silent — it's internal bookkeeping. Notification = publish `feedback.responded`; the worker decides the
channel (112 §8).

**Triage controls:** set status, assign to a staff member (`assignee_staff_id`), add/remove
`internal_tags` (free-form, staff-only — e.g. `dup`, `billing`, `mobile`, `quick-win`).

---

## 7. Admin API surface

Staff-auth, cross-tenant, served by the admin app (separate infra, 76 §5). Tenant-facing endpoints live in
112 §7; these are the staff-only additions:

| Endpoint                                | Purpose                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/admin/feedback`               | Filter/sort/paginate across all tenants; returns staff-only fields too         |
| `GET /api/admin/feedback/:id`           | One submission + thread + full context + attachments                           |
| `PATCH /api/admin/feedback/:id`         | Set `status` / `assignee_staff_id` / `internal_tags`; may bundle a notify flag |
| `POST /api/admin/feedback/:id/messages` | Staff reply → publishes `feedback.responded`                                   |
| `GET /api/admin/feedback/metrics`       | Aggregates for the metrics view (§8)                                           |

Every write is audit-logged (76 §2). `feedback.responded` is published by the message/PATCH handlers, not
inlined — the email + unread effects are workers (112 §8).

---

## 8. Metrics

Surfaced in the admin platform-metrics view (76 §3) and fed by the same `feedback.submitted` /
`feedback.responded` stream into analytics ([docs/97](../../97-analytics-reporting-architecture.md)):

- Volume by category and by **module/route** — which screens generate the most friction.
- Sentiment trend (the pulse) — a lightweight platform-health signal, sliceable by tenant/plan/module.
- Response funnel: new → first response → resolved, with **median time-to-first-response** and backlog
  age.
- Top tenants by feedback volume; correlate with churn-reason analysis (76 §3).

Aggregates are tenant-anonymized in cross-tenant rollups; raw submissions are visible only to staff with
access (§2).

---

## 9. Future (defer)

- **Internal-only notes** — a `feedback_messages.internal` flag so staff can annotate a thread without
  emailing the user (Phase 1 has only `internal_tags`).
- **AI triage assist** — auto-categorize, dedupe against existing submissions, draft a suggested reply
  (112 §14).
- **Public roadmap promotion** — push a `planned`/`shipped` item to an opt-in public board (112 §14);
  needs the privacy-model decision.
- **Cross-product** — a `product` discriminator so kanNINJA / HelpNinja feedback share this inbox (76 §3).
- **Bulk actions** — multi-select triage (tag/assign/close) for firehose days.
- **Macros / saved replies** — canned responses for common declines/answers.

---

## 10. Implementation checklist

Gated behind the `apps/admin` scaffold (76 §6). Build this section after the app shell + auth exist.

- [ ] sparx → Feedback route in the admin app shell
- [ ] Cross-tenant read role / connection (reuse the support-tooling DB access, 76 §5)
- [ ] Inbox: list + filters (§4) + queue chips
- [ ] Submission detail: context panel + screenshot lightbox + thread (§5)
- [ ] Reply composer → `POST /api/admin/feedback/:id/messages` → `feedback.responded`
- [ ] Triage: status / assignee / tags (§6) with the notify rule
- [ ] Audit logging on every write (76 §2)
- [ ] Metrics tiles + module/route friction view (§8)
- [ ] Role gating per §2
