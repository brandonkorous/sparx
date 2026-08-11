# 144 — CRM: from 5 to 10

Version: 1.3 (docs/144 complete; the surface-by-surface sweep is in progress — §14.1 carries the running list of what using it as its owner has found)
Author: Brandon Korous
Last Updated: 2026-08-10

> **Status: IN PROGRESS.** This is the implementation plan for closing the gap between the sparx CRM
> as it stands today and a CRM that beats HubSpot on every axis a small business can see. §2 is an
> audit of what already existed when the plan was written and is deliberately specific, because most
> of this plan is _extending_ working machinery rather than starting anything.
>
> **All seven phases are built** — data layer, services, REST, MCP and every surface, driven in a
> browser rather than through the API. §14.1 records what the browser pass found, the two items
> still open (neither is a feature), and the traps worth knowing before touching this again.
> Decisions reversed or deviated from during the
> build are recorded in the section they belong to — mailboxes are **IMAP/SMTP only**, never the
> Gmail API or Microsoft Graph (§5.2); a support promise carries its **own** business-hours calendar
> rather than reusing the Scheduling module's (§7.3); the report built-ins are eight new definitions
> rather than the seven hand-written reports (§8); and branching compiles to a flat program rather
> than being walked as a tree (§10). §14.1 is the first thing to read before picking this up again.

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

**BUILT 2026-08-08. Four deviations from the above, all deliberate — read these before changing
anything here.**

1. **The built-ins are EIGHT NEW definitions, not the seven hand-written reports.** The plan says the
   existing seven "become seeded built-in definitions". They cannot: `pipelineFunnel`,
   `winLossByRep`, `leadsBySource` and `segmentSummary` are joins and window functions, and the
   compiler reports over ONE object on purpose (below). Seeding them as definitions would have meant
   either growing a join planner or shipping examples that do not run. Instead `report-builtins.ts`
   ships eight questions that ARE expressible — which is what makes them honest as worked examples:
   every one is something a tenant could have built themselves. `reporting-service.ts` is untouched
   and still serves the seven at `/v1/crm/reports/snapshot`, `/pipeline-funnel`, … Nothing regressed.
2. **No join planner, and there should not be one.** "Deals by customer country" is not expressible.
   The moment this grows joins it needs a cost model, and a business owner dragging fields together
   can trivially write a query that reads the whole database. Genuinely cross-object questions stay
   hand-written in `reporting-service.ts`.
3. **The reportable columns are a hand-written allowlist in `report-compiler.ts`**, not reflection
   off Prisma's DMMF. Reflection would expose every column the moment somebody added one — tokens,
   hashes, internal bookkeeping — and "reportable" is a product decision, not a schema one. The map
   is also the builder's field picker, so a wrong entry is a field a person can choose and then be
   told does not exist; the integration suite therefore EXECUTES every offered field against the real
   database. (That test exists because the first version invented `country` and `city` on Customer
   and `assigned_to_id` on Task. All three compiled into valid SQL and failed only at Postgres.)
4. **The address is `/crm/report-builder`, not `/crm/reports`** — the latter already belongs to the
   fixed set sparx computes. The two route files sit on the same API prefix; the static paths take
   Fastify router precedence over `/:id`, so they coexist without ordering games.

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

**BUILT 2026-08-08 (§9 + §10 together, migration `20270215000000_crm_workflow_depth_and_scoring`).
Six deviations from the above, all deliberate — read these before changing anything here.**

1. **Branching COMPILES to a flat program; it is not walked as a tree.** A run's position is
   `automation_runs.cursor_index` — one integer, written after every step, and the reason a crash or
   redeploy resumes exactly where it left off instead of replaying committed effects. Walking the
   tree would have made the cursor a PATH: a schema change to a hot column, a new parser, and a new
   class of bug where a path no longer resolves. Instead `engine/compile.ts` lowers the tree to
   numbered steps with explicit forward jumps, exactly as a compiler lowers an `if`. The flattening
   is a pure function of the stored actions, so another pod re-derives byte-identical indices.
   18 unit tests pin determinism, forward-only jumps, and reachability per arm.
2. **The nested action lists live in an opaque `config`, not in `Action` itself.** The obvious move
   is three finite union levels, the way `ConditionGroup` nests. It was rejected for the reason that
   technique exists: the schema converts to JSON Schema for REST validation AND MCP tool
   registration, and a three-level union of objects each holding two arrays of the level below
   produces a tool schema several times the size of the rest of the automation contract — for a
   field most rules never use. `config` stays a flat record, so the wire shape and every generated
   schema are EXACTLY as they were before branching existed. The cost is paid explicitly:
   `IfElseConfig` parses the payload at the authoring boundary via `validateActionTree`, and the
   compiler parses it AGAIN at run time, because a row written before a schema change must fail
   loudly rather than branch arbitrarily.
3. **`service.create_ticket` was NOT built.** `crm.create_ticket` already does that job — it was
   built for intake routing in §7.4 and takes the same config, resolves the same assignee, and opens
   the same request. A second name for it would put two indistinguishable entries in the palette.
   Six of the seven planned actions shipped; this is the seventh, and it already existed.
4. **The condition evaluator MOVED to `@sparx/automation-schemas`.** `ConditionGroup` is now the
   filter language of three things — automations, the report builder (§8) and scoring — which only
   works if all three agree on what a condition MEANS. With the evaluator inside `@sparx/automation`,
   packages that cannot depend on the engine had two options: take the whole engine for one pure
   function, or write their own comparison semantics. The second is how `contains` comes to mean
   something subtly different in scoring than in automations, and nobody finds out until a
   customer's numbers disagree with their rules. `packages/automation/src/conditions/evaluate.ts` is
   now a re-export, so every existing import path still works.
