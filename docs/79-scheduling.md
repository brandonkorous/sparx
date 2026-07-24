# 79 — sparx Scheduling Module Spec

**Version:** 1.5
**Author:** Brandon Korous
**Last Updated:** 2026-07-24

---

> **Reconciled 2026-07-22 (docs-vs-built audit):** the separate
> `services/scheduling-worker` deployable this spec prescribes (§1 table, §6.1) was
> **NOT built as a standalone service.** Its jobs — due-reminder cron, waitlist
> auto-fill, recurrence/series materialization, and calendar-sync polling — run as
> **in-process, advisory-locked loops inside `api-rest`** (`src/lib/scheduling-*.ts`:
> `scheduling-notifications`, `scheduling-waitlist`, `scheduling-series`,
> `scheduling-calendar-sync`, `scheduling-classes`, …), the same pattern as the email
> dispatch/provisioning loops. The dashboard scheduling surface moved off the deleted
> `apps/dashboard` into `apps/workbench` (the `apps/dashboard/...` paths in §6.1/§13.3
> now live under `apps/workbench`). Still open: intake / consultation forms (models
> only — no API/UI), the Builder `Booking` catalog component + off-site embed, the
> walk-in queue board, the reservations floor-plan, and the remaining **reporting/waitlist
> MCP tools** (16 shipped, incl. the full service + resource + hours setup path — §17.2).

## 1. Overview

sparx Scheduling is a full **appointments, classes, reservations, and resource-rental**
engine built into the platform — one module that replaces Calendly, Acuity, Square
Appointments, Booksy/Fresha, Mindbody, and OpenTable/Resy/Tock for a sparx tenant,
without any of them. It is **industry-agnostic by construction**: a salon booking a
stylist, a restaurant seating a party, a fitness studio filling a class, a clinic
running recurring therapy sessions, and a diesel shop scheduling a fleet service all
drive the **same booking engine** — they differ only in which capabilities they switch
on and how they're presented.

It is a **first-class module**, not a B2B add-on. The existing B2B fleet-service tables
([packages/db/prisma/schema/64-b2b-scheduling.prisma](../packages/db/prisma/schema/64-b2b-scheduling.prisma))
are the narrow ancestor of this engine; this spec **generalizes them** and makes B2B/fleet
one _context_ among many (§13.5, §15.7).

|                       |                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Module**            | Scheduling · slug `scheduling` · +$29/mo (§18.1)                                                                                                                   |
| **Requires**          | Nothing. Deposits require a connected payment gateway, not the Commerce module (§9.1).                                                                             |
| **Bundled free with** | Nothing — **always standalone** (decided; §18.3).                                                                                                                  |
| **Surfaces**          | Public booking widget (Builder + embeddable), customer self-service portal, dashboard (calendar / queue / roster / reports), MCP tools                             |
| **New service**       | `services/scheduling-worker` — reminder cron, waitlist auto-fill, calendar-sync polling, recurrence materialization                                                |
| **Reuses**            | `@sparx/payments`, `@sparx/email` + email-worker, CRM, automation engine, Builder catalog, inventory (parts/availability), push-worker, customer-auth, marketplace |

---

## 2. Why Build It

**The all-in-one advantage.** Every scheduling SaaS is an island: the booking data lives
in Calendly, the customer lives in a CRM, the deposit lives in Stripe, the reminder lives
in a separate SMS tool, the no-show never updates the customer's lifetime value. sparx
already owns the customer (CRM), the money (`@sparx/payments`), the email pipeline, the
automation engine, the site (Builder), and — for service businesses — the parts
(Inventory) and the invoice (Invoicing). **Scheduling is the connective tissue that turns
all of those into one loop**: book → remind → take deposit → fulfill → invoice → record
to the customer's history → follow up for a re-book or review. No competitor can do this
because no competitor owns the whole stack.

**The B2B/fleet gap nobody fills.** Our research found that **no purpose-built booking
product nails B2B/field/fleet service** — it's served by heavyweight FSM suites
(ServiceTitan) or custom ERP. sparx already has B2B accounts, fleet vehicles, parts
inventory, work orders, and invoicing. Scheduling that links an appointment to an
_account + asset (vehicle) + parts + work order_ is a genuinely under-served wedge, and we
get it nearly for free.

**Structural immunity to the things people hate.** §3 catalogs why people churn off these
products. The two biggest — _feature-gating that yanks features into higher tiers_ and
_per-seat pricing that punishes team growth_ — are **already impossible on sparx** by
policy ([73-pricing-model.md](73-pricing-model.md)): no tiers, unlimited staff, flat module
price. We turn the #1 and #2 industry complaints into our headline.

---

## 3. Market Analysis — What Works, What People Hate

Distilled from a market pass across the volume leaders (Calendly, Cal.com, Acuity, Square
Appointments, Booksy, Fresha, Vagaro, GlossGenius, Mindbody, Glofox, TeamUp,
OpenTable, Resy, Tock, SevenRooms, SimplePractice, Jane, Zocdoc, Microsoft Bookings).

### 3.1 What works (ranked by cross-platform recurrence)

1. **Automated reminders + deposit / no-show protection.** The single highest-ROI feature.
   Deposits drop no-shows dramatically (Tock: ~0.9% no-show with prepay vs ~3% with card
   hold; Acuity: ~67% reduction with deposits). Reminders by **SMS + email**, not email
   alone.
2. **Self-booking 24/7 via an embeddable widget on the business's _own_ branded site** —
   not a redirect to the platform's domain.
3. **Bidirectional, real-time calendar sync.** Table stakes — and simultaneously the most
   complained-about failure (§3.2). Push-based wins; CalDAV polling lags 24h+.
