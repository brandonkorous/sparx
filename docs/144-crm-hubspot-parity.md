# 144 — CRM: from 5 to 10

Version: 0.4 (phase 4 complete; tickets, SLA and intake routing)
Author: Brandon Korous
Last Updated: 2026-08-07

> **Status: IN PROGRESS.** This is the implementation plan for closing the gap between the sparx CRM
> as it stands today and a CRM that beats HubSpot on every axis a small business can see. §2 is an
> audit of what already existed when the plan was written and is deliberately specific, because most
> of this plan is _extending_ working machinery rather than starting anything.
>
> **Phases 0–4 are built.** Two decisions were reversed during the build and both sections record
> it: sparx connects mailboxes over **IMAP/SMTP only**, never the Gmail API or Microsoft Graph
> (§5.2), and a support promise carries its **own** business-hours calendar rather than reusing the
> Scheduling module's (§7.3). §14.1 is the first thing to read before picking this up again.

---

## 1. Why this exists

A capability-by-capability audit against HubSpot Sales Hub Professional (2026-08-06) scored the
sparx CRM at **5/10 overall**, with the distribution badly skewed:

- **Foundation: 7–9.** Data model, tenancy, segmentation, invoicing/AR, API/MCP surface.
- **Daily-use surface: 2–5.** Deals, engagement, reporting.
- **Missing primitives: 0–1.** Custom properties, associations, service/tickets.

The skew is the whole story. Nothing here is a rewrite. Three missing _primitives_ hold down nine
of the thirteen scored categories at once, and two missing _surfaces_ account for almost all of the
subjective "this doesn't feel like a CRM" reaction. Build the three primitives, build the two
surfaces, and the categories that look unrelated move together.

**The governing constraint** is the one the whole platform runs on: sparx is industry-agnostic and
its users are non-technical business owners. A fixed contact schema contradicts that as surely as a
fixed product schema did (docs/143 §1). A CRM that only a salesperson trained on HubSpot can
operate contradicts it too. Every surface in this plan is authored for someone who has never heard
the word "pipeline" used as a noun.

## 2. What already exists (the baseline this plan extends)

Listed because nine of the eleven workstreams below are extensions of these, not new systems.

| Machinery                            | Where                                                                     | What this plan does with it                                             |
| ------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Domain-neutral field engine          | `packages/field-schema` (`FieldDef`, 16 field types, recursive validator) | **Third consumer**: CRM custom properties + custom objects (§3)         |
| Schema-driven form renderer          | `apps/workbench/surfaces/cms/schema-form.tsx`                             | Rendering custom properties on every CRM record (§3.5)                  |
| Schema editor UI                     | `apps/workbench/surfaces/cms/content-type-detail.tsx`                     | The property-editor surface's shape (§3.5)                              |
| Predicate DSL (bounded, JSON-Schema) | `packages/automation-schemas/src/condition.ts` (`ConditionGroup`)         | Report filters, scoring rules, SLA conditions, static-list rules (§8)   |
| Segment rule DSL + evaluator         | `packages/crm-schemas/src/segment-rule.ts`, `segment-evaluator` consumer  | Gains custom-property + association + score sources (§3.4, §10)         |
| Encrypted-OAuth connection pattern   | `CalendarConnection` + `lib/scheduling-calendar-oauth.ts` (AES-256-GCM)   | Copied verbatim for `MailboxConnection` (§5.2)                          |
| Email send/track pipeline            | `email.send` → `email-worker` → Mailgun → `email_events`                  | Carries 1:1 sales email; adds threading headers (§5.3)                  |
| Activity projection consumer         | `packages/crm/src/consumers/projection.ts`                                | Projects engagement + calls + tickets into the existing timeline (§5.5) |
| Pipelines + ordered typed stages     | `Pipeline` / `PipelineStage` (probability, `stage_type`)                  | Gains `objectKey` so tickets reuse it wholesale (§7.2)                  |
| dnd-kit board patterns               | `automations/flow-canvas`, `invoicing/stage-canvas`, `social/calendar`    | The deal board and ticket board (§4)                                    |
| BYO-credential provider registry     | `packages/sms` (provider + registry + console fallback)                   | Shape copied for `packages/voice` (§5.6)                                |
| Tenant secret encryption             | `@sparx/integration-framework` `secret-crypto`                            | BYO telephony + BYO mailbox credentials (§5.6)                          |
| Report query services                | `packages/crm/src/services/reporting-service.ts` (7 reports)              | Re-expressed as seeded built-in report definitions (§8.4)               |

## 3. Workstream A — the CRM object registry (custom properties, then custom objects)

**This is the keystone.** It moves extensibility 1 → 9, and lifts contacts, companies, deals and
segmentation with it. Nothing else in this plan is worth doing first.

### 3.1 The model, and the one distinction that governs it

docs/143 §2.2 already settled the shape of this problem for products, and the answer transfers
exactly:

> A content entry **is** its type's fields. A product **is not** — it carries a fixed commerce
> spine, and the type layer is purely additive.

A contact is a product, not a blog post. `email`, `phone`, `lifecycle_stage`, `total_spent`,
`order_count` are a **fixed spine** — indexed columns that segments, reports, RLS and the order
consumer all depend on. Custom properties are **additive on top**, never a redefinition.

So: one registry table describes both the additive schema on built-in objects **and** the complete
schema of tenant-authored objects.

```prisma
model CrmObjectDef {
  id         String @id
  tenantId   String @map("tenant_id")
  key        String @db.VarChar(63)   // contact | company | deal | ticket | <tenant-authored>
  kind       String @db.VarChar(10)   // builtin | custom
  label      String @db.VarChar(120)
  labelPlural String @map("label_plural") @db.VarChar(120)
  iconKey    String? @map("icon_key") @db.VarChar(63)
  // A FieldSchema (@sparx/field-schema). For `builtin`, the TENANT-ADDED
  // properties only — the spine stays in columns. For `custom`, the whole record.
  propertySchema Json @map("property_schema")
  // custom objects only: which property is the record's display title
  primaryFieldKey String? @map("primary_field_key") @db.VarChar(63)
  archivedAt DateTime?
  @@unique([tenantId, key])
}
```