5. **Scoring rides its own consumer, not the segment evaluator.** The plan put it inside the segment
   evaluator on the grounds that that consumer already re-runs on the right events — true of the
   topic set, wrong about the file. Two independent jobs sharing one transaction means a scoring bug
   rolls back a membership change and vice versa, and neither failure is findable from the name of
   the file it happened in. `consumers/scoring-evaluator.ts` watches the SAME topics plus the
   deal-side ones, and no-ops entirely for a tenant with no model — which is every tenant until
   somebody writes one.
6. **A score is a SUM of every matching rule, never a first-match ladder.** A ladder makes rules
   position-dependent, so inserting one in the middle silently changes what two others do. A sum
   lets each rule be read on its own, which is what makes "why is this 74" answerable by listing the
   rules that matched in any order. Decay applies to the EARNED total before clamping, so two
   records both sitting at the ceiling age differently — which is the distinction decay exists to
   preserve. 16 unit tests pin the arithmetic; the integration suite executes every field the editor
   offers against a real record, for the reason recorded in §8's deviation 3.

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

| Phase | Workstream                                      | Migration                                                           | Moves                                                |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| **0** | §4 Deal board                                   | — (no schema)                                                       | deals 5 → 8                                          |
| **1** | §3 Object registry + custom properties          | `20270207000000_crm_custom_properties`                              | extensibility 1 → 7, contacts 6 → 8                  |
| **2** | §6 Associations                                 | `20270208000000_crm_associations`                                   | data model 8 → 10, deals 8 → 9                       |
| **3** | §5 Engagement spine (mailbox, 1:1, templates)   | `20270209000000_crm_engagement`                                     | engagement 2 → 8, activity 6 → 9                     |
| **4** | §7 Tickets + SLA + routing                      | `20270210000000_crm_tickets`                                        | service 0 → 9                                        |
| **5** | §8 Report builder + dashboards                  | `20270211000000_crm_reports_dashboards`                             | reporting 3 → 9                                      |
| **6** | §9 Workflow depth, §10 scoring + static lists   | `20270212000000_crm_workflows_scoring`                              | automation 6 → 9, segmentation 7 → 10                |
| **7** | §3.6 Custom objects, §11 Company, §12 remainder | `20270216000000_crm_company_rename`, `20270217000000_crm_workspace` | extensibility 7 → 10, companies 5 → 9, quotes 9 → 10 |

> **THE MIGRATION NAMES IN THIS TABLE ARE THE ORIGINAL PLAN, NOT WHAT SHIPPED.** Every phase landed
> on a later prefix than planned, because unrelated work was interleaved. `20270213000000`,
> `…14000000` and `…15000000` are **all applied already** — `golden_blueprint_backfill_scan`,
> `crm_reporting` and `crm_workflow_depth_and_scoring` respectively. §14.1 carries the real names.
>
> **Phase 7 started at `20270216000000`, as that rule required.** Prisma orders migrations
> lexicographically by directory name, so authoring `20270214000000_crm_company_rename` from the
> original table would have produced a never-applied migration sorting BEFORE applied ones — and
> `migrate deploy` refuses that mid-release, after the roles Job has already run. See
> packages/db/CLAUDE.md. **Neither phase-7 migration has been applied yet** — see §14.1.

Phase 0 is independently shippable in days and should not wait for the rest. Phases 1 and 2 are
strictly ordered — associations want the registry to name their endpoints. Phases 3–6 are
independent of each other once 1 and 2 land, so they can be worked in parallel or reordered against
whatever a real customer is asking for. Phase 7 is deliberately last because the company rename
touches the widest blast radius and should land when nothing else is mid-flight.

### 14.1 Where this actually stands

Written down because a plan that does not record what was built from it sends the next person to
re-read eleven sections to find out. **Read this before picking the work up again.**

| Phase | Built   | Browser-verified                                              | Migrations (all APPLIED)                                                                                           |
| ----- | ------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **0** | ✅      | ✅                                                            | — (no schema)                                                                                                      |
| **1** | ✅      | ✅                                                            | `20270207000000_crm_custom_properties`                                                                             |
| **2** | ✅      | ❌ **never driven in a browser**                              | `20270208000000_crm_associations`                                                                                  |
| **3** | ✅      | ❌ **never driven in a browser**                              | `20270209000000_crm_engagement`, `20270210000000_crm_mailbox_imap_only`, `20270211000000_crm_calls`                |
| **4** | ✅      | ✅ (prod, 2026-08-07)                                         | `20270212000000_crm_tickets`                                                                                       |
| **5** | ✅      | ❌ **never driven in a browser**                              | `20270214000000_crm_reporting`                                                                                     |
| **6** | ✅      | ❌ **never driven in a browser**                              | `20270215000000_crm_workflow_depth_and_scoring`                                                                    |
| **7** | ✅ done | ✅ driven in a browser end to end, 12 defects found and fixed | `20270216000000_crm_company_rename`, `20270217000000_crm_workspace`, `20270218000000_crm_company_rename_functions` |

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
connect flow and click-to-call are unverified that way. **Phases 5 and 6 have never been driven by
hand at all**: the report builder, the live preview, the library, the dashboard grid, the branch
canvas, the goal node, the enrollment funnel and the scoring editor all need a pass. Treat their
scores below as provisional.

**WHAT A PHASE 5 BROWSER PASS SHOULD LOOK FOR**, because tests cannot see any of it: that the
builder reads down the left column as an English sentence rather than a form; that the preview keeps
the last good numbers on screen instead of blanking on every keystroke; that changing the object
resets the breakdown rather than leaving a field that belongs to something else; that the
visualization list narrows honestly as the definition changes (a pie chart offered for an ungrouped
count is the bug); that a built-in opens read-only with a visible way to copy it; and that a
dashboard collapses to one readable column on a phone rather than two unreadable ones.

**WHAT A PHASE 6 BROWSER PASS SHOULD LOOK FOR.** The compiler is pinned by 18 unit tests and the
scoring arithmetic by 16, so the risk here is entirely in the two surfaces:

