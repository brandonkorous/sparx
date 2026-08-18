# sparx Platform — In-Product Feedback

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-29

> The always-available way for an authenticated dashboard user to send us a suggestion, a problem
> report, a question, or praise — with the surrounding context attached automatically — plus a
> non-intrusive periodic pulse that invites feedback without interrupting work. Submissions land in a
> triage + response surface in the WizeWorks admin portal ([76-admin-portal-spec.md](76-admin-portal-spec.md)),
> and responses close the loop back to the submitter.
>
> Related: [24-dashboard-shell.md](24-dashboard-shell.md) (where the entry point mounts),
> [76-admin-portal-spec.md](76-admin-portal-spec.md) (the response mechanism),
> [82-event-bus-unification.md](82-event-bus-unification.md) (events),
> [13-email-platform-prd.md](13-email-platform-prd.md) / [91-default-email-templates.md](91-default-email-templates.md) (response emails),
> [97-analytics-reporting-architecture.md](97-analytics-reporting-architecture.md) (what the feedback stream feeds).

---

## 0. What this is — and what it is not

**Is:** a first-class, platform-level channel for a logged-in user of the dashboard to tell **us
(WizeWorks)** something — an idea, a bug, a question, a "this is great." Every submission carries the
context the user was in (route, module, entity, site, device, app version) so we never have to ask
"where were you / what were you doing." A WizeWorks staff member triages and responds from the admin
portal; the response returns to the user inside the dashboard and by email.

**Is not:**

- **Not live chat.** [56-live-chat-module.md](56-live-chat-module.md) is a _tenant↔their customers_
  product with a real-time inbox. This is _tenant-user↔WizeWorks_, asynchronous, ticket-shaped. Different
  audiences, different surfaces, different data. They never share a widget.
- **Not a support desk / SLA queue.** There is no promised response time, no priority routing, no
  on-call. It is a feedback firehose we _choose_ to mine and reply to. (If a formal support product lands
  later it can consume the same store, but Phase 1 makes no support promise.)
- **Not a public roadmap / voting board.** Submissions are private between the submitter and WizeWorks.
  Cross-tenant upvoting, a public "what's shipped" changelog, and idea-merging are explicitly future
  (§14) — they are a different product with different privacy rules.
- **Not module-gated and not billable.** Like favorites/recents, this is shell chrome — present for every
  authenticated user of every tenant regardless of which modules are active. It is never a `tenant.plan`
  or module-flag check.

---

## 1. Binding decisions

- **D1 — One store, two front doors, one back door.** A single `feedback_submissions` table is written by
  (a) the **user-initiated** compose modal and (b) the **pulse** slide-in, and read by (c) the admin
  triage surface. The two front doors differ only in how they're _triggered_ and their default
  `category`; they produce the same row shape. No parallel "survey" table.

- **D2 — Context is captured by the client, server-stamped, never re-asked.** The compose surface reads
  the user's current route → module/section/entity (the same resolution the breadcrumb uses), active
  site, theme, viewport, device, locale, and the app release tag, and attaches them as a structured
  `context` payload (§4). The server additionally stamps trustworthy fields it owns (tenant, membership,
  IP-derived nothing — see §13). The user is never made to describe their context manually.

- **D3 — The entry point is a dedicated header control, not a floating bubble.** A labeled Feedback
  control lives in the dashboard header's right cluster (§2). We deliberately do **not** ship a
  bottom-right floating action bubble: it competes with the tenant's own future chat widget mental model,
  and the bottom-right corner is reserved for the pulse slide-in. The control is mirrored into the user
  menu, the `…` actions menu, and ⌘K so it's reachable however a user navigates.

- **D4 — The compose surface is a modal, opened from anywhere.** It is a focused, transient task with no
  entity identity, so it uses the `Dialog` primitive (not the entity drawer/detail system). It mounts
  once at the shell and is opened by any entry point via a shared client store, so it is genuinely
  "available everywhere" without each surface re-implementing it.