The four built-in rows are seeded with an empty schema at CRM module activation, alongside the
existing built-in pipelines and segments (`packages/crm/src/consumers/module-activation.ts`).

### 3.2 Storage

- **Built-ins** get one JSONB column each: `customers.custom_properties`,
  `deals.custom_properties`, `companies.custom_properties`, `crm_tickets.custom_properties`.
  Default `'{}'`, validated against the object's `propertySchema` at the service boundary — the
  same write path `content_entries.body` already uses.
- **Custom objects** get one shared table:

```prisma
model CrmRecord {
  id         String @id
  tenantId   String @map("tenant_id")
  propertyId String? @map("property_id")   // site scoping, per docs/131
  objectKey  String @map("object_key") @db.VarChar(63)
  values     Json                           // validated against the object's schema
  ownerId    String? @map("owner_id")       // assigned staff user
  createdAt  DateTime
  updatedAt  DateTime
  deletedAt  DateTime?
  @@index([tenantId, objectKey, updatedAt(sort: Desc)])
  @@index([tenantId, propertyId, objectKey])
}
```

**Not EAV.** A validated JSONB bag is already the platform's settled answer for typed user data
(content entries, product attributes), it round-trips through one field engine, and it is what the
existing validator and form renderer already speak. A three-table EAV would be a second answer to a
solved problem.

**Indexing honesty.** A GIN index (`jsonb_path_ops`) on each bag covers containment and equality
filters, which is what property filtering is in practice. Range and sort on a custom numeric
property fall back to a tenant-bounded scan. That is acceptable at the row counts a single tenant
holds; if a specific property becomes hot, the answer is an expression index minted for it, not a
model change. This limit gets stated in the plan rather than discovered in production.

### 3.3 Property types