- **The branch canvas.** That a branch's two arms read as belonging to the card above them rather
  than as steps of their own; that dragging a top-level step does not pick up a nested one (the
  arms render OUTSIDE the drag surface for exactly this reason); that selecting a nested step opens
  it in the inspector and that deleting it selects the branch rather than nothing; that a nested
  branch indents legibly instead of marching off the right edge; and that the whole thing collapses
  to one column on a phone.
- **The goal node** sits at the BOTTOM of the pipeline, after the steps. Check that emptying every
  line clears the goal rather than storing an empty group — an empty group passes for everything,
  which would convert every run at enrollment and report 100%.
- **The enrollment funnel** opens by DEFAULT over the run list. With no goal set it must say so in
  words rather than showing a grey 0%.
- **The scoring editor's preview** is the thing that makes it usable — check it keeps the last good
  breakdown while the next runs, and that a rule with no field selected does not fire a request.
- **A hand-picked list refuses nothing silently.** Switching a rule-driven list to hand-picked
  should keep its rules visible on switching back, and the members panel should only appear once
  the list exists.

**WHAT A PHASE 7 BROWSER PASS SHOULD LOOK FOR.** The rename is pinned by 400 passing CRM tests
and the RLS audit, so the risk is NOT in the data — it is in the four surfaces, and in one thing
tests structurally cannot see.

- **THE RENAME'S BLAST RADIUS IS THE WHOLE APP, NOT THE CRM.** ~125 files changed and typecheck
  cannot see a wrong LABEL. Open a commerce order, a B2B account, an invoice, a booking and a chat
  conversation and check the customer's employer still renders — those all read the field that
  moved from `company` to `companyName`. A blank where a company name used to be is the failure
  mode, and it looks like missing data rather than a bug.
- **The company pane with the `b2b` module OFF.** No credit limit, no payment terms, no discount,
  no price tier, no fleet size, and no credit read-out in the toolbar. Then turn `b2b` on and
  confirm the values that were hidden are still there — the whole point is that they were preserved,
  not dropped.
- **The domains field.** Paste `https://www.acme.com/pricing` and `@acme.com` into it; both should
  save as `acme.com`. Then check the settings screen: with the suggestion switched OFF, the match
  endpoint must return nothing at all rather than a suggestion nobody asked for.
- **The duplicates screen.** Every cluster carries a confidence AND a reason. The bulk action offers
  only the CERTAIN ones — if it ever offers to sweep up a "worth a look" group, that is the bug,
  because those are two colleagues as often as one person.
- **The signing page** (`/sign/<token>` on the storefront). Walk all five states: sign one, decline
  one with a reason, let one expire, re-request on a document that already has a pending link (the
  first must stop working), and open a signed one again. The signed state must show WHEN and offer
  nothing further. The lines and total must sit above the buttons on a phone.
- **Booking links.** Create one, copy it, open it. An archived link must say it is no longer in use
  rather than 404 — somebody is clicking it out of an old email.
- **A custom object end to end.** Invent a record type, add three fields, press Open on it, add a
  row, edit it, relate it to a contact. Nothing on either surface should be hardcoded to a built-in.

### Phase 7 — exactly where it stands

**COMPLETE, AND DRIVEN IN A BROWSER AS A BUSINESS OWNER RATHER THAN AS A DEVELOPER.** Data,
services, REST, MCP and every surface are built; `/meet/[slug]`, the signature panel on the
document pane, the association offer, the company's People list, the saved-views menu on the customers list
and launcher entries for tenant-defined record types all landed on 2026-08-10.

**WHAT THE BROWSER PASS FOUND, AND WHY IT MATTERS FOR THE NEXT PHASE.** Twelve defects, every one
of which typechecked, linted and passed 400 tests. That is the point worth carrying forward: this
phase's failure mode was never a broken function, it was a correct function nobody could reach or
whose result nobody could see.

| What an owner saw                                                          | What was actually wrong                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "An internal error occurred" when adding a contact already on file         | P2002 escaped `customerService.create`/`update` as a 500. Now a 409 naming the person who has the address — the 500 is what sends somebody back to type a variant address and MAKE the duplicate                                            |
| The Company column blank on every customer, in every app                   | The rename moved the Prisma field to `companyName`, so `company` vanished from every payload — orders, chat, invoices, bookings, carts. Restored as a derived field on the Prisma client, so all ~120 embed sites are right by construction |
| `$0.00` credit limit and "No agreed terms" on a dental practice            | The companies LIST never got the `b2b` gate the detail pane had. Now People + email domains, with trade columns arriving and leaving with the module                                                                                        |
| "Fleet size" asked of a caterer                                            | A trade field AND an industry assumption, sitting outside the gate                                                                                                                                                                          |
| A company saying "nothing is linked" while the list said 1 person          | The pane showed the association graph but never its own `companyId` contacts                                                                                                                                                                |
| Turning on domain suggestions changing nothing                             | Written per SITE by the settings screen, read at TENANT scope by `match-domain`. Both now use one shared `activeCrmSite` helper                                                                                                             |
| The whole settings pane                                                    | Crashed — `FieldLabel` outside a `Field` root                                                                                                                                                                                               |
| Clicking "Yes, file them there" appearing to do nothing                    | Typed and filed rendered identically. A filed company is now a link to the company                                                                                                                                                          |
| A merge demoting a paying customer to a lead                               | Lifecycle stage now takes the furthest-along value in the group, whichever record is kept                                                                                                                                                   |
| **A merge silently re-opening somebody who had asked not to be contacted** | `doNotContact: false` is not `null`, so fill-what-is-missing never looked at it. Now it only ever ratchets up                                                                                                                               |
| **Duplicate detection running tenant-wide**                                | On a tenant with two unrelated businesses, one person known to both scored 100 and `bulkMerge` would have combined them. Buckets are now per-site, and `merge()` itself refuses across sites since MCP and REST call it directly            |
| A customer asked to "Accept this draft"                                    | The stage's internal label leaked out as the document's noun. A draft stage now reads as "document" to the signer, and the sender is warned before asking                                                                                   |