- **D5 — The pulse never blocks.** The periodic invitation is a dismissible bottom-right slide-in card
  (toast-shaped, persistent until acted on), **never** a modal. Eligibility is decided **server-side**
  (§5), behavior-triggered, frequency-capped, suppressed for recent responders, and suppressed inside
  critical flows (checkout, payment, publish, onboarding). One prompt is worth more than ten ignored
  ones.

- **D6 — The loop closes in two channels.** A staff response notifies the submitter (i) by email via the
  standard `email.send` event + a `feedback-response` template, and (ii) in-app via an unread dot on the
  Feedback control that opens the user's feedback history. There is no notification center yet
  ([24](24-dashboard-shell.md) §5.3); these two channels are the loop until one exists.

- **D7 — Tenant-scoped rows, admin-cross-tenant reads.** `feedback_submissions` / `feedback_messages`
  carry `tenant_id` and get RLS `ENABLE + FORCE` + the standard isolation policy. In the dashboard a user
  sees **only their own** submissions (app-tier filter on membership; RLS is the tenant backstop). The
  admin portal reads across all tenants through its separate DB role exactly as its other support tooling
  does ([76](76-admin-portal-spec.md) §5).

- **D8 — Feedback is an event, not an inlined side effect.** Submitting publishes `feedback.submitted`;
  a staff reply publishes `feedback.responded`. Admin notification, the response email, analytics
  ingestion, and automation fan-in all hang off those events — never inlined in the request handler
  (platform convention, [82](82-event-bus-unification.md)).

---

## 2. Entry points

### 2.1 The header control (primary)

A single control in the header's right cluster, to the **left of the theme toggle** (order, left→right:
last-activity, `…`, star, **Feedback**, theme, user menu). It mounts in
[`dashboard-header.tsx`](<../apps/dashboard/app/(dashboard)/_components/dashboard-header.tsx>) alongside the
existing controls.

- **Icon:** `MessageSquarePlus` (lucide). Ghost `Button size="sm"`, like its neighbors. On `md+` it may
  carry a quiet "Feedback" text label; below `md` it is icon-only and folds into the user menu (§2.4) so
  the `h-12` header never crowds on mobile.
- **Unread dot:** when the user has an unread staff response, a small `--color-module`-neutral dot sits
  top-right of the icon (the same affordance pattern allowed by DESIGN.md for one-off chrome). Clicking
  opens the modal on the **history** tab (§9) and clears the dot for items viewed.
- **Click:** opens the compose modal (§3) on the **Send** tab.

### 2.2 The user menu

`UserMenu` gains two items: **"Send feedback"** (opens compose) and **"Your feedback"** (opens history).
This is the mobile home for the control and a discoverable second path on desktop.

### 2.3 ⌘K + the `…` actions menu

A platform action **"Send feedback"** is registered so it ranks in ⌘K Quick Mode and appears under
"Universal page actions" in the `…` menu ([24](24-dashboard-shell.md) §4.6/§6). It is a generic
parameterless action — it carries no entity — so it lives at the shell level, not a module manifest.

### 2.4 Responsive

| Breakpoint | Feedback entry point                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| `md+`      | Header control (icon, optional label) + user menu + ⌘K + `…` menu                     |
| `< md`     | Header control hides; lives in the user menu ("Send feedback" / "Your feedback") + ⌘K |

---

## 3. The compose modal

A single `Dialog` with two tabs — **Send** and **Your feedback** (§9). The Send tab:

```
┌─ Share feedback ───────────────────────────── ✕ ─┐
│  [ 💡 Idea ] [ 🐞 Problem ] [ ❓ Question ] [ ❤ Praise ]   ← category (segmented)
│                                                    │
│  Subject  ┌───────────────────────────────────┐  │  (optional, single line)
│           └───────────────────────────────────┘  │
│  Details  ┌───────────────────────────────────┐  │
│           │                                   │  │  (required, multiline, autosize)
│           └───────────────────────────────────┘  │
│                                                    │
│  ☐ Include a screenshot of this page              │  (§3.3)
│  ◇ Attach a file                                   │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Sending from: Commerce › Products › "Bosch …" │ │  ← context chip (§4), read-only,
│  │ app.sparx.works/commerce/products/abc · v2026…│ │     "Details" expander shows the full payload
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Replies come to brandon@… and appear here.        │  (muted)
│                       [ Cancel ]   [ Send feedback ]│
└────────────────────────────────────────────────────┘
```