Everything `@sparx/field-schema` already ships — text, long text, rich text, slug, number, boolean,
date, datetime, enum (single + multi), url, email, reference, asset, object, repeater — plus three
CRM-specific additions to the shared engine (they belong upstream, not in a CRM fork, per RULE #1):

- `currency` — amount + currency code, formatted per the tenant's locale.
- `user` — a staff user reference (owner-style fields).
- `calculated` — a read-only field derived from a bounded expression over other properties.

### 3.4 Everything downstream that must learn about properties

A custom property that can be _stored_ but not _filtered, reported on, automated against or
captured_ is a text box, not a property. The definition of done for §3 includes all five:

| Consumer                | Change                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Segment rule DSL        | New source `custom.<objectKey>.<fieldKey>`, resolved by the evaluator against the JSONB bag |
| `ConditionGroup` fields | Same path exposed to automation conditions and report filters                               |
| Report builder          | Custom properties selectable as filter, group-by and measure (§8)                           |
| Forms                   | A form field may bind to a custom property, so a site form writes it on submission          |
| List views              | Custom properties selectable as columns, with saved per-user column sets                    |
| Import                  | CSV column → custom property mapping in the existing `ImportJob` flow                       |
| MCP + REST              | Property CRUD tools, and `customFields` accepted/returned on every record read + write      |

### 3.5 Surfaces

- `crm.properties.list` / `crm.property-schema.detail` — the property editor, built from the shape
  of `cms/content-type-detail.tsx`. Copy the pattern; do not import the CMS surface.
- Every CRM detail pane grows a **"More details"** panel rendering the object's schema through the
  `schema-form.tsx` pattern. Empty schema → the panel doesn't render.
- Language: the surface says **"the extra details you track"**, not "custom properties". A business
  owner adding "Warranty expiry" to their customers should never meet the word "schema".

### 3.6 Custom objects (Phase 7)

The registry above already carries them. What ships later is the **generic surface pair** — one
list surface and one detail surface driven entirely by a `CrmObjectDef`, registered dynamically
into the workbench catalog at runtime rather than as static entries in
`apps/workbench/lib/surfaces/catalog/crm.ts`. A tenant defining a "Property listing" or "Service
contract" object gets a working list, detail, search, timeline, association panel and automation
trigger from the definition alone.

## 4. Workstream B — the deal board

Smallest, most visible, no new model, no new endpoint.

`apps/workbench/surfaces/crm/deals-list.tsx` is a table. It becomes a **table _or_ board**, with the
board as the default and the choice remembered per user.

- Columns are the pipeline's `PipelineStage` rows in `sort_order`; each column header carries its
  name, deal count and summed value.
- Cards drag between columns with dnd-kit, already a dependency and already used three times in the
  workbench. Per the drag rule ([[feedback_drag_whole_element_not_handle]]): the **whole card**
  drags, with the pointer sensor guarded so inner controls stay usable.
- Drop calls the existing `POST /v1/crm/deals/:id/move-stage`, optimistic with rollback on failure.
- Colour carries the state (RULE #4): won/lost stage columns wear semantic tone from `stage_type`,
  cards wear the deal's own signal (overdue close date, stalled, unassigned) — not a wall of grey.
- Below a tablet breakpoint the board collapses to a stage-picker plus a single column
  ([[feedback_responsive_top2_rule]]).

The same component, parameterised by `objectKey`, becomes the ticket board in §7 — so it is built
generic from the first commit.

## 5. Workstream C — the engagement spine

Moves sales engagement 2 → 9 and the activity log 6 → 9. This is the largest workstream and the one
that makes the timeline show what was _said_ rather than only what the platform _did_.

### 5.1 The shape

Four capabilities, one spine: send from the record, receive onto the record, template what you send,
and log what you say out loud.

### 5.2 Connected mailboxes

**DECIDED DURING THE BUILD, AND IT REVERSES THIS SECTION'S ORIGINAL PLAN: sparx connects mailboxes
over IMAP and SMTP only. Not the Gmail API, not Microsoft Graph.**

The original plan here read "Google and Microsoft OAuth clients already exist for calendar; this is
an added scope and a second callback, not a new integration." That is true of the _code_ and false
of the _cost_. Gmail's `gmail.readonly` is a **restricted** scope: using it in production requires
an annual third-party **CASA security assessment**, and Graph's mail scopes require Microsoft
publisher verification. That is a recurring audit, paid for and re-passed every year, as the standing
price of one connector — and a vendor holding a veto over a feature customers have already paid for.

IMAP reaches the same mailboxes. **Gmail and Microsoft 365 both speak it**, over an app password the
tenant issues in their own account settings and revokes the same way — which also puts the tenant,
rather than sparx, in the consent loop. It is additionally the only path for every business on
Fastmail, Zoho, Rackspace, or a server their web agency set up in 2014, so it was always going to be
built. One protocol means one sync path to keep correct instead of three, and no OAuth token
lifecycle (refresh, revocation, push-channel expiry) to get wrong in two places.

```prisma
model MailboxConnection {
  provider     String  // imap_smtp
  scope        String  // personal (one staff user's mailbox) | shared (a team address)
  userId       String? // the staff user, for personal mailboxes
  emailAddress String
  appPasswordEnc String? // AES-256-GCM, CRM_MAILBOX_TOKEN_KEY
  imapHost, imapPort, smtpHost, smtpPort, imapUser
  syncCursor   String?  // UIDVALIDITY:UID — see below
  status       String   // active | expired | error
  lastSyncedAt DateTime?
  lastError    String?
}
```

**Polling, not push.** IMAP has IDLE, which would mean holding an open socket per mailbox per tenant
indefinitely — sockets servers drop without warning, in a pod that restarts on every deploy. The
`crm-mailbox-sync` CronJob polls every five minutes instead: one short-lived connection per mailbox,
no state to survive a restart, and well inside what a person means by "the reply shows up on the
record". After the first run each poll asks only for UIDs above the cursor, so a quiet mailbox
transfers nothing at all.

**`UIDVALIDITY` is stored with the cursor and that is load-bearing.** When a server issues a new
UIDVALIDITY, every UID it ever gave us means something else; resuming from the old cursor reads the
**wrong messages**. A change resets the sync to a bounded date window instead.

**Sending goes back out through the same connection.** SMTP delivers the message with the
`Message-ID` sparx already minted — which is why the raw message is built by hand rather than handed
to a provider's convenience API, since those mint their own id and discard ours, breaking the reply
chain. A copy is then filed in the mailbox's Sent folder over IMAP `APPEND`, because SMTP does not
do that and a rep who cannot find their own sent mail concludes sparx emailed a customer behind
their back.

**Everything about the protocols is pure and unit-tested** in `@sparx/crm/mail` (`mime.ts`,
`inbound.ts`, `rfc822.ts`, `imap.ts`, `smtp.ts`), hand-written for the same reason
`@sparx/scheduling` hand-writes its iCal and CalDAV parsers. The sockets live in api-rest
(`crm-mailbox-imap.ts`, `crm-mailbox-smtp.ts`).

**Automated mail is filtered before the privacy gate, not after** — `Auto-Submitted`, the `List-*`
headers, `Precedence: bulk`, a null return-path. An out-of-office from a known contact would
otherwise pass the contact check and land on their timeline as though they had written it.

### 5.3 Threads and messages

```prisma
model EngagementThread {
  tenantId, propertyId?
  subject
  providerThreadId String?
  customerId String?   // resolved recipient
  dealId     String?
  ticketId   String?
  status     String    // open | closed
  lastMessageAt DateTime
}

model EngagementMessage {
  threadId
  direction     String   // out | in
  fromAddress, toAddresses[], ccAddresses[]
  bodyHtml, bodyText
  rfcMessageId  String   // minted on outbound, read on inbound
  inReplyTo     String?
  sentAt        DateTime
  sentByUserId  String?
  mailboxConnectionId String?
  openCount, clickCount Int
}
```

- **Outbound** goes through the existing `email.send` → `email-worker` → Mailgun path with a minted
  `Message-ID` — unless a mailbox is connected, in which case it goes over that mailbox's own SMTP
  and is filed in its Sent folder (§5.2). A mailbox send that fails **falls back** to the platform
  path: the message being delivered matters more than which envelope carried it. Opens and clicks already land in `email_events` — they get joined to the
  message by `rfcMessageId`.
- **Inbound** arrives by IMAP poll (§5.2 — there is no push path, deliberately). Threading resolves
  on `In-Reply-To` first, then the `References` chain, then subject **narrowed to one customer**.
  Subject is LAST and narrow on purpose: "Re: Quote" from two different people is one subject and two
  conversations, and a threader that leads with it merges strangers' mail. Falling through to a new
  thread is always safe — a conversation split in two is a nuisance, two conversations merged is a leak.
  Contact resolution matches the from/to address against `customers.email` using the existing
  `(tenant, property, email)` unique index.
- **Privacy gate.** A connected personal mailbox syncs **only** messages whose counterpart address
  matches a known contact. Everything else is discarded unread — never stored, never indexed. This
  is stated in the connect flow in plain language before the OAuth redirect.

### 5.4 Templates and snippets

`SalesTemplate` (name, subject, HTML body, folder, owner, shared flag, send/open/reply counters) and
`SalesSnippet` (shortcut, body). Both compose the existing `@sparx/email` atomic components rather
than carrying raw markup, per the email-template rule in the root `CLAUDE.md`. Merge tags reuse the
existing `list_merge_tags` vocabulary, extended with custom properties from §3.

### 5.5 One timeline, still

Every engagement message, call and ticket event **also** writes a `crm_activities` row through the
existing projection consumer. `ActivityType` gains `email.received`, `email.replied`, `call.logged`,
`call.missed`, `ticket.opened`, `ticket.replied`, `ticket.resolved`, `meeting.booked`,
`property.changed`. The contact timeline stays the single read surface; nothing has to learn a
second place to look.

The record gains an **engagement composer** at the top of the timeline — one control that switches
between note, email, call log and task, so logging what just happened is one click from the record
rather than a navigation.

### 5.6 Calling

`packages/voice`, shaped exactly like `packages/sms`: a `VoiceProvider` contract, a Twilio
implementation, a console fallback for dev, and a registry that selects on configured credentials.
Credentials are **tenant-BYO** — the platform never fronts its own vendor account for a tenant's
outbound traffic ([[feedback_no_platform_ai_byok_only]]), so `resolveVoiceProvider` takes credentials
rather than reading `process.env`, which is the one structural difference from the SMS package.

```prisma
model CallRecord {
  tenantId, propertyId?
  customerId?, dealId?, ticketId?
  direction  String   // in | out
  fromNumber, toNumber          // E.164, stored as DIALLED
  startedAt, durationSec, endedAt
  status     String   // placing | ringing | completed | failed  ← lifecycle
  outcome    String?  // connected | no_answer | voicemail | busy | wrong_number  ← what happened
  notes      String?
  recordingUrl String?
  providerCallId String?  // unique per tenant — webhooks are re-delivered
  userId     String?
  engagementMessageId String?
}
```

**Click-to-call rings the REP first.** The platform dials the person who clicked and, when they pick
up, dials the customer and bridges the two. In-browser WebRTC was the original sketch and is worse:
it needs a microphone permission and a headset, and it fails in exactly the moment somebody most
needs a call to work. Ringing a real phone works on a train.

**`status` and `outcome` are two different columns and the distinction matters.** A call that was
placed is not a call that happened — it can ring out, hit voicemail, or fail at the carrier, and
those states arrive minutes later over a webhook. So the timeline entry (`EngagementMessage` +
`crm_activities`) is written when the call reaches a TERMINAL state, never at placement; otherwise a
record shows a conversation that had not started.

**The provider's outcome is a guess and a person can overrule it.** It is inferred from a status code
and a duration, and a six-second "completed" call is a voicemail greeting about as often as it is a
very short conversation. `update_crm_call` rewrites the timeline entry alongside the row, so a
correction does not leave the timeline as a second, wrong source of truth.

**Status webhooks are idempotent** on `provider_call_id` (unique per tenant, partial index). Vendors
retry aggressively; duplicate delivery is normal rather than an error, and a re-delivery updates the
row it belongs to instead of adding a second call that never happened. The public callback resolves
its tenant from a signed token, so there is no cross-tenant scan and a forged callback cannot write
an outcome onto somebody else's call.

Recording is **off by default** and its consent copy is explicit — call recording is jurisdictionally
loaded (one-party and two-party consent states, plus the EU's own rules) and the platform must not
quietly opt a business into a legal problem.

## 6. Workstream D — associations

Moves the data model 8 → 10 and unblocks the multi-contact deal, which is table stakes for anything
sold to more than one person.

```prisma
model CrmAssociation {
  id, tenantId
  fromType String  // object key
  fromId   String
  toType   String
  toId     String
  labelKey String?   // tenant-authored role
  isPrimary Boolean @default(false)
  createdAt DateTime
  @@unique([tenantId, fromType, fromId, toType, toId, labelKey])
  @@index([tenantId, fromType, fromId])
  @@index([tenantId, toType, toId])
}

model CrmAssociationLabel {
  tenantId, fromType, toType
  key          String   // decision_maker
  label        String   // "Decision maker"
  inverseLabel String   // "Deal they decide on"
}
```

**Back-compat is non-negotiable.** `Deal.customerId`, `Deal.b2bAccountId`, `Customer.b2bAccountId`
and every FK like them **stay**, and the service keeps them in sync with the `isPrimary` association
row. Every existing index, report, segment field, RLS policy and consumer keeps working untouched;
associations are the general graph layered over the fast primary pointer, not a replacement for it.

Surfaces: an association panel on every detail pane, showing related records grouped by label, with
add/remove/relabel and a "make primary" action.

## 7. Workstream E — service and tickets

Moves service 0 → 9. The intake already exists — live chat, forms and (after §5) inbound email all
arrive today with nowhere to go.

### 7.1 The object

```prisma
model Ticket {
  tenantId, propertyId?
  pipelineId, stageId          // reuses Pipeline/PipelineStage
  customerId?, companyId?
  assignedToUserId?
  subject, description
  priority   String            // low | medium | high | urgent
  source     String            // chat | email | form | phone | manual | api
  slaPolicyId?
  firstResponseDueAt, firstRespondedAt
  resolutionDueAt, resolvedAt, closedAt
  customProperties Json
}
```

### 7.2 Pipelines become generic

`Pipeline` gains `objectKey` (`deal` | `ticket` | a custom object). `PipelineStage.stage_type` is
already a varchar; it gains `resolved` and `closed`. The board from §4 and the funnel report both
work on tickets the day this lands, because both are parameterised by object.

### 7.3 SLA

`TicketSlaPolicy` — first-response and resolution targets per priority, evaluated against **business
hours** rather than wall clock. Breach and approaching-breach fire events, which the automation
engine can act on and the ticket list colours by. A ticket at 80% of its clock is amber; a breached
one is danger — colour carries it (RULE #4).

**Correction to this plan, made while building it.** The line above originally said the business
hours would come from reusing the scheduling module's `AvailabilityWindow`. That is the wrong table:
an availability window hangs off a `SchedulingResource`, so reusing it would make "we answer support
within four hours" depend on the **Scheduling module being switched on** and a bookable resource
existing. Modules are independent and never default on, and a CRM-only tenant has neither. They are
also different facts — when the support desk is staffed is not when bay 2 can be booked. The policy
therefore carries its **own** calendar (weekly windows + IANA timezone + holidays).

What IS shared is the arithmetic underneath, extracted to **`@sparx/time`**: two unrelated promises
in this platform are stated in local time and stored as UTC instants, both have to survive daylight
saving, and a DST bug fixed in one copy would still be a bug in the other.

### 7.4 Routing

Chat conversation → ticket, form submission → ticket, inbound email to a shared mailbox → ticket,
all through automation actions so the routing rules are the tenant's, not hardcoded.

## 8. Workstream F — the report builder and dashboards

Moves reporting 3 → 9. HubSpot's real differentiator here is that a non-technical user can build a
report without asking anyone.

```prisma
model CrmReport {
  tenantId, propertyId?
  name, description
  objectKey     String   // any registered object, built-in or custom
  filters       Json     // ConditionGroup — the same DSL as automations
  groupBy       Json     // property path, or a date bucket
  measures      Json     // [{ fn: count|sum|avg|min|max, field }]
  visualization String   // table | bar | line | pie | funnel | number
  dateRange     Json
  ownerId, shared
}

model CrmDashboard { tenantId, propertyId?, name, ownerId, shared }
model CrmDashboardWidget { dashboardId, reportId, x, y, w, h }
```

- **The compiler** turns a `CrmReport` into a parameterised query via the object registry: spine
  properties map to columns, custom properties to JSONB paths. Every query is tenant-scoped by RLS
  regardless, so a malformed definition can leak nothing.
- **The seven existing reports become seeded built-in definitions.** `reporting-service.ts` keeps
  its hand-written implementations as the fast path for those seven; the builder is how a tenant
  authors the eighth. Nothing regresses, and the built-ins double as worked examples a user can
  duplicate and edit — which is how a non-technical user actually learns a builder.
- **Charts** follow the `dataviz` skill's palette discipline and the `--chart-*` tokens already in
  `packages/ui/src/tokens.css`.
- **Language:** the surface asks "what do you want to count?" and "how do you want it broken down?"
  It does not say "measure", "dimension" or "aggregate".

## 9. Workstream G — workflow depth

Moves automation 6 → 9.

- **Branching.** An `if_else` node holding a `ConditionGroup` and two nested action lists, bounded
  to the same finite depth as `ConditionGroup` (and for the same reason — a non-recursive schema
  that converts to `$ref`-free JSON Schema for REST validation and MCP registration).
- **Goals.** A goal `ConditionGroup` on the automation; an enrollment that meets it exits early and
  is counted as converted. This is what turns run history into something a business owner can read.
- **New triggers:** `crm.property.changed`, `crm.association.added`, `form.submitted`,
  `email.opened`, `email.replied`, `deal.stage.changed`, `ticket.created`, `ticket.sla.breached`,
  `booking.created`.
- **New actions:** `crm.create_record` (any object, including custom), `crm.set_property`,
  `crm.rotate_owner` (round-robin assignment), `crm.add_to_list`, `service.create_ticket`,
  `engagement.send_email` (1:1 from a template), `voice.log_call_task`.
- **Enrollment analytics** per automation: entered / active / converted / exited, and per-step drop
  off — reading the `AutomationRun` + `AutomationRunStep` rows that already exist.

## 10. Workstream H — scoring, and lists that aren't rules

- **Lead scoring.** `ScoringModel { objectKey, rules: [{ condition: ConditionGroup, points }],
decayPerDay?, isActive }`, evaluated by the segment-evaluator consumer — which already re-runs on
  exactly the events that should move a score. Writes a new `customers.score` column (indexed
  descending) and a `ScoreEvent` row per change so "why is this 74?" is answerable. `Deal` gets the
  same treatment for deal health.
- **Static lists.** `Segment.kind` gains `static`. Membership is written by hand or by an automation
  action; `segment_members` is unchanged, so every consumer of a segment — broadcasts, sequences,
  reports — takes static lists for free.
- **List membership history.** `segment_members` already records `entered_at`; add an exit row so
  "who left the at-risk list this month" is a query rather than a guess.

## 11. Workstream I — the Company object

Moves companies 5 → 9. `B2BAccount` is doing two jobs: it is the platform's only company record,
and it is the B2B trading relationship. A design agency tracking accounts should not meet a credit
limit.

- Rename the table `b2b_accounts` → `companies` and the model `B2BAccount` → `Company`. Every column
  stays; nothing is dropped. This is a rename migration plus a mechanical rename across the code,
  and it is scheduled **late** on purpose — it touches a lot of files and should not sit in front of
  anything else.
- The AR/pricing/fleet fields (`creditLimit`, `paymentTerms`, `pricingTierId`, `fleetSize`,
  `engineProfiles`) become a **"Trade terms" panel gated on the `b2b` module**. Module off → the
  panel does not render and the fields keep their defaults.
- **Domain association**, opt-in per tenant: a new contact whose email domain matches an existing
  company's is offered that company. Offered, not applied — silent auto-association is how CRM data
  gets quietly wrong.

## 12. Workstream J — the remainder

- **E-sign on quotes.** `BillingDocumentSignature { documentId, signerName, signerEmail, signedAt,
ip, userAgent, signatureData, tokenHash }` plus a tokenised public signing page on `apps/site`.
  The rendering pipeline (`billing-render-service`, `billing-snapshot`) already produces the
  document; this adds the accept step and freezes the snapshot on signature.
- **Meeting links.** The scheduling module already books; what's missing is the CRM-side link — a
  rep's personal booking link, embeddable in a sales email template, whose booking writes a
  `meeting.booked` activity onto the contact.
- **Saved views.** Per-user saved filters + column sets on every list surface, since custom
  properties make "which columns?" a real question for the first time.
- **Duplicate management at scale.** The `duplicates` surface exists; it gains bulk merge, a
  configurable match rule (email / phone / name+company), and a per-tenant auto-merge threshold.

## 13. Cross-cutting rules

These apply to every object, property and surface introduced above. They are the difference between
a plan that scores 10 and a plan that scores 6 with a long tail of follow-ups.

1. **API-first.** Every object gets REST endpoints before it gets a surface, and MCP tools in the
   same slice. A capability an AI client can't reach isn't finished (root `CLAUDE.md`).
2. **RLS.** Every new table is `ENABLE` + `FORCE` RLS with a `tenant_isolation` policy, hand-written
   in the migration. Any in-migration backfill loops tenants with `set_config('app.tenant_id', …)`
   — the non-superuser footgun in `packages/db/CLAUDE.md`.
3. **Site scoping.** Every new tenant-scoped object carries `property_id` and follows docs/131's
   patterns — denormalise from the parent at creation, `SetNull` for records that outlive a site,
   `Cascade` for authored configuration.
4. **Events, not inline side effects.** New business events are published to Pub/Sub and consumed by
   workers; `EventType` in `packages/events/src/types.ts` is the catalog and topic name == event
   type.
5. **Modules.** Tickets/service activate as part of the `crm` module; calling gates on a configured
   voice provider. No new default-on anything ([[feedback_never_default_modules_on]]).
6. **UI.** silicaui components with `color × variant × size × shape`, Tailwind for layout only, no
   inline `style`, no eyebrows, no faded readable text, colour carrying state via `statusTone()`.
   Every list and board is responsive to the 3-tier collapse.
7. **Copy.** Written for a business owner. "The extra details you track", not "custom properties".
   "Who else is involved", not "associations". "What you're aiming for", not "goal criteria".
8. **Tests.** Each workstream ships integration tests in `packages/crm/test/integration/` including
   an RLS isolation case for every new table, matching the existing 20-suite pattern.
9. **Seed data.** Every new object gets rich demo rows in `prisma/seed.ts`
   ([[feedback_seed_rich_local_data]]) — a CRM with three contacts proves nothing.

## 14. Phasing

Ordered by what unblocks the most downstream work, with the one cheap high-visibility win first.
Migration directory names continue monotonically from `20270206000000` (the newest on disk).

| Phase | Workstream                                      | Migration                                                                                              | Moves                                                |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **0** | §4 Deal board                                   | — (no schema)                                                                                          | deals 5 → 8                                          |
| **1** | §3 Object registry + custom properties          | `20270207000000_crm_custom_properties`                                                                 | extensibility 1 → 7, contacts 6 → 8                  |
| **2** | §6 Associations                                 | `20270208000000_crm_associations`                                                                      | data model 8 → 10, deals 8 → 9                       |
| **3** | §5 Engagement spine (mailbox, 1:1, templates)   | `20270209000000_crm_engagement`                                                                        | engagement 2 → 8, activity 6 → 9                     |
| **4** | §7 Tickets + SLA + routing                      | `20270210000000_crm_tickets`                                                                           | service 0 → 9                                        |
| **5** | §8 Report builder + dashboards                  | `20270211000000_crm_reports_dashboards`                                                                | reporting 3 → 9                                      |
| **6** | §9 Workflow depth, §10 scoring + static lists   | `20270212000000_crm_workflows_scoring`                                                                 | automation 6 → 9, segmentation 7 → 10                |
| **7** | §3.6 Custom objects, §11 Company, §12 remainder | `20270213000000_crm_custom_objects`, `…14_crm_company_rename`, `…15_crm_signatures`, `…16_crm_calling` | extensibility 7 → 10, companies 5 → 9, quotes 9 → 10 |

Phase 0 is independently shippable in days and should not wait for the rest. Phases 1 and 2 are
strictly ordered — associations want the registry to name their endpoints. Phases 3–6 are
independent of each other once 1 and 2 land, so they can be worked in parallel or reordered against
whatever a real customer is asking for. Phase 7 is deliberately last because the company rename
touches the widest blast radius and should land when nothing else is mid-flight.

### 14.1 Where this actually stands

Written down because a plan that does not record what was built from it sends the next person to
re-read eleven sections to find out. **Read this before picking the work up again.**

| Phase   | Built | Browser-verified                 | Migrations (all APPLIED)                                                                            |
| ------- | ----- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| **0**   | ✅    | ✅                               | — (no schema)                                                                                       |
| **1**   | ✅    | ✅                               | `20270207000000_crm_custom_properties`                                                              |
| **2**   | ✅    | ❌ **never driven in a browser** | `20270208000000_crm_associations`                                                                   |
| **3**   | ✅    | ❌ **never driven in a browser** | `20270209000000_crm_engagement`, `20270210000000_crm_mailbox_imap_only`, `20270211000000_crm_calls` |
| **4**   | ✅    | ✅ (prod, 2026-08-07)            | `20270212000000_crm_tickets`                                                                        |
| **5**   | ✅    | ❌ **never driven in a browser** | `20270214000000_crm_reporting`                                                                      |
| **6–7** | ❌    | —                                | —                                                                                                   |

**THE BROWSER COLUMN IS THE MOST IMPORTANT ONE HERE.** The phase 0/1 browser pass found **six bugs
with typecheck and the full test suite green the whole time** — one of which left Save permanently
disabled and made the headline feature of phase 1 completely unusable. The phase 4 pass on
PRODUCTION (2026-08-07) then found three more, again with everything green:

- **The first request a tenant ever files rendered broken.** Opening one bootstraps the ticket
  pipeline and the default promise server-side, but `ticketKeys.policies` is `['crm','sla-policies']`
  and pipelines are `['crm','pipelines']` — neither under `ticketKeys.all`, so invalidating that
  missed both. The request showed a DISABLED stage picker labelled with a raw uuid beside a panel
  claiming no response promise was attached, while the row had both. Self-heals on reload.
- **Resolving a request produced a false breach days later.** `moveStage` stamped `resolvedAt` but
  never `firstRespondedAt`, and the sweep's `stillOwed('first_response')` only excludes CLOSED
  requests — so the commonest support flow there is (they ring, you fix it, you mark it Resolved)
  was later announced as a missed reply deadline. Settling now settles the reply promise too.
- **Every deadline was computed in UTC.** Bootstrap never passed a timezone and the editor's zone was
  a bare text box, so a shop in Denver had every deadline land six hours early. Now the business's
  own zone, chosen from the same city-labelled picker the entity profile uses.

Phases 2 and 3 still have tests and have never been driven by hand — associations, the mailbox
connect flow and click-to-call are unverified that way. **Phase 5 has never been driven by hand
at all**: the report builder, the live preview, the library and the dashboard grid all need a pass.
Treat their scores below as provisional.

**WHAT A PHASE 5 BROWSER PASS SHOULD LOOK FOR**, because tests cannot see any of it: that the
builder reads down the left column as an English sentence rather than a form; that the preview keeps
the last good numbers on screen instead of blanking on every keystroke; that changing the object
resets the breakdown rather than leaving a field that belongs to something else; that the
visualization list narrows honestly as the definition changes (a pie chart offered for an ungrouped
count is the bug); that a built-in opens read-only with a visible way to copy it; and that a
dashboard collapses to one readable column on a phone rather than two unreadable ones.

### Where the score actually sits

The audit in §1 opened at **5/10 overall**. Phases 0–3 put it at roughly **7**. What changed is the
SHAPE of the gap, not just the number: the audit's finding was "foundation 7–9, daily-use surface
2–5, missing primitives 0–1", and the primitives are now built, which moved six categories that look
unrelated. What remains is three areas that do not exist AT ALL rather than areas that are thin.

| Category               | Audit | Now    | Full plan | Blocked on                             |
| ---------------------- | ----- | ------ | --------- | -------------------------------------- |
| Data model & tenancy   | 8     | **10** | 10        | — done                                 |
| Sales engagement       | 2     | **9**  | 9         | — done                                 |
| Tasks & activity log   | 6     | **9**  | 9         | — done                                 |
| Deals & pipelines      | 5     | 9      | 10        | deal scoring (§10)                     |
| API, MCP & events      | 7     | 9      | 10        | ticket + report tools                  |
| Contact management     | 6     | 9      | 10        | saved views (NOT built)                |
| Quotes, invoicing & AR | 9     | 9      | 10        | e-sign (§12)                           |
| Lists & segmentation   | 7     | 8      | 10        | static lists, membership history (§10) |
| Extensibility          | 1     | 7      | 10        | custom-object surfaces (§3.6)          |
| Workflows / automation | 6     | 7      | 9         | phase 6 (intake routing landed)        |
| Companies              | 5     | **5**  | 9         | phase 7 untouched                      |
| Reporting & dashboards | 3     | **3**  | 9         | phase 5 untouched                      |
| Service / tickets      | 0     | 9      | 9         | — done, unverified in a browser        |
| **Weighted overall**   | **5** | **~8** | **10**    |                                        |

Verified absent as of this checkpoint (grepped, not assumed): no report builder or dashboard
service, no saved views. **Reporting is now the single biggest gap, and the one a business owner
notices fastest** — they can record everything and still cannot ask a question of it.

At this checkpoint, with all migrations applied and the client regenerated: `@sparx/crm` 37 files /
**322 tests**, `crm-schemas` 38, `field-schema` 34, `voice` 11, `links` 26, `time` (pure re-export
of what scheduling's 109 tests already cover). Repo-wide **typecheck 100/100**, **lint 97/97**,
`format:check` clean, the full suite **91/91 tasks** green under `CI=true`, all four structural
checks passing, and the RLS audit clean across **345 tables (313 tenant-scoped)**.

Of phase 4's 57 new tests, 32 are the pure clock (both DST boundaries) and 25 are integration
against the real schema — the second set matters more, because it is the only thing that has ever
executed `ticketService` and `ticketSlaSweep`. Writing it found nothing in the product and three
faults in the tests themselves, all the same one: they share a tenant, and a policy promoted to
default in one test legitimately changes what the next test is measured against.

**Phase 0** shipped a generic `RecordBoard<T>` (`apps/workbench/components/record-board.tsx`) rather
than a deal-specific one, so §7's ticket board is a parameterisation rather than a second board.
Dragging into a lost stage asks why, and that reason is now editable on the deal — it was being
captured and then never shown, which made a typo in it permanent.

**Phase 1** put the field engine in `@sparx/field-schema` (shared with CMS content types and
commerce product types) and added `coerce.ts` there — text→typed values, so the CSV importer can
read `"$4,800"` and `"3/14/2027"` and REFUSE what it cannot read rather than guessing. Import and
export both carry declared properties; export heads them `custom.<key>` so a round-trip does not
lose them. Sample data declares real properties on all 10 packs. **Clear deliberately does not
remove them** — a declared property is schema, and by the time someone clears sample data they may
have filled it in on hundreds of real records.

**Phase 2**'s load-bearing property is that `deals.customer_id` and the FKs like it stay correct:
promoting an association rewrites the column in the same transaction, removing the primary hands it
to a successor or clears it, and a merge moves links and collapses duplicates. `record-locator.ts`
holds the two things a polymorphic FK would have given us (does it exist, what is it called).

**Phase 3.** Threads and messages, 1:1 send, templates and snippets with send/open/reply counters,
and the engagement composer — which REPLACED the old note-only `ActivityComposer` rather than sitting
beside it. Then the two halves that were outstanding:

- **Mail sync (§5.2) — and the decision that reversed the plan.** Connecting a mailbox over the
  Gmail API or Microsoft Graph needs Google's restricted-scope **CASA assessment** and Microsoft's
  **publisher verification** — a recurring third-party security audit as the standing price of a
  connector. **IMAP/SMTP only**, therefore; it reaches the same mailboxes (Gmail and 365 both speak
  it) over an app password the tenant issues and revokes themselves. `20270210000000` drops the OAuth
  columns `20270209000000` had added, one migration later, because a `access_token_enc` column on a
  table that stores no tokens is an invitation to half-build the thing again. Polling, not IDLE;
  `UIDVALIDITY` stored with the cursor; sending over the mailbox's own SMTP with a Sent-folder
  `APPEND`; automated mail filtered before the privacy gate. Protocols are pure and tested in
  `@sparx/crm/mail`; sockets are in api-rest.
- **Calling (§5.6).** `packages/voice` mirrors `@sparx/sms` — provider contract, Twilio adapter,
  console fallback, registry — except that the credentials are the **tenant's own**, never the
  platform's. Click-to-call rings the rep's phone FIRST and bridges to the customer, because dialling
  from a browser tab needs WebRTC, a mic permission and a headset, and fails exactly when someone
  needs it. The timeline entry is written when the provider says the call ENDED, never at placement —
  a call that was placed is not a call that happened. Webhooks are idempotent on the provider's call
  id, and the outcome is **correctable**, because a six-second "completed" call is a voicemail
  greeting about as often as it is a conversation. Recording is off by default and stays that way.

**Phase 4.** The intake finally has somewhere to go. Five things are worth knowing before touching
it again:

- **A ticket has no status column.** Its state is the pipeline stage it sits on, so `moveStage` is
  the only sanctioned state change — it stamps `resolved_at`/`closed_at`, writes the timeline entry
  and emits the event a tenant's rules fire on, and a plain field write would skip all three. That
  is the same guard `dealService` carries, for the same reason. `Pipeline.objectKey` is what makes
  it possible: the board and the funnel report work on tickets unchanged, and a deal pipeline is
  refused a `resolved` stage (`stageTypesFor`) because a deal on one vanishes from the forecast and
  the funnel's denominator at once — silently, and only in the reports.
- **The clock is resolved once, at creation**, and stored as four absolute instants (due + warn, per
  promise). Never recomputed on read: a policy edited in March must not move what was promised in
  February. Re-prioritising DOES re-promise — measured from when the request arrived, not from the
  escalation, because restarting the clock would reward being slow to notice. The warn instants are
  stored rather than derived, because 80% of a business-hours budget is not 80% of the wall-clock
  interval it spans; a sweep deriving it would be quietly wrong on every overnight request.
- **`sla-clock.ts` is pure and carries 32 tests**, including both DST boundaries. It counts in real
  elapsed milliseconds between UTC instants rather than in local minute arithmetic, which is what
  makes a desk open 9–5 across a spring-forward day come out as seven real hours.
- **The sweep is idempotent by construction** — every query carries a "not already announced" guard
  and the statement that stamps the row is the same one that claims it, so an overlapping run or a
  pod that dies halfway announces nothing twice. Breaches are checked before warnings, so a request
  that crossed both marks between two runs is reported as breached rather than twice.
- **Routing is the tenant's, not ours.** One `crm.create_ticket` action serves chat, forms and
  inbound email — the difference is the trigger, not what happens next — and it dedupes on the
  origin id (`crm_tickets_source_record_key`), because automations retry and "fires twice on one
  conversation" is the normal case. Answering on a request's thread is what records the first
  response; a "mark as responded" button would be forgotten on exactly the days a queue is busy
  enough for it to matter.

**What needs a person, not code:**

- New env keys, both optional and both inert when unset: `CRM_MAILBOX_TOKEN_KEY` (encrypts the app
  password) and `CRM_VOICE_TOKEN_KEY` (encrypts the phone system's auth token). One key per
  capability, following `SEARCH_CONSOLE_TOKEN_KEY` / `SCHEDULING_CALENDAR_TOKEN_KEY` /
  `CHANNELS_TOKEN_KEY` — a compromised key should cost one capability, not every connected account
  a tenant owns.
- `k8s/cronjobs/crm-mailbox-sync.yaml` is the ONLY thing that brings inbound mail onto a timeline.
  Nothing arrives if it is not deployed.
- `k8s/cronjobs/crm-sla-sweep.yaml` is the ONLY thing that notices a response promise is about to be
  missed. Without it every due date in `crm_tickets` is a number in a column nobody reads, and the
  two `crm.ticket.sla.*` topics never fire.
- Nothing else. `20270212000000_crm_tickets` is applied and the client regenerated.

## 15. The scorecard, after

| Category               | Now   | After  | What closes it                                             |
| ---------------------- | ----- | ------ | ---------------------------------------------------------- |
| Quotes, invoicing & AR | 9     | **10** | E-sign (§12)                                               |
| Data model & tenancy   | 8     | **10** | Associations + registry (§3, §6)                           |
| Lists & segmentation   | 7     | **10** | Custom-property sources, static lists, membership history  |
| API, MCP & events      | 7     | **10** | Full object/property/association coverage (§13.1)          |
| Contact management     | 6     | **10** | Properties, associations, engagement composer, saved views |
| Workflows / automation | 6     | **9**  | Branching, goals, new triggers + actions, enrollment stats |
| Tasks & activity log   | 6     | **9**  | Inbound capture, composer, call logging                    |
| Companies              | 5     | **9**  | Generalised Company + domain association (§11)             |
| Deals & pipelines      | 5     | **10** | Board, multi-contact, deal properties, deal scoring        |
| Reporting & dashboards | 3     | **9**  | Report builder + dashboards (§8)                           |
| Sales engagement       | 2     | **9**  | Mailbox, 1:1 email, templates, calling (§5)                |
| Extensibility          | 1     | **10** | Registry, properties, custom objects, associations         |
| Service / tickets      | 0     | **9**  | Ticket object, SLA, routing (§7)                           |
| **Weighted overall**   | **5** | **10** |                                                            |

The four categories that land at 9 rather than 10 stop there for a reason: each one's last point is
a maturity curve (workflow branching sophistication, conversation intelligence, forecast accuracy,
service reporting depth) rather than a missing capability. They are 10s on the axis a small business
can see, which is the axis this plan optimises.

## 16. Explicitly out of scope

Named so they don't get quietly assumed in:

- **Marketing Hub breadth** — ad platform management, SEO recommendations, blog hosting. sparx's CMS
  and builder cover the site side already; ad-network buying is a different product.
- **Conversation intelligence** — call transcription, keyword tracking, coaching. Depends on running
  an AI model over a customer's calls, which would be a platform-level AI credential and is
  therefore prohibited outright ([[feedback_no_platform_ai_byok_only]]). Revisit only as tenant-BYOK.
- **Sales forecasting with quota management** — the weighted forecast exists; per-rep quota
  attainment, forecast submission and roll-up are a sales-management product, not a CRM primitive.
- **A CRM mobile app.** The workbench is responsive; a native app is a separate decision.