**THIS FINDING IS NOW FIXED** — see §14.1. Kept for the reasoning.
`customers_tenant_property_email_unique` is
`(tenant_id, property_id, email)`, and Postgres counts NULLs as DISTINCT — so two TENANT-WIDE
customers can hold the same address and never collide. The constraint protects site-scoped contacts
only, which is why the seed data has two global rows on one address and why duplicate DETECTION has
to exist alongside the constraint rather than as a backstop to it. Changing this is a migration
and a data clean-up. `NULLS NOT DISTINCT` turned out to be the WRONG instrument (it would
break contacts with no email); a partial index was the right one.

**All three migrations are applied and the client is regenerated.** Green as of 2026-08-09:
typecheck (101 projects), lint (98), `pnpm test` (92 tasks, including the DB-backed CRM suite at
400 passing), `format:check`, all four structural checks, and the RLS audit at **355 tables (323
tenant-scoped)** — exactly +4 for the four new tables.

**THE RENAME BROKE TWO DATABASE FUNCTIONS, AND ONLY THE INTEGRATION SUITE FOUND IT.**
`ALTER TABLE … RENAME` updates the catalog; it does NOT rewrite the body of a plpgsql function,
because a body is stored as text and parsed only when it runs. `sync_b2b_credit_used` and
`resolve_b2b_price` both kept saying `b2b_accounts` and started failing at runtime the moment the
rename landed. The first is the single money chokepoint every billing-document create / line /
payment / void funnels through, so it took that whole write path down — silently, because nothing
calls it at boot. `20270218000000_crm_company_rename_functions` redefines both. **If another table
with a function over it is ever renamed, look here first.**

#### Built and complete

| Piece               | What landed                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §11 the rename      | `b2b_accounts` → `companies`, `B2BAccount` → `Company`, `b2b_account_id` → `company_id` on 11 tables, ~125 TS files, REST, GraphQL, MCP                                  |
| §11 domains         | `companies.domains` + GIN index, `matchByEmailDomain` with a public-provider blocklist, `GET /v1/crm/companies/match-domain`                                             |
| §11 trade terms     | The AR/pricing/fleet block gated on the `b2b` module in the company pane, values preserved while hidden                                                                  |
| §12 settings        | `crm_settings`, `crmSettingsService`, `GET/PATCH /v1/crm/settings`, the "How the CRM behaves" surface                                                                    |
| §12 saved views     | `crm_saved_views`, `savedViewService`, five REST routes, MCP tools, the workbench data layer                                                                             |
| §12 e-sign          | `billing_document_signatures`, `signatureService` (request/sign/decline/revoke/expire), staff + public REST, snapshot frozen at signature, stage advanced to `committed` |
| §12 meeting links   | `crm_meeting_links`, `bookings.meeting_link_id`, `meetingLinkService`, staff + public REST, the "Booking links" surface                                                  |
| §12 duplicates      | Configurable match rules, a confidence per group, `bulkMerge` with a required floor, REST + MCP                                                                          |
| §3.6 custom objects | `records-list` + `record-detail`, one pair for every tenant-invented object, reached from the record-type list                                                           |
| plumbing            | 4 new `CrmTopic`s + their Terraform topics, 4 new link routes, 12 new MCP tools                                                                                          |

#### What is left