### 3.1 Fields

| Field          | Required | Notes                                                                                         |
| -------------- | -------- | --------------------------------------------------------------------------------------------- |
| **Category**   | yes      | `idea` · `problem` · `question` · `praise`. Defaults to `idea`; the pulse seeds its own (§5). |
| **Subject**    | no       | Single line, ≤120 chars. If omitted, admin list derives a title from the first line of body.  |
| **Details**    | yes      | Multiline, autosizing, 1–5000 chars. The one field that must have a real answer.              |
| **Screenshot** | no       | Opt-in capture of the current viewport (§3.3).                                                |
| **Attachment** | no       | One file ≤10 MB via the existing asset upload path; image/pdf/log/text.                       |
| **Context**    | auto     | Read-only chip + expandable detail (§4). Never editable; this is the point of in-app capture. |

### 3.2 Behavior

- **Submit** → `POST /api/feedback` (§7). On success: toast "Thanks — we got it", modal closes (or
  switches to the history tab showing the new item as `New`). On failure: inline error, body preserved.
- **Leave-guard:** a dirty body registers the platform leave-guard (the same `useConfirm`-backed guard
  the editors use) so closing/navigating with unsaved text confirms before discarding — consistent with
  "explicit-save / confirm-on-discard" everywhere else.
- **Rate limit:** soft cap (e.g. 20 submissions / membership / hour) returns a friendly "you've sent a
  lot of feedback — thank you! try again shortly" rather than a hard 429 wall.
- **Single-module working surface rule:** the modal's cards stay neutral (`variant="default"`); the
  primary action is the `color="module"`-neutral **Send feedback** button. No module tint — feedback is
  not a module surface.

### 3.3 Screenshot capture

Opt-in (`☐ Include a screenshot of this page`). On submit, if checked, the client rasterizes the current
viewport (html-to-canvas style) to a PNG and uploads it as an attachment. Privacy guards (§13): inputs
marked `data-feedback-redact` (and password/secret fields by default) are blanked in the capture. We do
**not** auto-capture without consent.

---

## 4. The context payload

Captured client-side from sources the shell already has, stored as `context jsonb` on the row. Shape:

```ts
interface FeedbackContext {
  // Where
  route: string; // e.g. "/commerce/products/abc123"
  routePattern: string | null; // "/commerce/products/[id]" when resolvable
  module: SparxModule | null; // resolved route → manifest, same as the breadcrumb
  section: string | null; // manifest section id, e.g. "products"
  entity: { type: string; id: string } | null; // when the route resolves to one
  pageTitle: string | null;

  // Which site (multi-site, docs/49)
  property: { id: string; name: string } | null;

  // Trail — the last few generic locations visited (from recents), to reconstruct the path in
  trail: string[]; // e.g. ["/commerce", "/commerce/products", "/commerce/products/abc123"]

  // Environment
  viewport: { width: number; height: number };
  device: 'desktop' | 'tablet' | 'mobile';
  theme: 'light' | 'dark';
  locale: string;
  appVersion: string; // build/release tag (the deployed image tag)
  userAgent: string;
}
```

Server-stamped (not trusted from the client): `tenant_id`, `tenant_membership_id`, `user_id`,
`submitted_at`, `source` (`button` | `pulse` | `command`), and a server-side `app_version` cross-check.

The modal shows a compact one-line summary ("Commerce › Products › 'Bosch …'") with an expander revealing
the full payload, so the user always knows exactly what we can see — no hidden telemetry.