4. **Pay at booking / bring-your-own processor.** Upfront payment converts commitment.
5. **Intake / consultation forms** that populate the client record (health, tattoo, legal).
6. **Round-robin / collective team availability** (Calendly's marquee team feature).
7. **Waitlist with auto-fill on cancellation** — fills revenue gaps instantly.
8. **Recurring appointments / series** (therapy, training, maintenance).
9. **Buffer times / gap controls** between bookings.
10. **Cross-visit guest intelligence** (SevenRooms): preferences, allergies, VIP, spend,
    history surfaced on arrival.
11. **Mobile, for both client and provider.** Operators run the business from a phone.
12. **Silent, correct time-zone handling** (Calendly's original breakout).
13. **Optional discovery marketplace** for new-client acquisition.

### 3.2 What people hate (ranked by frequency)

1. **Surprise pricing changes / pulling features into higher tiers.** The #1 churn driver.
   Fresha's 2025 move from free to paid triggered mass exodus; SimplePractice raises prices
   on existing customers; Microsoft killed its mobile app.
2. **Per-seat pricing that punishes team growth.** Calendly per-seat "adds up fast";
   Booksy charges +$20/extra staff.
3. **Calendar-sync unreliability → double-bookings.** CalDAV 24h+ lag, silent OAuth token
   expiry, conflict checks that only read the _primary_ calendar, not all of them.
   OpenTable had a system-wide double-booking incident in Dec 2025.
4. **Nonexistent / slow support** (Mindbody, SimplePractice, Glofox all cited repeatedly).
5. **Mandatory platform branding on lower tiers** ("Powered by…") — "looks unprofessional."
6. **Marketplace hostage dynamics** — platform owns the guest comms/brand; **per-cover fees**
   (OpenTable $0.25–$1.50/cover) drove restaurants to flat-rate Resy.
7. **Standard features locked behind premium** (GlossGenius gates waitlists, resource mgmt,
   synced staff calendars, gap controls behind Gold).
8. **Glitchy provider-side mobile apps.**
9. **No-show / refund disputes with no chargeback tooling.**
10. **Locked-in payment processors** at non-competitive rates.
11. **Hard to export data / cancel** (now under FTC "click-to-cancel" scrutiny).

---

## 4. Design Principles — Steal the Wins, Kill the Hates

Each principle below is a direct, enforceable response to §3.

| #       | Principle                                                                                                                                                                                                                                                                                                                                                                                  | Answers          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| **P1**  | **Everything is included. No feature is ever tier-gated.** Waitlists, resources, round-robin, recurring, buffers, sync, deposits, intake forms, reports — all in the flat module price.                                                                                                                                                                                                    | Hate #1, #7      |
| **P2**  | **Unlimited staff, resources, locations, and bookings.** Flat module price; no per-seat, no per-cover, no per-booking fee.                                                                                                                                                                                                                                                                 | Hate #2, #6      |
| **P3**  | **Double-booking is structurally impossible**, enforced at the database with a Postgres `EXCLUDE` constraint (§7.4), not just app logic. Calendar sync is **one-click** (verified platform OAuth app — feasible since Calendar needs no CASA) with BYO + iCal fallbacks, checks **all** connected calendars, and **alerts on token/feed failure** — near-real-time on two-way connections. | Hate #3, Win #3  |
| **P4**  | **The booking surface is the tenant's own brand on their own domain** — real Builder components, no "Powered by sparx." Embeddable on external sites under the tenant's brand.                                                                                                                                                                                                             | Hate #5, Win #2  |
| **P5**  | **Bring your own processor.** Deposits/fees run through `@sparx/payments` (Stripe Direct, sparx Pay, PayPal, Square) at the tenant's own rates. Never locked.                                                                                                                                                                                                                              | Hate #10, Win #4 |
| **P6**  | **No-show protection is first-class and dispute-ready** — Tock-style per-service choice of _prepay / card-hold / free_, plus automatic chargeback evidence (reminder logs, policy acceptance, timestamps).                                                                                                                                                                                 | Win #1, Hate #9  |
| **P7**  | **Reminders are multi-channel (SMS + email + push) and event-driven** through the existing Pub/Sub + email-worker pipeline; SMS is a new channel, metered as a physical cost.                                                                                                                                                                                                              | Win #1           |
| **P8**  | **The customer record is the center.** Every booking, no-show, preference, intake answer, and visit writes to the CRM customer / B2B account / asset — cross-visit intelligence by default.                                                                                                                                                                                                | Win #10          |
| **P9**  | **Discovery is opt-in and conversion-only** (Booksy-Boost model on sparx.market): a tenant pays a commission **only** on a _new_ client the marketplace sourced, never a fee on bookings they generated. The tenant always owns the client + the comms.                                                                                                                                    | Hate #6, Win #13 |
| **P10** | **Your data is yours.** Full export (JSON/CSV + iCal feed), self-serve module disable, no retention hostage.                                                                                                                                                                                                                                                                               | Hate #11         |
| **P11** | **Time is always correct.** UTC `timestamptz` storage + IANA tz on every resource/location; render in the viewer's zone; DST-safe.                                                                                                                                                                                                                                                         | Win #12          |
| **P12** | **Mobile-first on both sides** — responsive dashboard (per the platform top-2 responsive rule) + push notifications via the existing push-worker.                                                                                                                                                                                                                                          | Win #11          |

---

## 5. Scope — The Unified Booking Model

All booking shapes are **one engine** with a `bookingType` discriminator. The differences
are configuration, not separate systems.

| Booking type  | What's booked                                        | Capacity    | Customer side  | Example verticals                                          |
| ------------- | ---------------------------------------------------- | ----------- | -------------- | ---------------------------------------------------------- |
| `appointment` | One slot of one service with one (or more) resources | 1           | one customer   | salon, tattoo, mechanic, clinic, law, tutoring, consulting |
| `class`       | A scheduled session with a capped roster             | N           | many attendees | fitness, workshops, cohorts                                |
| `reservation` | A time-block on a finite resource by party size      | by resource | one party      | restaurants, venues, tours                                 |
| `rental`      | A time-block allocation of an asset                  | 1 per asset | one renter     | rooms, bays, courts, equipment, studios                    |

**Plus these first-class capabilities (all in scope — "the full surface"):**

- **Round-robin & collective availability** — assign fairly across a team, or require
  several people at once (a panel interview, a two-tech job).
- **Recurring / series bookings** — weekly therapy, standing training, auto-generated
  weekly class schedules (RRULE-based, §7.6).
- **Multi-service & packages** — chained back-to-back services (cut + color), or a bundle
  booked as one transaction.
- **Group bookings** — one customer reserves several spots in one appointment (a private tour).
- **Walk-in / queue management** — no-appointment queue with SMS "you're up" paging
  (barbershops, restaurants).
- **Memberships / credit packs / punch cards** — class credits, prepaid sessions (reuses
  commerce subscriptions + account credit; §9.4).
- **Waitlists** — both session-level ("notify me if this class frees up") and
  service-level ("any opening with this artist this week"), with auto-promote.
- **Mobile / on-site (field) service** — a technician creates a follow-up booking in the
  field; bookings can carry a service address (mobile mechanic, notary, home health).
- **Virtual / telehealth bookings** — `location.kind = virtual` auto-generates a meeting
  link (video-provider abstraction; §13.x).
- **Intake & consultation forms** — declarative, mapped into CRM (§11).
- **Blackouts, special hours, and peak/dynamic pricing** — holidays, events, surge windows.

---

## 6. Architecture & Reuse

Scheduling is **thin where the platform is already strong**. It owns the booking/availability
engine and the calendar-sync engine; it _reuses_ everything else.

```
                         ┌───────────────────────────────────────────┐
                         │            Scheduling module                │
                         │  (new: @sparx/scheduling, scheduling-schemas)│
                         │                                             │
   Public site  ───────► │  Availability engine   Calendar-sync engine │ ◄─── Google / Microsoft /
   (Builder widget)      │  Booking ledger        Policy + deposit eng. │      CalDAV / Apple (OAuth)
   Customer portal ────► │  Waitlist / recurrence Notification orchestr.│
   Dashboard ──────────► │                                             │
   MCP (ai module) ────► └───────────────┬─────────────────────────────┘
                                         │ publishes domain events
                                         ▼
   ┌──────────────┬──────────────┬───────────────┬───────────────┬───────────────┐
   │ @sparx/      │ @sparx/email │ CRM            │ automation    │ Inventory      │
   │ payments     │ + email-     │ (customers,    │ engine        │ (parts check / │
   │ (deposits,   │ worker       │ B2B accounts,  │ (follow-ups,  │  reserve)      │
   │ holds,       │ (confirm /   │ activity,      │ win-back,     │                │
   │ refunds)     │ remind /     │ assets)        │ review ask)   │ Invoicing      │
   │              │ follow-up)   │                │               │ (work order →  │
   │ push-worker  │              │ marketplace    │ customer-auth │  invoice)      │
   │ (mobile)     │ SMS provider │ (discovery)    │ (portal)      │                │
   └──────────────┴──────────────┴───────────────┴───────────────┴───────────────┘
```

### 6.1 New code

- **`packages/scheduling`** (`@sparx/scheduling`) — the engine: availability computation,
  slot generation, booking lifecycle, policy/deposit orchestration, recurrence, waitlist,
  calendar-sync logic, notification scheduling. Pure service layer over `@sparx/db`.
- **`packages/scheduling-schemas`** (`@sparx/scheduling-schemas`) — Zod schemas + shared
  types (booking, service, resource, availability, policy), consumed by API, dashboard,
  widget, and MCP. Mirrors the `crm-schemas` / `builder-schemas` pattern.
- **`services/scheduling-worker`** — the only new deployable. Consumes Pub/Sub + runs
  Cloud Scheduler ticks for: due reminders, waitlist auto-fill, recurrence materialization
  (roll the series window forward), calendar incremental sync + push-channel renewal,
  card-hold expiry handling, no-show sweep. Mirrors `services/email-worker` /
  `services/automation-worker`.
- **Builder catalog components** — `Booking` block family in
  [packages/builder-schemas/src/catalog/](../packages/builder-schemas/src/catalog/) (data-as-code,
  stamped — never a new renderer branch), per the catalog contract.
- **Dashboard area** — `apps/workbench/surfaces/scheduling/` (calendar, bookings,
  services, resources, availability, waitlist, queue, reports, settings).
- **MCP tools** — `packages/scheduling/src/mcp/` registered into `services/api-mcp`,
  scoped `read:scheduling` / `write:scheduling`, gated on the `ai` module.

### 6.2 What it explicitly reuses (do not rebuild)

| Need                                                             | Reused asset                                                                                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deposits, holds, no-show fees, refunds                           | `@sparx/payments` `PaymentService` — `createPaymentIntent({captureMethod:'manual'})`, `capturePayment(amount)`, `cancelPayment`, `refund` ([gateway.ts](../packages/payments/src/gateway.ts)) |
| Confirmations / reminders / follow-ups (email)                   | `email.send` → Pub/Sub → `email-worker` → `@sparx/email` React Email templates                                                                                                                |
| Customer identity, history, segments, B2B accounts, fleet assets | CRM ([20-crm-customers](../packages/db/prisma/schema/20-crm-customers.prisma), [21-crm-b2b](../packages/db/prisma/schema/21-crm-b2b.prisma))                                                  |
| "When booking.completed → ask for a review" style rules          | Automation engine ([81-automation-module.md](81-automation-module.md))                                                                                                                        |
| Public booking pages on the tenant's brand/domain                | Builder catalog + per-tenant theme compile                                                                                                                                                    |
| Customer self-service login                                      | customer-auth ([48-customer-auth](../packages/db/prisma/schema/48-customer-auth.prisma))                                                                                                      |
| Parts availability at booking, reserve-on-confirm                | Inventory ([66-inventory](../packages/db/prisma/schema/66-inventory.prisma))                                                                                                                  |
| Booking → work order → invoice                                   | Invoicing ([72-invoicing](../packages/db/prisma/schema/72-invoicing.prisma))                                                                                                                  |
| Mobile push to staff                                             | push-worker ([70-push-subscriptions](../packages/db/prisma/schema/70-push-subscriptions.prisma))                                                                                              |
| Memberships / prepaid packs                                      | commerce subscriptions ([41-commerce-subscriptions](../packages/db/prisma/schema/41-commerce-subscriptions.prisma)) + account credit                                                          |
| Optional new-client discovery                                    | marketplace ([68-marketplace](../packages/db/prisma/schema/68-marketplace.prisma)), sparx.market                                                                                              |

### 6.3 The one genuinely new external integration: SMS

Email is solved (Postal). SMS is not, and SMS reminders are the highest-ROI feature in the
market. Scheduling introduces a **`NotificationChannel` abstraction** with three channels:
`email` (existing pipeline), `push` (existing push-worker), and **`sms` (new)**. The SMS
channel is **provider-swappable by design**, mirroring the payment-gateway pattern exactly:
an `SmsProvider` interface + an `smsProviderRegistry`, the same shape as `PaymentGateway` +
`gatewayRegistry` ([gateway.ts](../packages/payments/src/gateway.ts)). **Twilio is the first
and only built-in provider**; adding another (Telnyx, MessageBird, …) is _implement the
interface + register it_ — zero call-site changes and no risk to existing flows. Credentials
live in Secret Manager via the same `credentialRef` pattern as payments. SMS send volume is a
**metered physical cost** billed like email volume, consistent with the pricing philosophy
([73-pricing-model.md](73-pricing-model.md) §1). The channel abstraction lives in a small new
`packages/notifications` (or folds into `@sparx/email` as a second channel — decided in build).

---

## 7. The Booking & Availability Engine

This is the heart of the module and where "mature" is earned.

### 7.1 The core abstraction: (resource × time) is the unit of "busy"

A **resource** is anything whose time is consumed by a booking: a staff member, a chair, a
room, a table, a bay, a piece of equipment, or a pooled-capacity unit. **Availability is
computed per resource; a booking allocates one or more resources for a time range.** This
single abstraction expresses every vertical:

- Salon appointment → allocates `[stylist]` (and optionally `[chair]`).
- Class → allocates `[instructor, room]`, capacity N on the session, attendees enroll.
- Restaurant reservation → allocates `[table]` whose `capacityMin/Max` matches party size.
- Equipment rental → allocates `[equipment unit]`.
- Two-tech fleet job → allocates `[tech A, tech B, bay 3]` (collective).

### 7.2 Slot computation

Given `(serviceId, dateRange, [resourceFilter], [partySize])`, the engine returns bookable
start times:

```
for each required resource ROLE on the service (e.g. "a stylist with skill=balayage", "a chair"):
    candidate_resources = resources matching role + skill tags + location + bookableOnline
    for each candidate:
        free = availability_windows(candidate, dateRange)          # recurring weekly hours
             − availability_exceptions(candidate, dateRange)        # time off / custom hours / blackout
             − existing booking allocations (booking_resources)     # already booked
             − external_busy_blocks(candidate)                      # synced from Google/Outlook/etc
        free = apply buffers (before/after), min lead time, max advance, daily caps
        slots[role][candidate] = discretize(free, service.duration, slot interval/granularity)
    role_slots = a start time qualifies only if ≥1 candidate is free for the FULL duration
slot is OFFERED iff every required role has a simultaneously-free candidate
assignment of the concrete resource happens at booking time per strategy (§7.5)
for classes: offered iff session has remaining capacity (or waitlist if enabled)
for reservations: offered iff a table with capacityMin ≤ partySize ≤ capacityMax is free
```

Granularity, slot interval, "show times in customer's zone," and "only show N days out"
are all per-service settings. The computation is timezone-correct end to end (§7.7).

### 7.3 Concurrency model

Optimistic at the app tier, **hard-guaranteed at the database tier**. The availability read
is best-effort; the _write_ is the source of truth and cannot produce a conflict even under
a race, because of §7.4.

### 7.4 Double-booking is impossible (DB-level)

`booking_resources` carries the allocated time range + an `exclusive` flag (denormalized
from the resource, kept in sync inside the booking transaction). A Postgres `EXCLUDE`
constraint backed by `btree_gist` makes overlapping exclusive allocations of the same
resource a **constraint violation**, not a logic bug:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking_resources
  ADD CONSTRAINT booking_resources_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (exclusive AND status NOT IN ('cancelled', 'no_show'));
```

- **Exclusive resources** (staff, tables, equipment, rooms — the default) physically cannot
  be double-booked. A racing second write fails and is retried/surfaced cleanly.
- **Non-exclusive / pooled resources** (e.g. overbookable capacity, intentional restaurant
  overbooking, shared "any seat" pools) set `exclusive = false` and are governed by a
  **capacity count** check instead of the hard constraint — so overbooking is a deliberate,
  configurable choice, never an accident.

This single constraint is our structural answer to the #3 industry complaint.

### 7.5 Assignment strategies

Per service: `any_available` (first free), `round_robin` (fair rotation by recent-load),
`collective` (require all listed resources at once), `customer_choice` (the customer picks
the specific stylist/artist/practitioner — with portfolio, §13.1). Skill-tag routing
filters candidates first (a "balayage" service only offers stylists tagged for it; a
"turbo rebuild" only offers techs with that skill).

**Implementation note (shipped).** `customer_choice` is wired end-to-end: the public
availability + booking endpoints accept a customer-chosen `resourceId`, the engine honors
an explicit `resourceIds` pick (`pickForRole` `explicitIds`), and a chosen resource is
**server-side validated** against the service's eligible set (`listBookableResourcesForService`
— online-bookable, active resources whose kind + skill-tags satisfy a requirement) so a
tampered id can't book an offline/foreign resource. A generic single-resource shop just uses
`any_available` (no picker); a beauty shop tags each staff resource and uses `customer_choice`
so the visitor books a specific person. Portfolio cards on the picker remain spec (§13.1).

### 7.6 Recurrence & series

`booking_series` holds an RRULE + the service/resource/customer; the scheduling-worker
**materializes** child bookings within a rolling horizon (e.g. next 90 days) and rolls the
window forward on a cron. Editing a series offers the standard _this / this-and-future /
all_ scopes. Used for recurring appointments (weekly therapy) and auto-generated recurring
class schedules.

### 7.7 Time zones

Everything stores `timestamptz` (UTC). Each resource and location carries an IANA tz.
Availability windows are authored in the resource/location's local zone and resolved
DST-correctly. The customer always sees and confirms times in **their** zone; staff see
**theirs**. No naive local times anywhere.

### 7.8 Guardrails

Min lead time, max advance window, per-resource daily/weekly booking caps, buffer
before/after, minimum gap, blackout dates, and "approval required" (request → confirm) vs
"instant book" are all per-service / per-resource settings — included, never gated.

---

## 8. Calendar Sync (one-click platform app + BYO/iCal complements)

The feature everyone wants and everyone botches. **Because Google Calendar uses _sensitive_
scopes (no CASA assessment) and Microsoft/Apple have no paid assessment either, the verified
WizeWorks platform OAuth app is reachable at ~$0 — so we build it as the primary, one-click
connect path (§8.5).** Around it sits a **layered** set of complements — BYO credentials and
iCal — for the cases the platform app can't cover cleanly (Apple has no OAuth; a Microsoft org
that won't grant admin consent; privacy-conscious tenants; the window while Google
verification is pending). `CalendarConnection.credentialSource` (`platform | tenant_byo`)
selects which path a connection uses; all credentials are **encrypted at rest**
(AES-256-GCM, key `SCHEDULING_CALENDAR_TOKEN_KEY`) — see §8.4.

> **The verified facts we're building against (2025–2026):**
>
> - **Google Calendar scopes are _sensitive_, not _restricted_** → the third-party **CASA**
>   assessment ($900–$7,500/yr) **does not apply**. Platform verification is _free_ but a
>   process (privacy policy, demo video, domain ownership, ~10 business days), gated to 100
>   users + an "unverified app" warning + 7-day refresh-token expiry until it clears.
>   [src: developers.google.com/identity sensitive-scope-verification]
> - Google's **"Internal" exemption does not apply to a multi-tenant SaaS** (the GCP project
>   must be owned by the Workspace org) — but it **does** apply when a _Workspace tenant_
>   owns their own app. That's the BYO Google path.
> - **Microsoft `Calendars.ReadWrite` (delegated) now requires per-org _admin consent_**
>   (managed-consent policy, Oct 2025). A platform app needs _every customer admin_ to
>   approve us; a **tenant registering their own Azure app consents for their own org in one
>   click** — so for Microsoft, **BYO is strictly better** than the platform app. No CASA
>   equivalent exists; Azure registration + publisher verification are free.
>   [src: learn.microsoft.com MC1163922]
> - **Apple/iCloud** offers true two-way CalDAV via a user-generated **app-specific
>   password** with **zero registration on our side** — the friction-free winner.
>   [src: support.apple.com]

### 8.1 Layer 1 — Outbound iCal (everyone, zero setup)

- **Per-booking `.ics`** + "Add to Google/Outlook/Apple" links in every confirmation /
  reminder (already in §10) — immediate, no connection required.
- **Subscribe-to-feed:** each resource gets a signed, private `.ics` subscription URL the
  staff member adds to their own calendar once; sparx bookings then appear automatically.
  _Limitation:_ providers cache subscribed feeds (**Google ~12h, Outlook ~24h** stale;
  ~6-month future horizon), so this is "my bookings show up," not live. One-way (sparx → their
  calendar). [src: Google/Microsoft support]

### 8.2 Layer 2 — Inbound busy without OAuth (low-fidelity)

- Import the staff member's **secret iCal URL** (Google/Outlook) as read-only
  `external_busy_blocks` so outside commitments block sparx slots — **clearly labeled stale**
  (up to 12–24h), never presented as authoritative.
- **Manual time-off / blocks in sparx** (availability exceptions, §14) as the dependable
  inbound guard when a tenant won't do OAuth.

### 8.3 Layer 3 — Real two-way via the tenant's OWN credentials (no platform verification)

- **Apple / iCloud — easiest.** User generates an **app-specific password**; sparx talks
  CalDAV to `caldav.icloud.com`. True two-way, **zero registration**. [src: Apple Support]
- **Google — best for Workspace orgs.** The tenant connects with **their own** Google Cloud
  OAuth client. A Workspace tenant configures it **Internal** → no verification, no user cap,
  Trusted-app status removes the 7-day token limit, and **watch-channel push** gives
  near-real-time sync. (Personal `@gmail.com` BYO works too but hits the unverified-app
  warning + must publish to avoid the 7-day token expiry — the "advanced" path.) Google
  CalDAV now requires OAuth (basic-auth removed 2025), so OAuth via their own project is the
  route. [src: Google Workspace Admin / Calendar API]
- **Microsoft — BYO beats platform.** The tenant registers their **own** free Azure app; as
  the org owner the admin-consent requirement is satisfied in one click. Graph **change
  notifications** give near-real-time two-way. (Microsoft has **no CalDAV** — Graph is the
  only API path.) [src: Microsoft Learn]

### 8.4 Identical across every layer

- **All** connected calendars are checked for conflicts, never just a primary.
- **Token/feed-health alerting:** a failing OAuth token, expired app-password, or dead feed
  raises `calendar.sync_failed`, shows a dashboard banner + email, and the resource falls back
  to sparx-only data — we never silently trust a stale calendar (the classic double-booking
  cause).
- **The double-booking guarantee (§7.4) is independent of all of this.** External calendars
  are an _additional_ busy-source; the DB-level exclusion constraint protects sparx bookings
  regardless of external-sync fidelity. Degraded sync never degrades the core safety promise.
- Tokens / app-passwords / feed URLs are **encrypted at rest** (AES-256-GCM, the platform's
  `SCHEDULING_CALENDAR_TOKEN_KEY`) in the connection row's `*_enc` columns — opaque ciphertext,
  never plaintext. This mirrors the Search Console OAuth-token box (77-search-console), **not**
  the `@sparx/payments` Secret-Manager pattern: GSM there holds secrets _provisioned out-of-band,
  read-only_, which can't work for calendar OAuth tokens that are minted **and refreshed at
  runtime**. Encrypt-at-rest is the platform pattern for runtime-minted credentials; a DB leak
  alone yields no usable grant, and rotating the key invalidates every stored credential. Push
  webhooks (Google watch / Graph notifications) post to a receiver in `api-rest`;
  Google's one-time **Search Console domain verification** of the webhook host is a
  platform-level setup step (not per-tenant). `syncToken` incremental catch-up on the worker
  is the backstop.

### 8.5 Platform OAuth app — the primary connect path (in scope)

The default "Connect Google / Connect Microsoft" buttons use the **verified WizeWorks platform
OAuth app** — one click, no per-tenant Cloud project. Reachable at ~$0 because Calendar needs
no CASA; the remaining cost is _process_, tracked as build tasks:

- **Google** — External OAuth consent screen with the Calendar sensitive scopes: privacy
  policy on our domain, app homepage, brand/domain verification, per-scope justification,
  demo video, and a one-time Search Console domain verification for the push-webhook host.
  ~10-business-day review; until approved, dev/staging runs in testing mode (100-user cap,
  7-day refresh-token expiry).
- **Microsoft** — multitenant Azure app + **publisher verification** (free; needs a free
  Cloud Partner account). **Per-org admin consent is required for `Calendars.ReadWrite`**
  (Oct-2025 policy), so the connect flow supports the admin-consent grant; until a customer's
  admin consents, that org falls back to BYO/iCal.
- **Apple** — no OAuth exists; Apple always uses the app-password CalDAV path (§8.3).

`credentialSource = platform` is the default; `tenant_byo` and `ical_feed` remain first-class
fallbacks (privacy-conscious tenants, Microsoft orgs that won't grant admin consent, the
Google-verification window). Same model, same engine — the source field just selects the
credentials.

---

## 9. Payments, Deposits & Policies

### 9.1 Deposits without forcing Commerce

`@sparx/payments` is a platform-level package, **not** gated behind the Commerce module — its
`tenant_payment_configs` + `PaymentService` are shared by checkout, invoicing, and B2B
alike. A salon/tattoo/clinic tenant activates **only** Scheduling, connects a gateway, and
takes deposits. Deposits gate on _"a gateway is connected,"_ not on a paid module.

### 9.2 The Tock-style policy model (per service)

Each service picks its no-show protection — mix and match across the catalog:

- `free` — book with no payment (low-stakes slots).
- `card_hold` — authorize (manual capture) a card at booking; capture **only** a no-show /
  late-cancel fee if the policy is triggered; auto-void the hold after the appointment.
- `deposit` — capture a partial amount now (fixed or %); apply it to the final bill.
- `prepay` — capture the full service price now.

Backed by `payment_intents` (add a `bookingId` column) with `captureMethod: 'manual'` for
holds and `capturePayment(amount)` for partial no-show fees.

### 9.3 Cancellation / no-show / dispute tooling

`booking_policies` define the cancellation window, late-cancel fee, and no-show fee
(distinct — fitness norms differ from salon norms). When a fee fires, the engine captures
the held amount and assembles **chargeback evidence automatically**: policy text the
customer accepted at booking (timestamp), the reminder log (what we sent and when), and the
booking timeline. This directly addresses the "no-show fee dispute" pain.

### 9.4 Memberships, credit packs, tips

- **Memberships** (monthly unlimited, 10-class packs) reuse commerce subscriptions + an
  account-credit/punch-card ledger; classes debit credits at enrollment.
- **Drop-in vs member pricing** is a price resolution at booking time.
- **Tips** are an optional line captured at completion through the same gateway.

### 9.5 Commission / booth-rent (service businesses)

Per-staff commission % or booth-rent split is tracked per completed booking for payout
reporting (salon/booth-renter model). Reporting only in v1; actual payout disbursement is a
later integration (Stripe Connect transfers) — _flagged, not silently dropped_.

---

## 10. Notifications & Reminders

Event-driven, multi-channel, deduped, and logged.

- **Channels:** email (existing pipeline), **SMS** (new, §6.3), push (existing worker).
- **Lifecycle messages:** booking confirmation, configurable reminders (e.g. 24h + 2h
  before), change/cancellation notices, post-visit follow-up (re-book / review ask via the
  automation engine), and waitlist offers with a hold window.
- **Mechanics:** scheduling-worker computes due reminders on a cron and publishes
  `email.send` / SMS / push; every send is recorded in `booking_notifications`
  (type, channel, scheduledFor, sentAt, status) for dedupe + dispute evidence.
- **Tenant authoring:** reminder cadence + templates are tenant-configurable; the platform
  ships sane opinionated defaults (Managed automations, clonable — §[81](81-automation-module.md)).

---

## 11. Intake & Consultation Forms

Declarative, no-code (consistent with the platform-wide "tenant trees never execute code"
stance). `intake_forms` hold a typed field schema (text, choice, file upload, consent
checkbox, signature); a form attaches to a service and is completed during booking or via a
pre-visit link. `intake_submissions` store answers against the booking/attendee and **map
into the CRM customer record** (custom fields + an activity entry). Health/tattoo/legal use
this for history, consent, and project briefs. File uploads (reference photos, documents)
use the existing media pipeline.

> **HIPAA honesty:** the scheduling engine supports the health _workflow_ (intake, recurring
> series, secure portal messaging, charting templates attached to bookings). Full HIPAA
> compliance (BAA, audit posture, encryption controls, telehealth video) is a **platform
> program**, scoped as a requirement here — **not** claimed as delivered by this module. We
> do not market HIPAA until the platform program lands.

---

## 12. Vertical Playbooks (same engine, configured)

How the unified model expresses each vertical's table stakes.

### 12.1 Salon / Tattoo / PMU / personal services

Deposits at booking (`card_hold`/`deposit`); **customer_choice** assignment with provider
**portfolios** (photo galleries); per-client service notes (hair formulas, ink prefs) on
the CRM record; multi-staff calendar; commission/booth-rent split (§9.5); product upsell at
checkout via Commerce; cancellation policy + dispute evidence; per-provider waitlist.

### 12.2 Restaurants / reservations

`reservation` type; **floor-plan / table management** (resources with party-size capacity);
seating duration / table-turn control; **walk-in queue** with SMS "table ready" paging;
prepay or card-hold per reservation (Tock model); blackout dates + special-event pricing;
guest CRM (allergens, VIP, frequency, spend); cover-count reporting for the kitchen; and
**no per-cover fee — ever** (P2).

### 12.3 Fitness / classes

`class` type; roster with capacity cap + **waitlist auto-promote**; membership / credit-pack
management (§9.4); **recurring** weekly schedule auto-generation; **check-in** (QR / front
desk) + attendance tracking; drop-in vs member pricing; instructor assignment; hybrid /
streaming via virtual location; **late-cancel vs no-show fee differentiation**.

### 12.4 Healthcare / mental / allied health

Intake → chart mapping; **recurring series** with per-session attendance/cancellation;
secure client portal + messaging; charting/SOAP templates attached to bookings;
multi-practitioner availability; client self-cancel/reschedule windows; insurance /
superbill generation via Invoicing; telehealth video link (virtual location). (HIPAA caveat
per §11.)

### 12.5 B2B / fleet / auto / trade — the wedge

Booking linked to a **B2B account + asset (vehicle) record**, not just a contact; **service
history per asset** ("when was this truck last in?"); multi-location routing (which shop has
availability for this account); technician **skill-based routing**; estimate / **work-order**
integration at booking (Invoicing); **fleet-account billing** (invoice the account, not the
driver); **parts availability check** against Inventory before confirming the slot (and
optional reserve-on-confirm); mobile field creation of follow-up bookings. This generalizes
the existing `service_appointments` model (§15.7) and is the under-served market nobody owns.

### 12.6 Professional services (law, consulting, tutoring, agencies)

`appointment` type; **round-robin / collective** team availability; intake/brief forms;
prepay/deposit for consultations; recurring sessions; virtual or on-site; embeddable widget
on an existing marketing site (Calendly replacement) under the firm's brand.

---

## 13. Surfaces

### 13.1 Public booking surface (the tenant's brand, the tenant's domain)

A **`Booking` Builder catalog component family** (data-as-code, stamped): service picker →
resource/staff picker (with **portfolio** cards) → calendar slot picker → details + intake
form → deposit/payment → confirmation. Fully themeable via the tenant's compiled tokens,
responsive by default, accessible. Also shipped as an **embeddable widget** (script/iframe)
for tenants whose marketing site lives off-platform — still on their brand, **no "Powered
by sparx."**

**Shipped:** the `apps/site` booking widget renders a **"choose your {providerLabel}"** step
for a `customer_choice` service — an "Any available" option plus one button per eligible
resource (label from the service's requirement role, e.g. "stylist"). Picking a person
re-fetches _that person's_ availability and books them; the choice is validated server-side.
Portfolio/bio cards on the picker are still to come.

### 13.2 Customer self-service portal (customer-auth)

My upcoming & past bookings; **reschedule / cancel** within policy; pay a balance or deposit;
join / leave waitlists; manage class credits / membership; download `.ics`; intake form
completion.

### 13.3 Dashboard (`apps/workbench/surfaces/scheduling/`)

- **Calendar** — day / week / month, multi-resource lanes (staff/room/table columns),
  drag-to-reschedule, drag-to-create, color by service/status. _(Shipped: the week grid
  fills the viewport, everyone's bookings tenant-wide, with **resource + service filters**
  that narrow to one person's/one service's schedule — filter preserved across week nav.
  Multi-resource swimlane columns remain to come.)_
- **Bookings** — list/detail with the full lifecycle (confirm, reschedule, check-in,
  complete, no-show, refund), customer panel, parts/work-order, payment status. _(Shipped:
  status chips + **resource + service filters** that compose.)_
- **Queue board** — walk-in/waitlist management with SMS paging (restaurant/barber).
- **Class roster** — enrollment, check-in, attendance, waitlist promote.
- **Services & resources** — setup, skills, portfolios, locations, pricing, policies.
- **Availability editor** — weekly hours, time off, blackouts, special hours.
- **Calendar connections** — connect/disconnect, health, conflict view.
- **Reports** — utilization, no-show rate, lead time, revenue, conversion, source mix.

All responsive (platform top-2 responsive rule); push notifications to staff for new/changed
bookings.

### 13.4 MCP (AI module) — §17.

---

## 14. Data Model

Prisma models (repo style: UUID PKs via `gen_random_uuid()`, `tenant_id` on every table,
`timestamptz`, `created_at`/`updated_at`, `deleted_at` on high-value rows, all FKs indexed).
**RLS is hand-edited** in the migration (ENABLE + FORCE + `tenant_isolation` using
`current_tenant_id()`), per [packages/db/CLAUDE.md](../packages/db/CLAUDE.md). The
`EXCLUDE` constraint (§7.4) is hand-edited SQL Prisma can't express.

> Names below are the proposed canonical set. `services`/`bookings` **generalize** the
> existing `service_types`/`service_appointments` (migration in §15.7).

```prisma
// ── Resources: anything whose time is consumed ──────────────────────────────
model SchedulingResource {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  kind         String   @db.VarChar(20)   // staff | asset | table | space | equipment
  userId       String?  @map("user_id") @db.Uuid   // staff → team member
  locationId   String?  @map("location_id") @db.Uuid
  name         String   @db.VarChar(255)
  description  String?  @db.Text
  imageUrl     String?  @map("image_url") @db.Text  // portfolio / photo
  color        String?  @db.VarChar(7)
  timezone     String   @default("UTC") @db.VarChar(64)
  exclusive    Boolean  @default(true)   // false = pooled/overbookable (§7.4)
  capacity     Int      @default(1)      // pooled units, or seats
  capacityMin  Int?     @map("capacity_min")  // party-size min (tables)
  capacityMax  Int?     @map("capacity_max")  // party-size max (tables)
  skillTags    String[] @map("skill_tags")    // skill-based routing
  bookableOnline Boolean @default(true) @map("bookable_online")
  isActive     Boolean  @default(true) @map("is_active")
  settings     Json     @default("{}")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt    DateTime? @map("deleted_at") @db.Timestamptz
  @@index([tenantId, kind, isActive])
  @@map("scheduling_resources")
}

// ── Services: what can be booked ────────────────────────────────────────────
model SchedulingService {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  bookingType     String   @default("appointment") @map("booking_type") @db.VarChar(20)
  name            String   @db.VarChar(255)
  description     String?  @db.Text
  durationMinutes Int      @default(60) @map("duration_minutes")
  bufferBeforeMin Int      @default(0) @map("buffer_before_min")
  bufferAfterMin  Int      @default(0) @map("buffer_after_min")
  priceCents      Int      @default(0) @map("price_cents")
  currency        String   @default("usd") @db.Char(3)
  capacity        Int      @default(1)   // >1 for classes
  assignmentStrategy String @default("any_available") @map("assignment_strategy") @db.VarChar(20)
  // resource roles required: [{ kind, skillTags[], count }]
  resourceRequirements Json @default("[]") @map("resource_requirements")
  policyId        String?  @map("policy_id") @db.Uuid
  intakeFormId    String?  @map("intake_form_id") @db.Uuid
  locationId      String?  @map("location_id") @db.Uuid
  minLeadMinutes  Int      @default(0) @map("min_lead_minutes")
  maxAdvanceDays  Int      @default(365) @map("max_advance_days")
  slotIntervalMin Int      @default(15) @map("slot_interval_min")
  color           String?  @db.VarChar(7)
  imageUrl        String?  @map("image_url") @db.Text
  bookableOnline  Boolean  @default(true) @map("bookable_online")
  requiresApproval Boolean @default(false) @map("requires_approval")
  isActive        Boolean  @default(true) @map("is_active")
  // B2B/fleet extension (generalized from service_types)
  requiresAsset   Boolean  @default(false) @map("requires_asset")
  settings        Json     @default("{}")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz
  @@index([tenantId, bookingType, isActive])
  @@map("scheduling_services")
}

// ── Bookings: the central record (appointment | class session | reservation | rental)
model Booking {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  serviceId     String   @map("service_id") @db.Uuid
  bookingType   String   @map("booking_type") @db.VarChar(20)   // denormalized
  seriesId      String?  @map("series_id") @db.Uuid
  locationId    String?  @map("location_id") @db.Uuid
  // requested | confirmed | in_progress | completed | cancelled | no_show | waitlisted
  status        String   @default("requested") @db.VarChar(20)
  startAt       DateTime @map("start_at") @db.Timestamptz
  endAt         DateTime @map("end_at") @db.Timestamptz
  timezone      String   @default("UTC") @db.VarChar(64)
  capacity      Int      @default(1)        // class session capacity
  partySize     Int?     @map("party_size") // reservations
  // who (appointment: one of these; class: see BookingAttendee)
  customerId    String?  @map("customer_id") @db.Uuid
  b2bAccountId  String?  @map("b2b_account_id") @db.Uuid
  assetRef      Json?    @map("asset_ref")  // vehicle snapshot {year,make,model,vin,...}
  partsLinked   Json     @default("[]") @map("parts_linked")  // [{productId?,sku?,qty}]
  workOrderId   String?  @map("work_order_id") @db.Uuid
  source        String   @default("dashboard") @db.VarChar(20) // site|portal|dashboard|mcp|phone|marketplace|api
  // payment / policy
  policyId         String? @map("policy_id") @db.Uuid
  depositStatus    String? @map("deposit_status") @db.VarChar(20) // none|held|captured|refunded|forfeited
  paymentIntentId  String? @map("payment_intent_id") @db.Uuid
  intakeSubmissionId String? @map("intake_submission_id") @db.Uuid
  notes         String?  @db.Text          // customer-visible
  staffNotes    String?  @map("staff_notes") @db.Text
  reminderState Json     @default("{}") @map("reminder_state")
  confirmedByUserId String? @map("confirmed_by_user_id") @db.Uuid
  confirmedAt   DateTime? @map("confirmed_at") @db.Timestamptz
  checkedInAt   DateTime? @map("checked_in_at") @db.Timestamptz
  completedAt   DateTime? @map("completed_at") @db.Timestamptz
  cancelledAt   DateTime? @map("cancelled_at") @db.Timestamptz
  cancellationReason String? @map("cancellation_reason") @db.Text
  noShowAt      DateTime? @map("no_show_at") @db.Timestamptz
  createdByUserId String? @map("created_by_user_id") @db.Uuid
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt     DateTime? @map("deleted_at") @db.Timestamptz
  @@index([tenantId, status])
  @@index([tenantId, startAt])
  @@index([tenantId, customerId])
  @@index([tenantId, b2bAccountId])
  @@index([tenantId, serviceId])
  @@map("bookings")
}

// ── The allocation join that powers availability + the no-overlap constraint ──
model BookingResource {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  bookingId  String   @map("booking_id") @db.Uuid
  resourceId String   @map("resource_id") @db.Uuid
  role       String   @db.VarChar(40)   // matches service resourceRequirements role
  startAt    DateTime @map("start_at") @db.Timestamptz   // denormalized (incl. buffers)
  endAt      DateTime @map("end_at") @db.Timestamptz
  exclusive  Boolean  @default(true)    // denormalized from resource (§7.4)
  status     String   @default("confirmed") @db.VarChar(20) // mirrors booking for the WHERE
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([tenantId, resourceId, startAt])
  @@index([bookingId])
  // EXCLUDE USING gist(...) added in hand-edited SQL (§7.4)
  @@map("booking_resources")
}

// ── Class roster / party / waitlist seat ────────────────────────────────────
model BookingAttendee {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  bookingId  String   @map("booking_id") @db.Uuid
  customerId String?  @map("customer_id") @db.Uuid
  guestName  String?  @map("guest_name") @db.VarChar(255)  // non-account guest
  partySize  Int      @default(1) @map("party_size")
  // booked | checked_in | attended | no_show | cancelled | waitlisted
  status     String   @default("booked") @db.VarChar(20)
  waitlistPosition Int? @map("waitlist_position")
  paymentIntentId  String? @map("payment_intent_id") @db.Uuid
  creditApplied    Int     @default(0) @map("credit_applied")
  intakeSubmissionId String? @map("intake_submission_id") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@index([tenantId, bookingId, status])
  @@index([tenantId, customerId])
  @@map("booking_attendees")
}

// ── Recurring availability (weekly pattern, in the resource's local zone) ────
model AvailabilityWindow {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  resourceId String   @map("resource_id") @db.Uuid
  dayOfWeek  Int      @map("day_of_week")  // 0=Sun..6=Sat
  startMinute Int     @map("start_minute") // minutes from local midnight
  endMinute   Int     @map("end_minute")
  validFrom  DateTime? @map("valid_from") @db.Date
  validTo    DateTime? @map("valid_to") @db.Date
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([tenantId, resourceId, dayOfWeek])
  @@map("scheduling_availability_windows")
}

// ── One-off overrides: time off, custom hours, blackout, special pricing ─────
model AvailabilityException {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  resourceId String?  @map("resource_id") @db.Uuid   // null = tenant/location-wide
  locationId String?  @map("location_id") @db.Uuid
  kind       String   @db.VarChar(20)   // closed | custom_hours | blackout | special_price
  startAt    DateTime @map("start_at") @db.Timestamptz
  endAt      DateTime @map("end_at") @db.Timestamptz
  reason     String?  @db.Text
  meta       Json     @default("{}")    // custom hours / price multiplier
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([tenantId, resourceId, startAt])
  @@map("scheduling_availability_exceptions")
}

model BookingSeries {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  serviceId   String   @map("service_id") @db.Uuid
  rrule       String   @db.Text         // RFC 5545 RRULE
  customerId  String?  @map("customer_id") @db.Uuid
  resourceIds String[] @map("resource_ids")
  materializedThrough DateTime? @map("materialized_through") @db.Timestamptz
  status      String   @default("active") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@index([tenantId, status])
  @@map("scheduling_booking_series")
}

model WaitlistEntry {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  serviceId   String   @map("service_id") @db.Uuid
  customerId  String   @map("customer_id") @db.Uuid
  resourcePref String? @map("resource_pref") @db.Uuid   // preferred staff
  desiredFrom DateTime @map("desired_from") @db.Timestamptz
  desiredTo   DateTime @map("desired_to") @db.Timestamptz
  status      String   @default("waiting") @db.VarChar(20) // waiting|offered|booked|expired|cancelled
  offeredAt   DateTime? @map("offered_at") @db.Timestamptz
  offerExpiresAt DateTime? @map("offer_expires_at") @db.Timestamptz
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([tenantId, serviceId, status])
  @@map("scheduling_waitlist_entries")
}

model BookingPolicy {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  name        String   @db.VarChar(255)
  depositType String   @default("none") @map("deposit_type") @db.VarChar(20) // none|card_hold|deposit|prepay
  depositAmountCents Int? @map("deposit_amount_cents")
  depositPercent     Int? @map("deposit_percent")
  cancellationWindowHours Int @default(24) @map("cancellation_window_hours")
  lateCancelFeeType  String? @map("late_cancel_fee_type") @db.VarChar(20)  // fixed|percent
  lateCancelFeeValue Int?    @map("late_cancel_fee_value")
  noShowFeeType      String? @map("no_show_fee_type") @db.VarChar(20)
  noShowFeeValue     Int?    @map("no_show_fee_value")
  policyText         String? @map("policy_text") @db.Text  // shown + accepted at booking
  reminderOffsetsMin Int[]   @map("reminder_offsets_min")  // e.g. [1440, 120]
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@index([tenantId])
  @@map("scheduling_booking_policies")
}

model IntakeForm {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  name      String   @db.VarChar(255)
  schema    Json     @default("{}")   // declarative fields (no code)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@index([tenantId, isActive])
  @@map("scheduling_intake_forms")
}

model IntakeSubmission {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  formId    String   @map("form_id") @db.Uuid
  bookingId String?  @map("booking_id") @db.Uuid
  customerId String? @map("customer_id") @db.Uuid
  answers   Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([tenantId, bookingId])
  @@map("scheduling_intake_submissions")
}

model CalendarConnection {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  resourceId  String   @map("resource_id") @db.Uuid
  provider    String   @db.VarChar(20)   // google | microsoft | apple_caldav | caldav
  connectionKind String @default("oauth") @map("connection_kind") @db.VarChar(20) // oauth | caldav | ical_feed
  // tenant_byo = tenant's own OAuth client / app-password; platform = future verified WizeWorks app (§8.5)
  credentialSource String @default("tenant_byo") @map("credential_source") @db.VarChar(20)
  direction   String   @default("two_way") @db.VarChar(10)   // in | out | two_way
  fidelity    String   @default("realtime") @db.VarChar(20)  // realtime | stale_feed
  oauthClientRef String? @map("oauth_client_ref") @db.VarChar(255) // BYO client_id/secret → Secret Manager
  credentialsRef String? @map("credentials_ref") @db.VarChar(255)  // token / app-password → Secret Manager
  icalUrlRef  String?  @map("ical_url_ref") @db.VarChar(255)        // secret feed URL → Secret Manager
  externalCalendarId String? @map("external_calendar_id") @db.VarChar(255)
  syncToken   String?  @map("sync_token") @db.Text
  channelId   String?  @map("channel_id") @db.VarChar(255)   // push channel (oauth only)
  channelExpiresAt DateTime? @map("channel_expires_at") @db.Timestamptz
  status      String   @default("active") @db.VarChar(20)    // active|expired|error
  lastSyncedAt DateTime? @map("last_synced_at") @db.Timestamptz
  lastError   String?  @map("last_error") @db.Text
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@index([tenantId, resourceId])
  @@map("scheduling_calendar_connections")
}

model ExternalBusyBlock {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  resourceId  String   @map("resource_id") @db.Uuid
  connectionId String  @map("connection_id") @db.Uuid
  externalEventId String @map("external_event_id") @db.VarChar(255)
  startAt     DateTime @map("start_at") @db.Timestamptz
  endAt       DateTime @map("end_at") @db.Timestamptz
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@unique([connectionId, externalEventId], map: "external_busy_idem")
  @@index([tenantId, resourceId, startAt])
  @@map("scheduling_external_busy_blocks")
}

model BookingNotification {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  bookingId   String   @map("booking_id") @db.Uuid
  type        String   @db.VarChar(20)   // confirmation|reminder|change|cancellation|followup|waitlist_offer
  channel     String   @db.VarChar(10)   // email|sms|push
  scheduledFor DateTime @map("scheduled_for") @db.Timestamptz
  sentAt      DateTime? @map("sent_at") @db.Timestamptz
  status      String   @default("pending") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([tenantId, status, scheduledFor])
  @@index([bookingId])
  @@map("scheduling_booking_notifications")
}

// ── Physical service locations (shop/clinic/restaurant). Evaluate reuse of an
//    existing locations table during build before committing this. ───────────
model BusinessLocation {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  name      String   @db.VarChar(255)
  address   Json     @default("{}")
  timezone  String   @default("UTC") @db.VarChar(64)
  lat       Float?
  lng       Float?
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@index([tenantId, isActive])
  @@map("scheduling_locations")
}
```

`payment_intents` gains a nullable `booking_id` column (alongside `order_id` / `billing_doc_id`)
to tie deposits/holds/fees to a booking.

---

## 15. Migration & Build Plan

The whole surface is in scope — **no phase is "deferred."** Phases sequence the work so we
**deploy early and small** (ship the first usable slice the moment it works), per the
platform's deploy-early principle. Each phase ends shippable.

> All schema changes go through the **migration pipeline**, not a laptop (Cloud SQL is
> private-IP). RLS + the `EXCLUDE` constraint are hand-edited SQL. See
> [packages/db/CLAUDE.md](../packages/db/CLAUDE.md) and the `db-migration` skill.

- **Phase 1 — Engine & data foundation.** `@sparx/scheduling-schemas`; the migration
  (new tables + RLS + `btree_gist` `EXCLUDE` constraint + `payment_intents.booking_id`);
  resources, services, availability windows/exceptions; the availability/slot engine; the
  booking lifecycle with the no-overlap guarantee. Module slug `scheduling` added to
  `packages/modules`, pricing line, nav gating.
- **Phase 2 — Dashboard core.** Calendar (multi-resource lanes, drag), booking CRUD +
  lifecycle, service/resource/availability setup. _First deployable, usable internally._
- **Phase 3 — Public booking + customer portal.** Builder `Booking` catalog components +
  embeddable widget; customer-auth self-service reschedule/cancel; intake forms.
- **Phase 4 — Payments & policies.** Deposits/holds/prepay via `@sparx/payments`,
  cancellation/no-show fees, dispute evidence, refunds, tips.
- **Phase 5 — Notifications.** Email confirmations/reminders/follow-ups via the existing
  pipeline; **SMS channel** (new provider); push; `scheduling-worker` reminder cron + log.
- **Phase 6 — Calendar sync (§8).** The **verified platform OAuth app** (Google + Microsoft
  one-click — Google verification submission, Microsoft publisher verification + admin-consent
  flow) as the primary path; plus the complements — outbound iCal feed + per-booking `.ics`,
  inbound secret-iCal busy import + manual blocks, and BYO two-way (Apple app-password CalDAV,
  Google Workspace internal OAuth, own Azure app) — with push channels + webhook receiver,
  write-back, and token/feed-health alerts.
- **Phase 7 — Classes, recurrence & waitlists.** Class sessions + rosters + check-in,
  credit packs/memberships, RRULE series materialization, session + service waitlists with
  auto-promote.
- **Phase 8 — Reservations & queue.** Table/party-size model, floor-plan view, walk-in
  queue with SMS paging, overbooking config.
- **Phase 9 — B2B/fleet generalization (§15.7) & Inventory/Invoicing wiring.** Account/asset
  linkage, service history per asset, parts check + reserve, work-order → invoice, skill
  routing, multi-location routing.
- **Phase 10 — MCP tools** (§17), gated on `ai`.
- **Phase 11 — Reports & analytics** (utilization, no-show, lead time, revenue, source).
- **Phase 12 — Marketplace discovery** (opt-in, conversion-commission; §18.2) + reviews
  after completion.

Cross-doc updates that land with the build (kept in sync, not after): module map + headline
in [89-feature-catalog.md](89-feature-catalog.md), the slug set in
[packages/modules/src/index.ts](../packages/modules/src/index.ts), the
[73-pricing-model.md](73-pricing-model.md) table + toggle UI, and a pointer from
[10-b2b-wholesale-prd.md](10-b2b-wholesale-prd.md) §10 to this module as the engine.

### 15.7 Migrating the existing B2B scheduling tables — DONE (2026-07-14)

`service_types` and `service_appointments` (formerly `64-b2b-scheduling.prisma`) were the
narrow ancestor of this module's `SchedulingService`/`Booking` engine. No tenant had
production rows on either table at cutover, so this was a clean drop, not a data
migration — retired outright rather than copied:

1. **Generalized, not duplicated.** `SchedulingService`/`Booking` supersede them entirely.
2. **B2B semantics preserved** as the fleet _context_ on the general engine:
   `Booking.b2bAccountId`, `assetRef`, `partsLinked`, `workOrderId` — B2B's PRD §10
   surface (the B2B↔Scheduling bridge) is powered by this engine, never a parallel one.
3. **Retired**: `packages/db/prisma/migrations/20261205000000_drop_b2b_legacy_scheduling`
   dropped both tables; the Prisma models, both `b2b/scheduling.ts` route files, the
   `/b2b/service-types`+`/b2b/appointments` dashboard pages, the read-only customer
   portal appointments page, and the `b2b.appointment.*` event types were all removed
   in the same pass.

One engine, never two (the lesson from the automation-module unification) — see
[[feedback_b2b_legacy_scheduling]] for the removal detail.

---

## 16. Events

New `domain.action` event types (registered in [packages/events/src/types.ts](../packages/events/src/types.ts)

- Terraform topics, per the event-bus convention):

```
booking.requested      booking.confirmed     booking.rescheduled
booking.cancelled      booking.completed     booking.no_show
booking.checked_in     booking.reminder_due  (internal, from cron)
waitlist.added         waitlist.offered      waitlist.promoted    waitlist.expired
enrollment.created     enrollment.cancelled
intake.submitted
calendar.connected     calendar.sync_failed  calendar.conflict_detected
```

Deposits/fees reuse the existing `payment.*` events. These feed the automation engine
(follow-ups, win-back, review asks), the email-worker (templated sends), CRM activity
projection, and analytics rollups.

---

## 17. API & MCP

### 17.1 REST (API-first, `/v1`, platform error envelope)

- `scheduling/services`, `scheduling/resources`, `scheduling/availability-windows`,
  `scheduling/exceptions`, `scheduling/policies`, `scheduling/intake-forms` — CRUD.
- `GET scheduling/availability?serviceId&from&to&resourceId&partySize` — computed slots.
- `scheduling/bookings` — CRUD + actions: `confirm`, `reschedule`, `cancel`, `check-in`,
  `complete`, `no-show`, `refund`.
- `scheduling/classes/:id/enrollments`, `scheduling/waitlist`, `scheduling/series`.
- `scheduling/calendar/connections` + OAuth start/callback + `webhooks/calendar/:provider`.
- **Public** (booking widget / portal, customer-auth or signed token): list services,
  get availability, create booking, pay deposit, reschedule/cancel via signed link.

### 17.2 MCP tools (scoped `read:scheduling` / `write:scheduling`, gated on `ai`)

Registered in [07-mcp-server-spec.md](07-mcp-server-spec.md) §3 style. Write tools confirm.

| Tool                         | Scope | Description                                                                     |
| ---------------------------- | ----- | ------------------------------------------------------------------------------- |
| `get_availability`           | read  | Open slots for a service / resource / date range                                |
| `get_bookings`               | read  | Bookings with filters (status, date, customer, resource)                        |
| `get_booking`                | read  | Full booking detail                                                             |
| `get_schedule`               | read  | A staff member / resource day or week view                                      |
| `get_no_shows`               | read  | No-show history + rate for a period                                             |
| `get_utilization`            | read  | Resource utilization / capacity report                                          |
| `get_waitlist`               | read  | Current waitlist for a service                                                  |
| `create_booking`             | write | Book a slot (customer + service + resource + deposit)                           |
| `reschedule_booking`         | write | Move a booking (re-checks availability)                                         |
| `cancel_booking`             | write | Cancel (applies policy)                                                         |
| `check_in`                   | write | Check a customer in / mark attended                                             |
| `promote_waitlist`           | write | Offer a freed slot to the next waitlisted customer                              |
| `create_service_appointment` | write | B2B/fleet: book linked to account + asset, with a parts check against Inventory |

**Shipped set (2026-07-24) — `packages/scheduling/src/mcp/`.** Names differ from the sketch
above; these are the source of truth.

| Tool                                                                                                              | Scope | Note                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------ |
| `list_scheduling_services` · `get_scheduling_availability` · `list_bookings` · `get_booking`                      | read  | The booking-lifecycle reads.                                 |
| `list_scheduling_resources` · `list_resource_hours`                                                               | read  | Why availability is empty is almost always one of these two. |
| `create_booking` · `reschedule_booking` · `cancel_booking`                                                        | write | The lifecycle.                                               |
| `create_scheduling_service` · `update_scheduling_service` · `delete_scheduling_service`                           | write | What is bookable.                                            |
| `create_scheduling_resource` · `update_scheduling_resource` · `delete_scheduling_resource` · `set_resource_hours` | write | Who/what does the work, and when.                            |

The last two rows are **setup**, and they exist because the lifecycle alone was a dead end: the
tools could take a booking but never define what was bookable, and a service with no resource —
or a resource with no weekly hours — offers zero slots (§7.2: a slot needs an active,
online-bookable resource free for the buffered span). An agent asked to "set up my schedule"
now has the whole path: service → resource → hours. `set_resource_hours` replaces the whole
week per call, matching the editor's save shape, so it is idempotent to re-run.

---

## 18. Pricing & Packaging

### 18.1 The module

**Scheduling · +$29/mo · requires nothing · always standalone (decided).** $29 places it
alongside Email and Dropship in the module ladder ($10 / $19 / $29 / $49 / $99) and is already
category-crushing: one flat fee for **unlimited staff, resources, locations, and bookings**
beats every per-seat / per-staff / per-cover competitor for any business with 2+ people.
Everything in §4–§13 is included — **no feature is ever tier-gated** (P1, P2). The only
metered cost is **SMS send volume** (a physical cost, billed like email volume —
[73-pricing-model.md](73-pricing-model.md) §1).

### 18.2 Discovery marketplace (opt-in, conversion-only)

A tenant may list bookable services on sparx.market. The model is **Booksy-Boost, not
OpenTable**: a commission is charged **only** on a _new_ customer the marketplace sourced
and converted — **never** a per-booking or per-cover fee on the tenant's own traffic, and
the tenant always owns the customer relationship and comms (P9). Default off.

### 18.3 Bundling — decided: always standalone

**Decided: Scheduling is never bundled; every tenant (including B2B) pays the module line.**
Unlike invoicing/inventory (which ride free with B2B/Commerce), scheduling is a deep
standalone product in its own right, so it stays out of the `BUNDLED_FREE` graph. **Copy
implication:** B2B/Fleet's current module headline advertises "scheduling"
([89-feature-catalog.md](89-feature-catalog.md) module map) — that wording must be updated so
it no longer implies scheduling is included in the $99 B2B price. B2B tenants who want
fleet-service booking activate the Scheduling module too. This copy fix lands with the
cross-doc updates in §15.

---

## 19. Security, Privacy, Compliance

- **RLS everywhere:** every table `tenant_id` + ENABLE + FORCE + `tenant_isolation`
  (`current_tenant_id()`), hand-edited per [packages/db/CLAUDE.md](../packages/db/CLAUDE.md).
  Public booking endpoints set tenant context from the host/property, never trust client input.
- **Calendar credentials** (OAuth tokens, CalDAV app-passwords, iCal feed URLs) are encrypted
  at rest with AES-256-GCM (`SCHEDULING_CALENDAR_TOKEN_KEY`) in the connection row's `*_enc`
  columns — opaque ciphertext, never plaintext (§8.4). This follows the Search Console
  OAuth-token box (77-search-console), the platform pattern for runtime-minted/refreshed
  credentials; `@sparx/payments`' read-only Secret-Manager refs suit out-of-band-provisioned
  gateway keys, not tokens the app itself mints and rotates. The inbound feed fetch is
  SSRF-guarded (https-only; private/loopback/link-local/cloud-metadata rejected, with
  redirect re-validation).
- **PCI:** card data never touches sparx; deposits/holds use gateway-hosted elements
  (Stripe.js) via `@sparx/payments`. We store only intent ids.
- **HIPAA:** scoped as a platform program (§11) — supported _workflow_, **not** a delivered
  compliance claim. No HIPAA marketing until the program ships.
- **GDPR/CCPA:** bookings/intake answers are personal data — covered by the platform's
  export + erasure flows; full booking export (JSON/CSV) + iCal (P10).
- **Abuse:** rate-limit public availability/booking endpoints; bot protection on the widget;
  signed reschedule/cancel links with expiry.

---

## 20. Analytics & Reporting

Utilization (booked vs available hours per resource), no-show & late-cancel rate,
lead time (book-to-appointment), revenue (deposits, services, tips, no-show fees),
conversion (widget views → bookings), source mix (site / portal / MCP / marketplace),
and per-staff performance (commission/booth-rent). Backed by the analytics-rollup pattern
([75-analytics-rollups](../packages/db/prisma/schema/75-analytics-rollups.prisma)) + the
event stream (§16).

---

## 21. Open Questions / Decisions

**Resolved by you:** price → **$29/mo** (§18.1); bundling → **always standalone** (§18.3);
calendar → **build the verified platform OAuth app** as the primary path (no CASA for
Calendar) with BYO + iCal as complements (§8); SMS → **Twilio first, provider-swappable**
(§6.3).

Still open (do not block Phase 1):

1. **`BusinessLocation` reuse** — adopt a shared platform locations table (and reconcile
   with Inventory locations), or keep a scheduling-owned `scheduling_locations`?
2. **Telehealth video** — which provider abstraction (Daily, Whereby, Zoom) for virtual
   bookings, and is it in the first build or a fast-follow within the module?

None of these block Phase 1; they're answerable as their phase approaches.