Everything listed here previously — the duplicates confidence model, the signature panel, the
`/meet/[slug]` page, the domain-match offer, launcher entries for custom objects and the
integration suite — is BUILT and was driven in a browser on 2026-08-10. **Saved views now cover
every CRM list**, also driven in a browser: Customers, Companies, Deals (board and table),
Requests, and the generic list that serves a tenant's own record types. `pnpm --filter @sparx/db
build` is verified (it needed one run with dev stopped — `prisma generate` cannot replace the
query-engine DLL while a dev server holds it). The NULL-site uniqueness finding is now FIXED, and
chasing it turned up a considerably worse bug in `mergeService`; both are below.

#### Tenant-wide contacts could share an email — fixed, and what it cost to fix

`20270220000000_crm_customer_tenant_wide_email_unique` adds
`customers_tenant_global_email_unique`, a PARTIAL unique index over
`(tenant_id, email) WHERE property_id IS NULL AND email IS NOT NULL AND deleted_at IS NULL`.

- **Not `NULLS NOT DISTINCT` on the existing index.** That keyword applies to the whole index, so it
  would also make two contacts with NO email collide — and a phone-only contact is completely
  normal. "You cannot save the second walk-in" would be a far worse bug than the one being fixed.
  There is a test for exactly this.
- **Live rows only**, unlike the site-scoped index which deliberately counts deleted ones. At site
  scope a deleted contact holding its address is a feature (the app can say "it is in your bin"); at
  tenant scope the same rule would let one deleted contact reserve an address across every site the
  business runs, permanently.
- **It cleans up only what is unambiguously empty** — rows no other table references at all — and
  then RAISES with the list of anything left, rather than merging records unattended. The tenant
  loop with `set_config('app.tenant_id', …)` is load-bearing: `customers` is FORCE RLS and
  `sparx_owner` is a non-superuser in prod, so a query without it returns zero rows there while
  passing locally on a superuser, and the cleanup would silently do nothing before the index failed
  the deploy. **If it does fire in a deploy, recovery is two steps** — merge the pairs it names, then
  `prisma migrate resolve --rolled-back …` before re-running, because Prisma records the attempt as
  failed and later deploys refuse until that record is cleared.

#### The sweep — using every CRM surface as its owner (2026-08-10, continuing)

Nine more gaps, none of which typecheck, lint or 420 tests could see. The pattern across almost all
of them: **the API already did the work and no screen asked it.** That is API-first behaving as
designed on the server and being left half-spent on the client, and it is where the next reviewer
should look first.

**The company was a dead end.** It knew who worked there and nothing else — no invoices, no deals,
no requests, though all three carry a `company_id` and all three were already filterable
(`b2b_account_id` on the wire, the name that survived the rename). Added as read-only sections.

**A company's debt includes its people's.** Billing a named contact writes `customerId` and leaves
`companyId` null — correct, that is who the document is made out to — so filtering by company alone
reported a trade account as debt-free while somebody there was 60 days late. `billing-document-
service.list` now ORs in `{ customer: { companyId } }`, wrapped in `AND` so it composes with the `q`
search instead of one `OR` key overwriting the other. Verified: Meridian Architects shows the $3,800
that is really Marcus Lien's.

**Segments, five findings:**

1. **The list had no member counts** — six names, no sizes, and the only way to learn one was to
   open it. `segmentMembership(count)` already existed in the data layer, written for this list and
   never given a count. Now `include: { _count: { select: { members: true } } }` on the list query.
2. **A NEW SEGMENT NEVER FILLED.** The evaluator is entirely CUSTOMER-driven: when one person
   changes, re-check that person against every segment. Creating a segment changes no person, so
   nothing ran — the builder counted "24 of 24 match", the owner pressed Create, and the list said
   "No members yet" beneath a screen promising "anyone who matches is added automatically". It is
   also why five of six built-ins sat at zero. `crm.segment.created` / `.updated` were already
   published and already in the topic union; there was no subscriber. Added the segment-driven pass
   to `segment-evaluator`, honouring the `rulesChanged` flag so a rename does not pay for a scan.
3. **No way to refill one.** Scoring has a recompute button; segments had none, and a SEEDED segment
   never fires a create event — so an owner looking at an empty group they knew should have people
   in it had nothing to press. Added "Update membership" (rule-driven segments only: re-cutting a
   hand-picked list would empty something somebody built by hand).
4. **The preview counted people the segment could never contain.** A segment draws from one site
   plus the tenant-wide contacts and the evaluator enforces that; `previewCount` scanned the whole
   tenant. Hence "24 of 24 match" → 22 members, unexplained — and the count was quietly describing
   another business's customers. Scoped in the service, defaulted in the route exactly like `create`
   does. Now "22 of 22".
5. **Seven surfaces said the same sentence twice.** `<AlertTitle>Could not save this X</AlertTitle>`
   over a description of "Could not save this X. Nothing was changed." — company, customer, deal,
   pipeline, request, segment, task. It only surfaces on a non-4xx failure, which is precisely when
   somebody needs to be told what to do.

**Scoring: the number was computed, stored, and shown nowhere.**

This is the largest single gap the sweep has found, and the cleanest example of the pattern behind
almost all of them — _the API already did the work and no screen asked it._

Everything below the surface was finished. `scoringService` resolves each record's own site's model,
sums the matching rules, subtracts decay, clamps, writes the record's `score`, and writes a
`score_events` row carrying the delta, the new total and the rule labels that produced it — and
writes nothing at all when the number did not move, so a chatty integration cannot bury the real
reasons. `/preview` returns a live breakdown from the saved model. `/history` returns the events.
`/adjust` moves a score by hand with an actor and a reason. `score` and `scored_at` are columns on
both `customers` and `deals`.

**None of it reached a screen.** `useScoreHistory`, `useAdjustScore`, `scoreBand` and `SOURCE_LABEL`
were written in `scoring-data.ts` and imported by nothing; a grep for `score` across all 57 CRM
surface files returned the scoring editor and nothing else. So an owner could write rules, watch the
live preview land on somebody they recognised, press "Re-score everyone", be told _"142 of 300 scores
changed"_ — and then have no way to see a single one of them. The service header comment describes a
contact's score panel reading `74 · Opened three emails +20 · No order in 90 days −10`. That panel
did not exist. The rules editor was a form that fed a void.

Built:

- **`score-panel.tsx`**, on the customer's Overview tab (with the money, because "are they worth my
  time" is the question that tab exists to answer) and on the deal editor. It answers the three
  questions in the order they get asked: what is the number and is that good (the figure, plus a
  band — an owner acts on _Hot_, never on 61-versus-64); why is it that number (the rules that
  matched, each with its points, plus decay as its own line); and can I change it (adjust, with a
  required reason — a hand-moved score is the one entry in the history the rules cannot account for,
  and without a sentence saying why, next month's reader finds an unexplained jump and stops
  trusting every other number on the panel).
- **The "no model" state, which is the common one and is not an error.** A business that never set
  scoring up has no model and every record sits at zero. Rendering a confident `0` there would read
  as "we scored them and they came out worthless" — a lie about a customer. The panel says what
  scoring is for and links to the screen that sets it up.
- **A staleness line.** The stored number and the live breakdown can legitimately disagree. The panel
  says which of the two reasons it is rather than showing numbers that quietly differ — see the
  banner finding below.
- **A score column and a "Best score first" sort on the customers list**, and a health badge on the
  deal board's cards. Both appear only once a model exists: a column of zeros on a tenant that never
  wrote a rule invents a ranking out of an unconfigured feature. `sort_by=score` needed adding to
  the list endpoint's enum and the service's union — three characters of plumbing standing between
  a finished scoring engine and the one question it is FOR, "who do I call first".

**Then driving it end to end found four more, none of which any test could have caught.** A model
was written in the browser (spend ≥ $500 → +30, orders ≥ 1 → +20), saved, and run over the tenant:
"6 of 24 scores changed", and the numbers were right — Dana Whitfield 50, Priya Nair 20 on $90.24
of orders, because only the second rule fires for her.

1. **A SAVED MODEL COULD NOT DISPLAY ITS OWN OPERATORS.** Every "is at least" went blank the instant
   the editor re-seeded from the server — which is every time anybody reopens their scoring rules.
   The stored JSON was always intact (checked in Postgres); the screen simply could not say what it
   held, so an owner returning to their rules saw two fields and a hole where the comparison should
   be. The cause: `items` and `value` were both built inline on every render, and the Combobox
   resolves the selected item **by reference**, so nothing ever matched. It looked correct while the
   author was clicking only because the component was holding the very object they had just picked.
   The field picker beside it was right by accident of having been written with a memoized array and
   a `find` into it — which is now the documented shape, in a comment that says why. Swept the other
   ten Comboboxes in the app: all already correct.
2. **"0 · Not scored" on sixteen of eighteen rows.** Two customers had points and the eye could not
   find them under a wall of grey badges — the precise opposite of what a score column is for. Zero
   now renders as a dash; a badge means "this one has points".
3. **And "Not scored" was a false statement.** Once a model exists, a zero means the rules ran and
   nothing matched. Telling an owner the machinery never looked at that person is a different fact
   and an untrue one. `scoreBand` now returns **Cold**; whether anything has been scored at all is
   `scoredAt`'s job, and only the panel reads it.
4. **The staleness banner lied about the one action sitting directly above it.** Adjusting Dana by
   hand to 60 produced _"the rules have changed since this was last worked out"_ — they had not;
   somebody had moved the number. A hand adjustment leaves the rules untouched, so the two figures
   differ **by design and permanently**. The newest `score_events` row tells the two cases apart
   (`manual` vs `rule`), so the panel now says "Someone moved this by hand" as info rather than a
   warning, because nothing is wrong and there is nothing to fix.

**One honest limitation, stated rather than papered over.** `scoreRecord` writes whatever the rules
compute, so **a re-score silently discards a hand adjustment.** An owner who bumps somebody to 60 and
presses "Re-score everyone" next week watches their judgement vanish without a word. Making it stick
means a real design change — a separate manual-offset column that survives recomputation, added to
the sum rather than overwritten by it — which is schema work, not a gap to close in passing. Until
that is decided, both the adjust form and the banner say plainly that the change lasts until the next
re-score and that anything you want counted permanently belongs in a rule.

**And a fifth, from the user's own question — "should we store score history?"** It was already
stored, and the panel above renders it. But the engine records `actorId` on a hand adjustment and
nothing displayed it, so the history read "Changed by hand" and left the reader to guess by whom —
while the adjust form directly above promised "this shows in the history below with your name on
it". That is the one row on the panel the rules cannot account for; the whole reason it is written
down is that a person stands behind it, and an anonymous override invites exactly the suspicion the
history exists to prevent. Resolved through the team roster (falling back to no name rather than a
raw uuid, which happens legitimately when whoever made the change has left).

#### Calls: logged, and then unreadable in three different ways

Following the same "what does the data layer expose that no screen consumes" thread into the support
side turned up `useCallsFor` with **zero** consumers, and pulling on it found three separate faults.

1. **The engagement composer asks how long you talked and how it went, and showed neither back.**
   Every logged call became one line of text in the timeline. Duration and outcome were write-only,
   and a call the platform recorded was **stored and unlistenable** — `recordingUrl` was rendered by
   no screen in the app. There is now a Calls table under the composer on the customer's Notes tab:
   when, which way, how it went, how long, and a link to the recording.
2. **THE INVALIDATION HAD NEVER MATCHED, so logging anything left the screen unchanged.** The
   composer invalidated the literal `['crm', 'activities']`; the timeline is keyed on
   `['crm', 'customer-activity', …]`. No overlap, so the refresh has always been a no-op — you got a
   cheerful "Call logged" toast over a list still reading "No notes yet", and the honest reading of
   that screen is that nothing was saved. So you log it again. `scoring-data.ts` opens with a
   warning about this exact trap ("an invalidate that misses leaves a stale picker or a stale number
   on screen next to a fresh one") and it was live here the whole time. Every key in that function
   is now IMPORTED from the module that owns it — a hand-typed key is a copy of a fact that lives
   somewhere else, and it goes stale with no type error, no failing test, and nothing on screen but
   an absence.
3. **"A call" has two writers and only one of them makes a `CallRecord`.** Click-to-call
   (`callService.placeCall`) writes a `CallRecord` plus a message; logging a call you made on your
   own phone (`engagementService.logCall`) writes only the message. So `/v1/crm/calls` holds exactly
   the calls the platform dialled and none of the ones anybody logged — which, for a tenant with no
   phone system connected, is all of them. Built against `CallRecord` the new card would have sat
   permanently empty while its owner logged calls into it all day. It reads engagement messages of
   `kind: 'call'` instead, which both writers produce; `CallRecord` is joined on the shared
   timestamp for the one thing only a dialled call has, the recording.

#### Tabs that ran off the edge of the pane

Raised from the screen rather than the code: the customer profile's ten tabs overflowed their
container, so Documents and Details sat past the right edge with nothing to say they were there.
`overflow-x-auto` was doing its job — the content was reachable — but the only hint it existed was a
scrollbar the platform may not draw at all. On a pane that can be dragged narrow, two tabs simply did
not exist from the operator's side.

`components/scroll-strip.tsx` is the general fix: a horizontal strip that shows a chevron at each end
when, and only when, there is more of it off-screen. Two decisions worth keeping:

- **The buttons are in flow, not floating over the content.** An overlaid chevron covers whatever is
  at the edge — usually the tab you were reaching for. These take their own space and push the strip
  in (DESIGN.md prefers an in-flow push to an overlay).
- **Overflow decides whether the PAIR is mounted; position decides only whether each is disabled.**
  Mounting a button narrows the scroller, which can create the very overflow that justifies the
  button — remove it and the overflow goes, so it comes back, forever. Tying the mount to overflow
  alone and disabling rather than unmounting at the ends makes that impossible, because removing the
  pair strictly widens the scroller.

Five more strips carried the same latent defect and were migrated with it — product detail, product
reviews, product translations, the product configurator, and CMS translation detail. All five are
tab strips whose count grows with the tenant's own data (one tab per locale, per configurator step),
so they were overflow bugs waiting for a tenant big enough to trip them.

**Still to sweep:** the tasks queue and requests/SLA proper, reports/dashboards, custom record types
end to end, mailboxes/phone systems/booking links.

#### Proven in a browser, and the gap that proving it exposed

The merge fix was driven end to end on 2026-08-10 rather than trusted: an invoice was raised against
one of two duplicate Marcus Lien records at Meridian Architects, the pair was merged in the
Duplicates screen, and the invoice's Customer field afterwards reads `marcus@meridianarch.com` where
it had read `m.lien@`. The document followed the person.

Doing that surfaced the next thing. The invoice editor promises, under its customer picker, that
"the customer record this invoice belongs to — it shows up in their history". **It did not.** The
customer had tabs for orders, deals, tasks, subscriptions and uploaded files, and nowhere at all to
see an invoice — so an owner could not tell from a contact that the contact owed them $3,800. The
API had supported `customerId` on `/v1/invoicing/documents` the whole time; only the tab was missing,
which is what API-first is supposed to leave behind. `CustomerInvoicesTab` now sits next to Orders
(what they bought and what they were asked to pay are different questions, and a business can have
either without the other), wears the Invoicing hue, and leads its right column with **Owed**.

#### Case was the unwatched door into the same bug

Both unique indexes on `customers` compare raw text, and nothing lowercased an address on the way
in — so `Jane@example.com` and `jane@example.com` were two contacts to the database and one person
to everybody else. A trailing space did the same thing and is easier to do by accident, because it
is invisible.

Normalised in `CreateCustomerInput` / `UpdateCustomerInput` / `SubscribeCustomerInput` rather than in
`customerService`, so REST, MCP, GraphQL, the importer and the storefront signup all agree — a rule
enforced at one write path is a rule the next write path will not have. Checkout, marketplace order
ingest and the CSV importer were already normalising; the CRM's own front door was the gap.

**No backfill, deliberately.** Lowercasing existing rows could make two of them collide, which would
fail against the very indexes this is protecting. Duplicate detection already compares
case-insensitively, so legacy pairs surface in the Duplicates screen and get merged like any other
pair — which is also why `merge.test.ts` now seeds its case-variant row straight into the table:
that pair can no longer be created through the front door.

#### A merge left 33 of the 37 customer tables behind

Found by merging a real duplicate pair on the dev database and then asking what still pointed at the
retired record. `mergeService` relinked activities, deals, tasks and addresses. Everything else —
**orders, invoices, payment intents, saved cards, subscriptions, bookings, support requests,
consent records, store credit** — kept pointing at the contact that had just been retired, while the
survivor's `totalSpent` and `orderCount` were rolled up from that same duplicate in the same
transaction. The result read "3 orders, $2,400" above an empty order list, and nothing in the UI
could recover it.

Consent is the sharpest edge: a person's recorded "no" staying attached to a record in the bin while
the record they now are has nothing on file is how somebody gets emailed after asking not to be.

The fix is `MOVED_MODELS` plus three tables that cannot be moved with a plain update because a
unique key already says "one row per customer" — segment membership (composite PK), trade-account
contacts, and store credit, where the balances are ADDED and the ledger is re-parented before the
emptied row is dropped (`AccountCreditTransaction` cascades, so deleting first would destroy the
history of where the money came from).

**The list is checked against the schema, not against memory.**
`merge-covers-every-customer-table.test.ts` reads the DMMF and fails if any model carrying a
`customerId` is in neither `MOVED_MODELS` nor `MERGE_HANDLED_ELSEWHERE`. That is the actual fix —
the original was not written wrong, it was written once and then thirty-three tables were added by
people with no reason to know that function existed.

##### How a list joins saved views

`SavedViewsMenu` is a dropdown in the pane toolbar beside Refresh (NOT a bar of its own — that was
tried and rejected: it cost every visitor a row of chrome for an occasional action, and made views
read as a feature of one screen rather than something every list has). It is list-agnostic: a list
supplies its object key, `current` and `baseline` groups, and an `onApply`. The two adapters —
`viewFilters([...])` to write and `viewFilterValue` / `viewFilterHas` to read back — live in the
menu module, not in each list, so the operator names are typed as `ConditionOperator` in exactly one
place (see the trap below). `objectKey` is a free string server-side, so a tenant's own record type
gets the control with no code written for it.

Three things that are easy to get wrong, all of which were got wrong first:

- **`baseline` is not `{conditions: []}` for every list.** It is what the list shows with nothing
  chosen: Deals opens on open deals, its board opens on the default pipeline. Without an honest
  baseline the menu offers to save an untouched list, which is the offer that teaches people to
  stop reading it.
- **Save what the resolvers publish, not the control.** The Requests list has one "which requests"
  dropdown that is three separate facts, stored as `ticket.isResolved`, `ticket.isAssigned` and
  `ticket.minutesToResolve` — real fields a report could also be written against. Storing the name
  of the option somebody picked would make the view mean something only that screen understands.
- **Absence means no restriction.** A view with no condition on a field reads back as "everything"
  for that control, NOT as the list's opening default. A view says what it says.

**`jsonb` DOES NOT PRESERVE KEY ORDER** — Postgres re-orders by key length then bytes, so a
condition saved as `{field, operator, value}` returns as `{field, value, operator}`. Comparing
filter sets with plain `JSON.stringify` therefore reported "changed" about a view that had just
been saved from exactly those controls: the menu never once reached "Nothing new to save" and
quietly invited a duplicate of every view. `sameFilters` canonicalises (keys sorted, conditions
sorted) rather than serialising. Anything else in the platform that compares a stored JSON blob to
a freshly-built one has this bug waiting in it.

**A TRAP THAT COST AN HOUR AND WILL COST THE NEXT PERSON THE SAME.** `ConditionGroup` is a union of
`Condition | sub-group`, and a sub-group's fields are ALL defaulted. So a leaf that fails to parse
as a `Condition` — one wrong operator name, `equals` instead of `eq` — does not raise. It falls
through to the sub-group branch, Zod strips the unrecognised keys, and it is stored as
`{"logic":"AND","conditions":[]}`. The filter is gone and the write reports success. The operator
names are `eq`/`neq`/`gt`/`lt`/`gte`/`lte`/`contains`/`not_contains`/`in`/`not_in`/`is_set`/
`is_not_set` (`packages/automation-schemas/src/condition.ts`) — check against that list rather than
guessing, because nothing downstream will tell you. Same family as the `.default()`-survives-
`.partial()` footgun this doc already records.

#### Deviations recorded during the build

1. **The wire vocabulary did NOT move.** `crm.b2b_account.created`, the `b2bAccount.*` automation
   and segment field paths, the `{{b2bAccount.*}}` email tokens, the `b2b_account` search-projector
   key and the `b2b_accounts` import-job entity all keep their names. Every one of them is stored
   in tenant data — a saved segment, an automation condition, an edited email template, an indexed
   document — so renaming them is a data migration and a reindex to fix a word no business owner
   ever sees. The LABELS changed; the keys did not.
2. **`customers.company` became `companyName`, and it had to.** A contact now has a `company`
   RELATION, and Prisma cannot have both. The free-text field is a different fact anyway — it is
   the employer somebody typed, it exists on contacts that will never have a company record, and
   the two disagree routinely. The API field, the segment source (`customer.company`), the scoring
   path and the CSV header all still read `company`; only the column and the Prisma field moved.
3. **`/v1/crm/b2b-accounts` still works.** Every company route is mounted at both paths, with
   `/v1/crm/companies` canonical. A path lives in somebody's integration and their saved requests;
   renaming the table is our business and breaking their Monday morning is not.
4. **The B2B join tables keep their names.** `b2b_account_contacts` and
   `b2b_account_product_overrides` were not renamed. A `B2bAccountContact` is not "a person at this
   company" — it is a buyer AUTHORISED TO TRADE, with a purchase limit and an approver. That is the
   trading relationship, which is exactly the thing §11 separated the company FROM.
5. **The public e-sign routes resolve their tenant from the SITE, not the token.** The signing page
   lives on the tenant's own storefront, so `?tenant=<slug>` establishes whose data the token
   addresses and RLS stays the boundary. The alternative — a token that carries its own tenant —
   would have meant a cross-tenant read with FORCE RLS stepped around, which is a much worse thing
   to have in the codebase than a query parameter.
6. **No MCP tool signs a document.** Requesting a signature is a tool; producing one is not. An
   assistant that could sign on a customer's behalf would make every signature in the system worth
   less, which is the opposite of why e-sign was built.
7. **A renamed table does not rename the functions over it.** Recorded as a deviation because it
   is the one thing in this phase that no amount of typechecking would have caught, and the next
   rename will hit it again. Two `SECURITY DEFINER` functions had to be redefined in their own
   migration.
8. **Confidence is fixed per signal, not configurable.** A business chooses WHICH signals run and
   how sure a merge must be to happen unwatched; it cannot tell the platform that a surname match
   is 100% certain. The weakest signal sits at 60, below every threshold the settings screen
   offers, so name-and-employer can never auto-merge two colleagues no matter what is set.

### Where the score actually sits

The audit in §1 opened at **5/10 overall**. Phases 0–6 put it at roughly **9.5**. What changed is the
SHAPE of the gap, not just the number: the audit's finding was "foundation 7–9, daily-use surface
2–5, missing primitives 0–1", and the primitives are now built, which moved six categories that look
unrelated. What remains is ONE area that does not exist at all (companies) plus a short tail.

| Category               | Audit | Now      | Full plan | Blocked on                          |
| ---------------------- | ----- | -------- | --------- | ----------------------------------- |
| Data model & tenancy   | 8     | **10**   | 10        | — done                              |
| Sales engagement       | 2     | **9**    | 9         | — done                              |
| Tasks & activity log   | 6     | **9**    | 9         | — done                              |
| Deals & pipelines      | 5     | **10**   | 10        | — done (deal health scoring)        |
| API, MCP & events      | 7     | 9        | 10        | company + saved-view tools          |
| Contact management     | 6     | 9        | 10        | saved views (built, Customers only) |
| Quotes, invoicing & AR | 9     | 9        | 10        | e-sign (§12)                        |
| Lists & segmentation   | 7     | **10**   | 10        | — done (static lists + history)     |
| Extensibility          | 1     | 7        | 10        | custom-object surfaces (§3.6)       |
| Workflows / automation | 6     | **9**    | 9         | — done, unverified in a browser     |
| Companies              | 5     | **5**    | 9         | phase 7 untouched                   |
| Reporting & dashboards | 3     | **9**    | 9         | — done, unverified in a browser     |
| Service / tickets      | 0     | 9        | 9         | — done, verified in production      |
| **Weighted overall**   | **5** | **~9.5** | **10**    |                                     |

Verified absent as of this checkpoint (grepped, not assumed): **no saved views**, no `companies`
rename, no e-sign, no meeting links, no custom-object surfaces. **The one remaining phase is 7** —
the `b2b_accounts` → `companies` rename, the trade-terms panel gated on the `b2b` module, opt-in
domain association, e-sign on quotes, meeting links, saved views, and duplicate management at scale.
Nothing else in this plan is outstanding.

At this checkpoint, with all migrations applied and the client regenerated: `@sparx/crm` 41 files /
**400 tests**, `@sparx/automation` 5 files / **70 tests**, `automation-schemas` 13,
`automation-actions` 54, api-rest 81. Typecheck clean across crm, crm-schemas, automation,
automation-schemas, automation-actions, api-rest and workbench; eslint and prettier clean
repo-wide; all four structural checks passing; and the RLS audit clean across **351 tables (319
tenant-scoped)**.

**Dev servers are STOPPED** as of this checkpoint. The phase 5 and phase 6 migrations and
`prisma generate` were each run under a one-time authorization, which does NOT carry to the next
session. Ask before running any DB command again.

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