---

## 5. The non-intrusive pulse

A periodic, behavior-triggered invitation to leave feedback, rendered as a dismissible **bottom-right
slide-in card** — never a modal, never blocking.

### 5.1 Format

```
                                   ┌─────────────────────────────┐
                                   │ How's sparx working for you?│
                                   │ ◔ ◑ ◕ ●   (quick sentiment) │
                                   │ [ Share more ]      [ Not now ]│
                                   └─────────────────────────────┘
```

- One lightweight question + a 1-tap sentiment (e.g. 😞 / 😐 / 🙂 / 😍, stored as `sentiment`).
- A tap records the sentiment immediately (a complete, useful datapoint on its own) and reveals an
  optional "anything you'd add?" line; **Share more** opens the full compose modal pre-seeded with the
  sentiment + `category: 'idea'`. **Not now** / `✕` dismisses without penalty.
- Accessible: focusable, ESC-dismissable, `role="dialog"` with `aria-live` polite announcement; respects
  reduced-motion (no slide animation when the user asks for less motion).

### 5.2 Eligibility — server decides

The client asks `GET /api/feedback/pulse` on shell load and after key positive-completion events; the
server returns either `null` (not eligible) or a pulse descriptor. **All gating is server-side** so it
can't be defeated by a reload. A membership is eligible only when **all** hold:

- Account age ≥ **14 days** and ≥ **3 distinct sessions** (warm enough to have an opinion).
- No pulse shown in the last **90 days** (sentiment cadence is quarterly).
- No feedback submitted in the last **30 days** (recent submitters are suppressed — they just told us).
- Not dismissed ≥ **2** times in a row recently → exponential back-off (90 → 180 days).
- Not currently in a **suppressed context** (the client passes its route; the server suppresses
  checkout, payment setup, builder publish, onboarding, and any route flagged `critical`).

### 5.3 Trigger moment

Even when eligible, the card does not appear on a cold page load mid-task. The client surfaces it **after
a positive completion** — a save, a publish, an order marked fulfilled, a successful import — i.e. a
natural breath, not an interruption. If no such moment occurs in a session, the pulse simply waits for the
next one.

### 5.4 State tracking

`feedback_pulse_state` (§6.3) records per membership: `last_shown_at`, `last_dismissed_at`,
`consecutive_dismissals`, `last_submitted_at`, `last_sentiment`. The eligibility query reads it; showing,
dismissing, and answering write it.

---

## 6. Data model

Three tables in the platform schema, all `feedback_`-prefixed.

### 6.1 `feedback_submissions`

```sql
CREATE TABLE feedback_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_membership_id  UUID NOT NULL REFERENCES tenant_memberships(id) ON DELETE SET NULL,
  user_id               UUID,                       -- denormalized for admin display if membership is cleared

  source                TEXT NOT NULL DEFAULT 'button',   -- button | pulse | command
  category              TEXT NOT NULL,                    -- idea | problem | question | praise
  subject               TEXT,
  body                  TEXT NOT NULL,
  sentiment             SMALLINT,                         -- 1..4 from the pulse, null otherwise
  context               JSONB NOT NULL DEFAULT '{}',      -- §4
  attachment_asset_ids  UUID[] NOT NULL DEFAULT '{}',     -- screenshot/file in asset storage

  -- Triage (admin-owned; §10)
  status                TEXT NOT NULL DEFAULT 'new',      -- new | triaged | planned | in_progress | shipped | declined | answered
  assignee_staff_id     UUID,                             -- WizeWorks staff (admin schema)
  internal_tags         TEXT[] NOT NULL DEFAULT '{}',     -- staff-only labels, never shown to the user

  -- Loop state
  last_response_at      TIMESTAMPTZ,
  user_unread           BOOLEAN NOT NULL DEFAULT FALSE,   -- a staff reply the user hasn't seen

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX feedback_submissions_tenant       ON feedback_submissions (tenant_id, created_at DESC);
CREATE INDEX feedback_submissions_membership   ON feedback_submissions (tenant_membership_id, created_at DESC);
CREATE INDEX feedback_submissions_status       ON feedback_submissions (status, created_at DESC);

ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_submissions FORCE ROW LEVEL SECURITY;

CREATE POLICY feedback_submissions_isolation ON feedback_submissions
  USING (tenant_id = current_tenant_id());
```

### 6.2 `feedback_messages` — the thread

Both the user and staff post here (the original body is also row 0, or kept on the submission — we keep
the submission body canonical and store **replies** here).

```sql
CREATE TABLE feedback_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES feedback_submissions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  -- mirrored for RLS

  author_kind     TEXT NOT NULL,        -- staff | user
  author_id       UUID NOT NULL,        -- staff_id (admin schema) or user_id
  author_name     TEXT NOT NULL,        -- snapshot for display
  body            TEXT NOT NULL,
  attachment_asset_ids UUID[] NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX feedback_messages_submission ON feedback_messages (submission_id, created_at);

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY feedback_messages_isolation ON feedback_messages
  USING (tenant_id = current_tenant_id());
```

### 6.3 `feedback_pulse_state` — frequency capping

```sql
CREATE TABLE feedback_pulse_state (
  tenant_membership_id   UUID PRIMARY KEY REFERENCES tenant_memberships(id) ON DELETE CASCADE,
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  last_shown_at          TIMESTAMPTZ,
  last_dismissed_at      TIMESTAMPTZ,
  consecutive_dismissals SMALLINT NOT NULL DEFAULT 0,
  last_submitted_at      TIMESTAMPTZ,
  last_sentiment         SMALLINT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback_pulse_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_pulse_state FORCE ROW LEVEL SECURITY;

CREATE POLICY feedback_pulse_state_isolation ON feedback_pulse_state
  USING (tenant_id = current_tenant_id());
```

**RLS note** ([wizeworks/packages/db/CLAUDE.md](../packages/db/CLAUDE.md)): all three are tenant-scoped, so all
three get `ENABLE` + `FORCE` + isolation. Hand-edit the migration SQL — Prisma does not generate RLS. The
admin portal reads cross-tenant through its own role ([76](76-admin-portal-spec.md) §5), bypassing these
policies the same way the rest of the support tooling does.

---

## 7. API surface

All tenant-facing endpoints are tenant-scoped via Better Auth org context + RLS. API-first: the dashboard
is one consumer; the admin portal and future MCP/mobile are others.

| Endpoint                          | Purpose                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/feedback`              | Create a submission. Body: `{ category, subject?, body, sentiment?, context, attachmentAssetIds?, source }`. Publishes `feedback.submitted`. |
| `GET /api/feedback`               | The **current user's own** submissions (membership-filtered), newest first, with status + unread + last message preview.                     |
| `GET /api/feedback/:id`           | One submission + its `feedback_messages` thread. Marks `user_unread = false` for the viewer.                                                 |
| `POST /api/feedback/:id/messages` | User reply on their own thread. Body `{ body, attachmentAssetIds? }`.                                                                        |
| `GET /api/feedback/pulse`         | Returns `null` or a pulse descriptor `{ promptId, question, kind }` per §5 eligibility.                                                      |
| `POST /api/feedback/pulse/event`  | Records `shown` \| `dismissed` \| `answered` (with `sentiment`) → `feedback_pulse_state`.                                                    |
| `POST /api/feedback/attachments`  | Presigned upload for screenshot/file via the existing asset path; returns `assetId`.                                                         |

Admin endpoints (cross-tenant, staff-auth, in the admin app) are defined with the admin portal
([76](76-admin-portal-spec.md)) — list/filter/assign/respond/transition. They write `feedback_messages`
and `feedback_submissions.status` and publish `feedback.responded`.

---

## 8. Events & notifications

### 8.1 Events ([82](82-event-bus-unification.md))

| Event                | Published when                                       | Consumers                                                                                                                        |
| -------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `feedback.submitted` | A submission is created                              | Admin notification (Slack/email to staff), analytics ingestion ([97](97-analytics-reporting-architecture.md)), automation fan-in |
| `feedback.responded` | Staff posts a reply or a notify-worthy status change | `email-worker` (the response email), unread-flag setter, analytics                                                               |

Both ride the canonical `@wizeworks/events` registry and the standard envelope
(`{ type, tenantId, actorId, occurredAt, data }`), and tee into the `automation.trigger` fan-in like
every other event. New event types need their Terraform topic
([82](82-event-bus-unification.md) §3) — add it the same session.

### 8.2 Response email

`feedback.responded` → publish `email.send` (the platform default — never call `sendTemplate()` directly)
with a new **`feedback-response`** template in [wizeworks/packages/email/src/templates/](../packages/email/src/templates/).
It composes the atomic email components (no inline `style`), shows the staff reply + a deep link back to
the thread in the dashboard, and is sent to the submitter's account email. Plain-text is auto-generated by
React Email — never hand-written. Listed in [91-default-email-templates.md](91-default-email-templates.md).

### 8.3 In-app unread

`feedback.responded` sets `feedback_submissions.user_unread = true`, which lights the dot on the header
control (§2.1). Opening the thread clears it (`GET /api/feedback/:id`).

---

## 9. The "Your feedback" history (closing the loop, user side)

The compose modal's second tab — also reachable from the user menu and the unread dot — lists the user's
own submissions:

- Each row: category icon, subject/derived title, **status badge**, last-activity time, unread dot.
- **Status is its own color axis:** render `<Badge color={statusTone(status)} variant="soft">` — never a
  bland neutral pill or a hand-rolled span. A suggested mapping: `new`/`triaged` → info, `planned`/
  `in_progress` → module/primary, `shipped`/`answered` → success, `declined` → neutral.
- Opening a row shows the original submission + the message thread + a reply box (`POST .../messages`).
- This is the only place a user sees feedback, and they see **only their own** — candid feedback stays
  private from teammates (D7).

---

## 10. Admin-side triage & response (contract)

The actual triage UI is built with the admin portal ([76-admin-portal-spec.md](76-admin-portal-spec.md))
as a new **sparx → Feedback** section. This doc fixes the **data contract** so that build is unambiguous:

- **Inbox:** filter by status, category, module/route (from `context.module`), sentiment, tenant, date;
  sort by recency/volume. The `context` payload is rendered as a readable panel (route, site, device,
  app version, screenshot thumbnail).
- **Triage:** set `status`, `assignee_staff_id`, `internal_tags` (staff-only, never sent to the user).
- **Respond:** post a `feedback_messages` row (`author_kind: 'staff'`) → publishes `feedback.responded`
  → response email + in-app unread.
- **Status lifecycle:** `new → triaged → {planned → in_progress → shipped} | declined | answered`.
  Only some transitions notify (e.g. `shipped`, `answered`, any staff reply); silent ones (`triaged`)
  don't email the user.
- **Cross-product later:** admin is multi-product ([76](76-admin-portal-spec.md)); the same store shape can
  back kanNINJA/HelpNinja feedback later by adding a `product` discriminator — out of scope here.

---

## 11. Analytics

`feedback.submitted` feeds the analytics pipeline ([97](97-analytics-reporting-architecture.md)) so we can
see, in the admin platform-metrics view ([76](76-admin-portal-spec.md) §3):

- Volume by category and by **module/route** — which screens generate the most friction (the `context`
  makes this free).
- Sentiment trend over time (from the pulse) — a lightweight platform NPS-adjacent signal.
- Feedback-to-resolution funnel (new → responded → shipped) and median time-to-first-response.
- Correlation hooks for churn-reason analysis ([76](76-admin-portal-spec.md) "Churn rate and reasons").

No PII beyond what the user typed and their account identity; aggregates are tenant-anonymized in
platform rollups.

---

## 12. Accessibility & responsive

- The header control is a real `<button>` with an `aria-label` and tooltip; the unread dot is announced
  ("Feedback — 1 unread response").
- The modal is a focus-trapped `Dialog` with a labeled title; category is a proper radio/segmented group;
  Details has an associated label; errors use `aria-describedby`.
- The pulse card is keyboard-reachable, ESC-dismissable, `aria-live="polite"`, and honors
  `prefers-reduced-motion` (fade, not slide).
- Mobile: compose modal goes full-height sheet below `md`; the pulse card respects safe-area insets and
  never covers a primary action.

---

## 13. Privacy, security & abuse

- **Consent-gated screenshot.** No capture without the checkbox. Fields marked `data-feedback-redact`
  (and all password/secret inputs by default) are blanked before rasterization.
- **No silent telemetry.** The full `context` payload is shown to the user in the modal — nothing is
  attached that they can't see.
- **Server-trusted identity.** `tenant_id`/`membership_id`/`user_id`/`app_version` are stamped
  server-side from the session, never trusted from the client payload.
- **Tenant isolation** via RLS `FORCE` on all three tables; a user reads only their own submissions in
  the dashboard.
- **Abuse:** authenticated-only; soft per-membership rate limit; body length bounds; attachment size/type
  allowlist; attachments scanned by the existing asset pipeline.
- **Deletion:** if a tenant or membership is deleted, submissions cascade/anonymize per the FK rules above
  (membership → `SET NULL`, keeping the denormalized `user_id`/`author_name` for admin history).

---

## 14. Open items (future)

- **Public roadmap + voting.** Opt-in surfacing of selected ideas for cross-tenant upvoting and a public
  "shipped" changelog. Different privacy model (submissions become public) — a separate product decision.
- **Notification center.** When the dashboard grows an Inbox/Notifications surface
  ([24](24-dashboard-shell.md) §5.3), feedback responses become a notification type there (in addition to
  email + the unread dot).
- **MCP / API submission.** Expose feedback submit/list over MCP so an AI agent can file a structured bug
  on the user's behalf with context attached.
- **Cross-product feedback** in admin (kanNINJA, HelpNinja) via a `product` discriminator on the store.
- **In-context element annotation.** Let the user point at the exact element they mean (a la a pin on the
  screenshot) — richer than a viewport grab.
- **AI triage assist.** Auto-categorize, dedupe against existing submissions, and draft a suggested reply
  for staff to approve.

---

## 15. Implementation order

Each slice independently shippable; deploy the moment the first one works.

1. **Tables + RLS migration** — `feedback_submissions`, `feedback_messages`, `feedback_pulse_state` with
   `ENABLE`/`FORCE`/isolation (the db-migration pipeline; hand-edited RLS SQL).
2. **`POST /api/feedback` + `GET /api/feedback[/:id]`** — submit + read-own, publishing `feedback.submitted`.
3. **Compose modal + shell mount** — the `Dialog`, category/subject/body/context capture, leave-guard,
   mounted once at the shell with a shared open-store.
4. **Header control + user menu + ⌘K/`…` action** — the entry points (§2), wired to open the modal.
5. **Context capture hook** — route→module/section/entity + site + env into the `context` payload (§4).
6. **Your-feedback history tab + reply** — list own, thread view, `POST .../messages`, status badges.
7. **`feedback.responded` → email** — `feedback-response` template + `email.send`, plus the `user_unread`
   dot.
8. **Screenshot + attachments** — consent-gated capture, redaction, asset upload.
9. **The pulse** — `GET /api/feedback/pulse` server eligibility, the bottom-right slide-in,
   `feedback_pulse_state`, behavior-trigger wiring.
10. **Admin triage section** — built with [76](76-admin-portal-spec.md): inbox, triage, respond,
    lifecycle, analytics feed.

Slices 1–4 deliver the core "send us feedback with context" loop; 6–7 close the response loop; 9 adds the
proactive pulse; 10 is the WizeWorks-side response surface.
