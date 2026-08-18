# 149 — Staff management (the `staff` module)

Version: 0.8 (clicked)
Author: Brandon Korous
Last Updated: 2026-08-16

> Status: **built and browser-verified end to end.** All six surfaces have been driven by
> hand — a person hired, a rate recorded, hours typed, approved, costed and deleted, a
> shift drafted and published, leave requested and approved. 95 tests pass: 57 pure units
> plus 38 DB-backed integration tests that walk approved time all the way into a
> `finance_expenses` row and out again as a payroll hours file.
>
> **Clicking it found seven defects that every static check had passed** — §11 lists them.
> Four were invisible to typecheck, lint and 84 green tests by construction: a silently
> skipped module tile, an unregistered color, a dropped field, and a site filter that
> turned 7h 30m into a confident 0h. This is [[feedback_test_as_a_business_owner]]
> earning its place again.
>
> Sequenced behind [148](148-finance-spend-and-profitability.md), which shipped first
> and works without this. Staff turns 148's hand-typed "Wages" line into derived labour
> cost and unlocks true job profitability.
>
> **0.8: both commission controls have been CLICKED**, end to end — a salesperson hired
> on 7.5%, an order credited to her through "Who sold it", $30.45 on her pay record. It
> cost a seventh defect (§11 #7): the screen told an owner their salesperson was "not on
> commission" when she was, because the rate started after the sale.
>
> **0.5 closed the certification sweep** and **0.6 the commission calculation** (§10) —
> both had shipped as tested service code with no caller, so an expiry date was recorded
> and never mentioned again, and no sale ever earned anyone anything. Commission needed
> two schema additions before any of it could work: a percentage on the pay rate, and
> somewhere to record who sold an order, which migration `20270324000000` added. (That
> sentence read "not yet applied" until 0.7; it is applied, and this line is left here
> as the correction rather than deleted.)

---

## 1. What this is (and is not)

**Is:** the people who work for the business, as first-class records — who they are,
what they cost, when they work, what they are qualified to do, and what they got done.

**Is not:** an HR compliance system. No payroll runs, no tax withholding, no W-2 or 1099
filing, no benefits administration, no ACA/EEO reporting, no background checks. Same
boundary and the same reasoning as [148 §1](148-finance-spend-and-profitability.md#1-what-this-is-and-is-not):
payroll means becoming a tax filer in fifty states, and the incumbents in that category
already have the trust that takes a decade to earn. sparx records **hours and rates**;
whoever runs payroll gets an export.

### Why this belongs next to Finance, not as a separate ambition

For most service businesses **wages are the largest single expense**, and job
profitability is arithmetically impossible without knowing who worked how long at what
rate. Staff is not adjacent to finance here — it is the _source of the biggest number
in the ledger_. Building them apart is how you ship a profit figure that is confidently
wrong by 40%.

### The other half: the person already exists, three times

There is already a staff spine in the schema. It is just fragmented across three tables
that do not know they describe the same human:

| Where                                                                                                                            | What it knows                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `Member` ([03-auth-org.prisma](../packages/db/prisma/schema/03-auth-org.prisma))                                                 | Who can log in, and their module + site access          |
| `SchedulingResource` with `kind: 'staff'`, `user_id` ([78-scheduling.prisma](../packages/db/prisma/schema/78-scheduling.prisma)) | Who is bookable, their hours, skills, time off          |
| CRM ownership                                                                                                                    | Deal owner, ticket assignee, task assignee — bare uuids |

So "Sarah" is a Member row, a SchedulingResource row, and a uuid in four CRM columns,
and **nothing in the platform says she is one person, let alone what she costs.**
`PartnerCommission` exists for partners; there is no equivalent for the people who
actually do the work.

The module is therefore less "add HR" and more **make the person the record those three
already point at.** That reframing matters, because it means the win is available
without migrating anything: a `StaffMember` linked to the existing rows, not replacing
them.

### Locked decisions

1. **No payroll, ever.** Hours × rate is a _cost figure for the owner's own reporting_
   and an export line. sparx never calculates withholding, never files, never moves
   money to an employee.
2. **`StaffMember` links, it does not absorb.** `Member` keeps owning login and access;
   `SchedulingResource` keeps owning bookability and availability. Staff adds the person
   and points at both. Absorbing either would mean touching auth and scheduling to ship
   an HR feature.
3. **A staff member does not require a login.** A shop-floor tech who never opens the
   workbench still has hours, a rate, and certifications. Gating the record on a
   `Member` row would exclude exactly the people whose labour cost matters most.
4. **Site-scoped like everything else.** Someone can work for both of an owner's
   businesses, so the link is a join, not a column — and their cost lands against the
   site whose job they worked.

---

## 2. Module wiring and price

Add `staff` to `ModuleSlug` / `ALL_MODULES`, and `staff: 2900` to
`MODULE_MONTHLY_CENTS`.

**$29/month, flat.** Deliberately **not** per-seat: every one of the twelve existing
modules is a flat monthly price, and inventing a headcount billing dimension for one
module complicates subscription reconciliation, the pricing page, and the
`activeTotalCents` math for no real gain. Revisit only if a tenant with 200 staff turns
up, and revisit it as a platform-wide tier decision rather than a one-module exception.

**No `REQUIRES`.** Staff is useful with nothing else on — a business that only wants a
shift schedule and certification expiry alerts is a valid tenant. It is **better** with
finance and scheduling, which is an upsell, not a dependency.

Should staff bundle free with finance, or vice versa? **No.** They are independently
valuable and independently priced, and the sequencing story ("finance now, staff makes
it sharper") is a much easier second sale than one large module that has to be right all
at once.

---

## 3. Data model (sketch)

Schema lands with the build; the intended shape:

| Model                 | What it holds                                                                           |
| --------------------- | --------------------------------------------------------------------------------------- |
| `StaffMember`         | The person. Name, contact, role, employment type, start/end date, status                |
| `StaffMemberSite`     | Join to `Property` — who works for which business                                       |
| `StaffPayRate`        | Effective-dated rate: hourly \| salary \| commission \| none. **History, not a column** |
| `StaffTimeEntry`      | Clock in/out or a logged duration, optionally against a job                             |
| `StaffShift`          | Scheduled (not worked) time. Distinct from a time entry, and from a booking             |
| `StaffTimeOffRequest` | Requested, approved, denied. Approval writes an `AvailabilityException`                 |
| `StaffCertification`  | Licence/cert with an **expiry date** and a reminder lead time                           |
| `StaffDocument`       | Signed handbook, contract, ID — `MediaAsset` rows, like finance receipts                |
| `StaffCommission`     | Earned on an order or a deal. Mirrors `PartnerCommission`'s shape, for staff            |

Links out, all optional and resolved only when those modules are on: `userId` →
`Member`, `resourceId` → `SchedulingResource`.

**`StaffPayRate` is effective-dated on purpose.** A rate stored as a column on the person
silently rewrites the cost of every job they ever worked the moment someone gets a
raise. Last quarter's profit must not change because of this quarter's pay review, so
the rate is a row with a validity window and the labour deriver reads the rate that was
in force on the day worked.

**A shift is not a booking and not a time entry.** A booking is a customer's
appointment; a shift is when someone is rostered; a time entry is what actually
happened. Collapsing any two of the three is how "scheduled hours" and "paid hours"
become the same wrong number.

---

## 4. How labour reaches Finance

The one integration that justifies the sequencing:

1. `StaffTimeEntry` rows accumulate — clocked, or entered against a job.
2. The finance-worker's labour deriver runs per pay period, per site, per staff member:
   `Σ hours × the rate in force on each day worked` (salaried staff amortise across the
   period).
3. It writes one `FinanceExpense` per (staff member, period, site) with `source='labor'`,
   `source_type='staff_period'`, `source_id='<staffId>:<periodKey>'`, into the seeded
   `wages` category.
4. That `(tenant, source_type, source_id)` unique makes the run **idempotent** — a
   corrected timesheet updates the expense rather than adding a second one.
5. Time entries tied to a job also write a `FinanceExpenseAllocation` to that order or
   booking, which is what makes job profitability include labour rather than parts alone.

Note the direction: finance never reads the staff tables at rollup time. Labour is one
of the two things genuinely _derived_ into the ledger (the other being the sparx bill),
because unlike COGS there is no existing valued record of it. That is consistent with
[148 §1](148-finance-spend-and-profitability.md#1-what-this-is-and-is-not) decision #3
rather than an exception to it.

---

## 5. Surfaces

All six are built — [sparx/apps/workbench/surfaces/staff/](../apps/workbench/surfaces/staff/),
registered in `catalog/staff.ts`, addressed under `/team/*`. Keys are `staff.people`,
`staff.person`, `staff.timesheets`, `staff.schedule`, `staff.timeoff`,
`staff.certifications`.

- **People** — the roster. Role, status, sites, at-a-glance certification warnings.
- **Person** (detail pane) — identity, pay history, documents, certifications, time,
  commission. Identity is an editable field and lifecycle sits in the pane header, per
  the detail-surface rule.
- **Timesheets** — the period grid. Review, correct, approve. Approval is what releases
  the labour deriver, so it needs to be a deliberate act.
- **Schedule** — shifts by day/week, per site.
- **Time off** — the request queue.
- **Certifications** — everything expiring, soonest first. This is the surface that
  earns the module for a regulated trade, and it wants real semantic color: expired is
  `danger`, expiring inside the lead time is `warning`.

## 6. Events

- `staff.member.created`
- `staff.time.approved` — the labour deriver's trigger
- `staff.certification.expiring` — drives the reminder email
- `staff.timeoff.requested` / `staff.timeoff.decided`

## 7. Not in v1, and why

- **Payroll, tax, benefits, compliance filing.** Locked decision #1. Permanent.
- **Recruiting / applicant tracking.** A different product with a different buyer.
  `83-careers.prisma` already exists for sparx's own hiring page and is not this.
- **Performance reviews.** Real, but it is an HR-department feature, and the audience
  here is an owner with nine staff who wants to know if Tuesday was profitable.
- **Biometric / hardware time clocks.** The scan infrastructure in inventory is the
  obvious future hook; a phone is enough to start.

## 8. Build plan

1. ~~**Schema + migration**~~ — **done.** Nine tables in
   [90-staff.prisma](../packages/db/prisma/schema/90-staff.prisma) +
   [20270320000000_staff_management](../packages/db/prisma/migrations/20270320000000_staff_management/migration.sql).
   Applied locally; RLS audit passes over all nine (ENABLE + FORCE + `tenant_isolation`);
   `migrate diff` reports zero staff drift. No backfill and no seeded content, so the
   FORCE-RLS backfill footgun never applies.

   Two schema notes worth carrying: the `(tenant_id, user_id)` and
   `(tenant_id, resource_id)` uniques are PLAIN, not `NULLS NOT DISTINCT` — most staff
   have neither link, and nulls-not-distinct would cap a tenant at one staff member
   without a login. And `staff_time_off_requests`' member index is `map`ped, because
   Prisma's generated name for that triple is exactly 63 characters.

2. ~~**Module wiring**~~ — **done.** `staff` is in `ModuleSlug` + `ALL_MODULES`, priced
   `staff: 2900`, and added to the **twelve** other lists that re-declare the module
   vocabulary — including `MODULE_SLUGS` in
   [module-toggle.ts](../services/api-rest/src/lib/module-toggle.ts), which is THE
   activation gate: a slug missing there fails as "Request validation failed" and the
   module can never be turned on. No `REQUIRES`, no `BUNDLED_FREE` in either direction
   (§2).

   The hue is a deep rust brown `#92400e`. It was purple-600 for about an hour and
   Brandon rejected it: chat, partner, automations and ai already occupy that arc, so a
   fifth is indistinguishable in the rail. Brown is the one family the palette had never
   used. Rail label is **"Your team"** — "HR" names a department the audience does not
   have — and the icon is `ContactRound`, deliberately not `Users`, which is Customers.

3. ~~**`@wizeworks/staff`**~~ — **done.** Roster, effective-dated rates, time entries + the
   clock, timesheets, shifts, time off, certifications, documents, commissions, and the
   labour deriver. 68 tests.

   **The layout is load-bearing, not tidiness.** `pay.ts` imports NOTHING; `costing.ts`
   imports only `pay.ts`; everything else touches Postgres. That split is what let the
   arithmetic be verified before the package was even linked into the workspace — and it
   immediately earned itself by catching a real bug: the salary allocator weighted only
   the entries that carried a job, so someone with 100 minutes on one job and 300 on
   untracked admin would have had **the entire month's salary charged to that one job**.
   The fix weights over all the site's minutes and lets the jobless share fall out
   unallocated. Regression test: "leaves the share of unlogged time unallocated rather
   than inflating the jobs".

   Three refusals are encoded and tested: an hour with no rate in force is reported as
   UNPRICED, never costed at zero; a salary costs the CALENDAR, not the timesheet (so
   `deriveLaborForRoster` unions timesheet people with salaried people who logged
   nothing — otherwise the biggest wages in the business go missing); and the deriver
   never invents a category, raising `WagesCategoryMissingError` when finance is absent.

   **The idempotency key gained a segment.** §4 above writes it as
   `<staffId>:<periodKey>`; the shipped key is `<staffId>:<periodKey>:<siteId|none>`,
   because the same paragraph specifies one expense per person per period PER SITE and
   without the site the second business overwrites the first on every run. There is an
   integration test for exactly that.

4. ~~**Shifts, time off, and the `AvailabilityException` write-through**~~ — **done**,
   service layer and surface. `schedule.ts` writes a `blackout` exception on approval and
   releases it on cancellation; a person with no scheduling resource is the ORDINARY case
   and the decision is still recorded, so the API reports `blocksBookings` rather than
   letting the surface imply the block always happens.

5. ~~**staff-worker**~~ — **done.** A package inside `wizeworks/services/event-worker`, subscribing
   to `staff.time.approved` only — approval is the trigger, not clock-out. Five `staff.*`
   events added to the catalog AND provisioned in `terraform/envs/prod/main.tf`
   (`check:events` green). Unpriced hours are logged at WARN, because the wages figure
   being incomplete is otherwise invisible outside the timesheet screen.

6. **Certifications + expiry reminders** — service layer, API and surface all done,
   including the pure `certificationState` (where a NULL expiry is its own state and never
   sorts as urgent) and the once-per-lead-window reminder filter. `state` and
   `daysUntilExpiry` are resolved SERVER-side and sent on the wire, because "expiring"
   depends on each certification's own lead time and a client re-deriving it would
   eventually disagree with the roster badge. **The nightly sweep is still not wired** —
   see "Still to build".

7. **Commission** — service layer and API done, upserted on
   `(tenant, member, sourceType, sourceId)` so a recalculation cannot pay twice, and read
   on the person pane behind the pay gate. **Nothing calculates one yet** — see "Still to
   build".

8. ~~**`/v1/staff/*`**~~ — **done.** Six route files under
   [routes/v1/staff/](../services/api-rest/src/routes/v1/staff/), one per surface plus
   `pay.ts`, mounted from one `app.register`. `staffErrorMapper` in `app.ts` sends
   `*_NOT_FOUND` → 404, the three "the world has to change first" errors
   (`STAFF_PAY_RATE_OVERLAP`, `STAFF_TIME_APPROVED_LOCKED`, `STAFF_WAGES_CATEGORY_MISSING`)
   → 409, and everything else → 422.

   **`pay.ts` is a separate file because the GATE is, and that is the one decision here
   worth keeping.** Every other module in the platform treats `viewer` as "may read
   everything in this module"; that default is wrong exactly once, and it is here. Pay
   rates, personnel documents, commissions and the costed timesheet require **`admin`**
   (`requirePayAccess` in [staff-context.ts](../services/api-rest/src/lib/staff-context.ts));
   hours, shifts, time off and certifications answer to the ordinary ladder. A dispatcher
   who needs the rota and a bookkeeper who needs the wage total are both `editor` in most
   tenants, and only one of them should be able to open a salary. Putting the split in one
   file rather than in each route's judgement is what stops somebody forgetting it.

   A person's rate history is **absent, not empty**, on a read without pay access — an
   empty array reads as "nobody has ever recorded what this person earns", which is a
   different and much more alarming claim than "you may not see this".

   `approveTimeEntries` was changed to return the moved entries with their `workedOn`
   rather than bare ids: the caller has to publish `staff.time.approved` naming a PERIOD,
   and bare ids sent it back to the database for rows the function already had.

9. ~~**The six surfaces**~~ — **done.** [surfaces/staff/](../apps/workbench/surfaces/staff/):
   People, Person, Timesheets, Schedule, Time off, Certifications, over a shared
   `data.ts`/`format.ts`. Registered in
   [catalog/staff.ts](../apps/workbench/lib/surfaces/catalog/staff.ts) and addressed under
   `/team/*` in `wizeworks/packages/links` (`check:routes`: 324 surfaces, all addressed).

   Two surfaces carry the module's convictions rather than just its data. **Timesheets**
   renders an uncostable person as `N hours unpriced` in solid `error` and labels the
   period total "so far", never `$0.00`. **Certifications** is the color argument:
   expired is solid `error`, inside the item's own lead window is `warning`, and a
   qualification that never expires is `info` labelled "No expiry" — a real answer that
   must never sort to the top of a list about what needs attention.

   The schedule's shift editor is one of the few sanctioned **dialogs** (four fields,
   seconds of work, no surface to return to, and the week behind it is the context you
   need while filling it in). `updateShift` gained a pair-validation guard —
   `InvalidShiftWindowError` — because a PATCH that moves only the end time can invert a
   window and nothing upstream can see both halves; the table's CHECK would otherwise
   answer with a constraint violation instead of a sentence.

10. ~~**Marketing**~~ — **done.** Catalog tile (label **"Team"**, $29), all four color
    maps, `ContactRound`, the megamenu column (Accounts & service, not Commerce — a
    landscaping firm with nine crew and no online sales is exactly the buyer), the pricing
    ledger row and feature card, both `ELSEWHERE_MONTHLY` maps at $60, the platform page,
    the `MarketingModule` union, `ModulePageSlug` + `MODULE_ORDER` in `lib/modules.ts`
    (which carries sitemap, both `llms*.txt` and the module page for free), the OG story
    card, and `module-staff` in `sparx/apps/web`'s `@plugin` block — **verified emitted**:
    `.bg-module-staff` is in the built CSS bundle, which is the silent-grey failure this
    step exists to avoid. Module count moved 13 → 14 and every derived figure with it
    (`$440/mo`, `$3,946` separate, `$42,100/yr` saved, "fourteen" in six copy locations).

11. ~~**`/staff` landing page**~~ — **done**, on the six-beat shape. The map is in the
    header of [staff-page.tsx](../apps/web/components/marketing/staff-page.tsx).

    The beat that makes the page work is **3**: it concedes the payroll run is CORRECT and
    then attacks the grain — payroll has never heard of a job. That concession is what
    buys beat 4 its credibility, and it is also simply true, which matters more. Beat 6
    hands payroll back. Wages render in the SAME blue the product uses, imported from
    `finance-money` rather than re-picked, because the page's claim is that hours become
    that line.

    One worked example reconciles across every section, including the part that is easy to
    fudge: the payroll run's **gross** $18,470 and the **cost** $22,533.40 are different
    numbers and the page says why out loud, since the 22% between them is the entire
    argument of beat 5b.

12. ~~**The payroll hours export**~~ — **done**, and it was not on the original plan.
    §1 promises "whoever runs payroll gets an export" and nothing implemented it, so the
    landing page would have been describing something that did not exist.
    [payroll-export.ts](../packages/staff/src/payroll-export.ts) +
    `GET /v1/staff/timesheets/export` + a button on the Timesheets surface.

    Two columns are load-bearing: the person's **payroll id**, without which somebody
    matches names in a spreadsheet every fortnight; and **unpriced hours**, which are ON
    the file because they were worked and must be paid, and flagged separately because
    sparx cannot say what they cost. Leaving them off would underpay a real person —
    a different class of bug from a wrong figure on a screen, and the reason six of the
    27 integration tests are about this file.

### ~~The nightly certification sweep~~ — done (2026-08-13)

`certificationsNeedingReminder` and `markReminded` shipped built and tested with **no
caller anywhere in the repo**, so the one thing the Certifications surface promises —
that you hear about a licence BEFORE it lapses — never happened.

`POST /internal/staff/certification-reminders`
([staff-cron.ts](../services/api-rest/src/routes/internal/staff-cron.ts)) now runs at
07:15 UTC from [staff-certification-reminders.yaml](../k8s/cronjobs/staff-certification-reminders.yaml).
Per tenant it reads what is due, publishes `staff.certification.expiring` per
certification, and stamps `lastRemindedAt` **after** the publishes and only for what was
published — so a broker failure retries tomorrow instead of marking a reminder as sent
that nobody got.

**It deliberately does NOT send email, which is a change from what this section used to
ask for.** The platform already has a shape for this: `emitOverdueTaskReminders` in
`@wizeworks/crm` publishes an event "so the email automation engine can fire a templated
reminder". The reason to follow it rather than hard-code a template is that _who_ should
hear about a forklift ticket differs per business — the person, their supervisor, a
compliance mailbox, or a task on a board rather than mail at all — and sparx should not
pick.

The honest cost of that choice is that an event with no automation behind it does
nothing, which is the exact bug shape this whole release is about. So the trigger is also
registered in the workbench's `TRIGGER_EVENTS` catalog, alongside the other four staff
events and `finance.expense.recorded`. That required adding `staff` and `finance` to the
**local** `ModuleSlug` union in `automations-catalog.ts` — a hand-kept list, separate
from `@wizeworks/modules`, that neither module had ever been added to. **An event a tenant
cannot pick from a list may as well not be published.**

**Invoked for the first time (2026-08-16).** A cron endpoint that has never been called
is the same category of thing as a handler nothing publishes to, so all four new
endpoints were fired against the local database through the real router — token refused
when absent, refused when wrong, accepted when right. The certification sweep found
**one** staff tenant (`staff` is not bundled, so the settings flag is the whole truth
here) and nothing due, which is the correct answer for a database with no certification
inside its lead window.

### ~~Commission calculation~~ — built (2026-08-13), pending one migration

The ledger, the API and the person pane had all shipped and **nothing calculated a
commission**. The reason was schema, twice over, which is why no amount of service code
would have closed it:

- **`staff_pay_rates` had no percentage.** `basis` already accepted `'commission'`, but
  `amount_cents` is per-hour under `hourly` and per-YEAR under `salary` — so `commission`
  was a basis the rate model could name and could not describe.
  `commission_percent Decimal(6,3)` is that number, CHECK-constrained to zero on every
  other basis and to ≤100 (a commission above the sale itself is a typo every time).
- **An order recorded no salesperson. None.** A `Deal` carries `assignedRepId`; an
  `Order` carries nothing, so an order could never earn anybody anything whatever the
  rate said. `staff_sale_attributions` is who sold it — staff-side rather than a column
  on `orders`, per locked decision #2, so turning the module off leaves commerce
  untouched. It doubles as an override for deals, because the rep who owns a deal is not
  always the person who should be paid for closing it.

**The rules it encodes.** Earned when **paid**, not placed — a commission on an unpaid
order is a promise, and paying out of a promise funds staff from cash the business has
not received. The basis is **subtotal less discount**: not tax (the state's money passing
through), not shipping (the carrier's), not surcharges (the processor's). A refund
reduces it **proportionally against the order total**, because a refund of the shipping
charge is still money returned — and it recomputes rather than reverses, so the upsert
moves the row instead of leaving a correcting row beside it. A recalculation never
touches `status`: it cannot resurrect a voided commission or push a paid one back to
pending.

**Wiring.** `staff-worker` gained `order.paid`, `order.refunded` and `crm.deal.won`.
That last one is new on the platform bus, and deliberately narrower than the existing
`crm.deal.stage_changed`: that event is a `CrmTopic`, and **the CRM bus never reaches an
in-process platform consumer** — a worker subscribing to it would receive nothing. The
api-rest move-stage route publishes `crm.deal.won` alongside it, reading the stage's
`stageType` rather than its name so a tenant renaming "Won" to "Signed" does not quietly
stop paying people.

`PUT /v1/staff/sales/:type/:id/attribution` credits a sale and recalculates immediately —
crediting a sale and then waiting for something else to notice is how an owner concludes
the feature does not work. Removing an attribution deliberately leaves the commission it
produced standing; void it explicitly instead, because silently erasing a paid row is how
it disappears from a payroll reconciliation.

**Applied and verified (0.7).** Migration `20270324000000_staff_commission_rate` is in,
the client is regenerated, and `prisma migrate diff` shows no column or index difference
on either object. **24 tests** cover it: 13 pure arithmetic plus 11 DB-backed, which pin
the rules above rather than restating them — 7.5% of a $400 order carrying $40 of tax and
shipping pays **$30.00** and not $33.00; unpaid earns nothing; a half refund halves it; a
full refund pays zero and still leaves ONE row; a redelivered `order.paid` does not pay
twice; a **voided** commission is not resurrected by a recalculation.

**Finishing the column was not finishing the feature.** Adding `commission_percent` left
four places that never carried it, and each would have failed silently:

- `PayRate` / `setRate` had no such field, so **there was no way to set a commission rate
  at all** — the migration alone would have shipped a column nothing could write.
- The API schema did not accept it. It now also REFUSES it on a non-commission basis with
  a message, rather than zeroing it quietly: silently dropping it is how somebody sets
  7.5% on an hourly rate, watches it save, and wonders for a month why nobody was paid.
- `StaffPayRateRow` did not emit it — the identical shape to the `note` defect in §11 on
  this very type. Added as **required**, which is the lesson that defect taught.
- The person pane had no input. It now shows a "Share of each sale" field only for a
  commission basis, and the current-rate line reads `· 7.5% of each sale`.

**Still out, deliberately:**

- **Split commissions.** The unique on `(tenant, source_type, source_id)` is one seller
  per sale on purpose: modelling a split as "several rows" with no share column would pay
  each named person the FULL commission. Doing it properly needs a share per row, a rule
  for shares that do not total 100%, and a UI that can express both.
  **Both controls have now been clicked (2026-08-16).** End to end in the workbench: a
  salesperson hired, put on "Commission only · 7.5% of each sale", credited with order
  SO-1007 through "Who sold it", and **$30.45 recorded on her pay record** — 7.5% of the
  $405.97 of goods, not of the $453.96 the customer paid, so the $14.50 delivery and $33.49
  tax stayed out of it exactly as §10 says they must. It cost one real defect, §11 #7, which
  every static check and 24 passing tests had let through.

---

## 11. What clicking it found

Seven defects, none of which typecheck, ESLint, Prettier or 84 passing tests could have
caught. They are recorded because five of them share one shape — **a thing that is
absent behaves exactly like a thing that is fine** — and that shape will recur.

1. **The module could not be turned on, because its tile did not exist.** `MODULE_META` in
   [surfaces/modules/data.ts](../apps/workbench/surfaces/modules/data.ts) is a hand-kept
   list, and a slug the server offers but this list has never heard of is **skipped
   silently** rather than shown raw. `finance` and `staff` were both in that state:
   shipped end to end, absent from the only screen that turns a module on, with no error
   anywhere. This is [[feedback_module_slug_stale_lists]] a third time.

2. **Both hues rendered grey.** `module-finance` and `module-staff` were defined in
   `@sparx/brand/theme.css` but never added to the `@plugin '@wizeworks/silicaui'` color
   list in `sparx/apps/workbench/app/globals.css`. An unregistered color emits **no class at
   all**, so `bg-module-staff` resolves to nothing and the element quietly falls back to
   the chassis — the exact monochrome failure RULE #4 exists to stop, arriving by
   omission rather than by choice. A token is necessary and not sufficient; the plugin
   list is the second half, in each app.

3. **A saved person stayed dirty forever.** Create calls
   `ctx.open(…, { target: 'replace' })`, which swaps the pane's params **in place**
   without remounting — so `loaded` stayed `true`, the load effect never re-ran, `baseline`
   stayed at `EMPTY`, and a record that was on disk kept an unsaved dot and fired the
   leave-guard on the way out. The fix rebases the baseline on success, on both paths.

4. **The rate note was write-only.** `note` was in the zod schema, written to the column,
   returned by `payRateView`, and rendered by a Note column — but `toPayRate` never copied
   it out of the row, and `StaffPayRateRow.note` was **optional**, so the type system was
   satisfied and every annotated rate read back as an em-dash. An optional field in a view
   type is how a dropped field hides.

5. **A rate entered as 1 Jan displayed as Dec 31.** `formatDate` in the workbench used
   `toLocaleDateString` with no timezone on a `@db.Date`, which Postgres returns at UTC
   midnight — so every calendar day slid backwards for anyone west of Greenwich. The
   service layer had this exactly right and says so in `dayKey`'s comment; the UI
   reintroduced the bug the comment warns about. Split into `formatDate` (UTC, for
   `@db.Date`) and `formatMoment` (local, for `@db.Timestamptz`).

6. **Site-scoped hours vanished.** `timesheetPeriod` and `buildPayrollExport` filtered
   entries on `propertyId = <site>`, which excludes an hour that names **no** site — what
   every hand-typed day and every siteless clock-in is. The member row still appeared
   (it matches on `siteLinks`), so a real 7h 30m rendered as a confident **0h** with
   nothing to suggest anything was missing. On the payroll file the same bug does not
   understate a screen — it fails to pay somebody. Unattributed hours now fall to the
   person's main business, resolved per member so a two-site person is never counted
   twice.

7. **"They are not on commission" — said about somebody on commission.** Hire a
   salesperson today, put them on 7.5%, credit them with an order paid a fortnight ago,
   and the screen answered: _"Credited to Marisol Okonkwo, but they are not on commission,
   so nothing was earned. Set a commission rate on their pay record to change that."_
   She was on commission, In force, 7.5%. The rate simply **started after the sale**, and
   the owner was being sent to do the exact thing they had just done — after which they
   would get the same message again and conclude the feature was broken.

   The calculator collapsed two causes into one `no-rate`: never on commission, and not on
   commission **yet**. They are indistinguishable from inside the lookup — no rate came
   back either way — and they are fixed in opposite places, which is what makes a single
   message worse than silence. `rate-not-in-force` is now its own outcome carrying both
   days, and it says: _"Their commission starts Aug 16, 2026 and this order was paid
   Aug 4, 2026, so it earned nothing."_

   **Writing that message found a second problem.** The obvious advice — "backdate the
   rate" — is refused: pay rates may not overlap, so `setRate` with an earlier start throws
   `OverlappingPayRateError`. The remedy that works is remove-and-re-add, so the message
   names that instead of sending somebody into a guard rail. A test asserts the throw as
   well as the fix, because the advice is now part of the contract.

**One gap, not a defect: nothing could record an hour by hand.** `useCreateTimeEntry`,
`useUpdateTimeEntry` and `useDeleteTimeEntry` were built and wired to the API, and no
surface called any of them — so the only way an hour existed was a clock-in, and a tech
who forgot to clock in on Tuesday had no Tuesday. The person pane's "last 30 days" section
now adds, corrects and deletes, with the controls withdrawn once an entry is approved
(approved hours are already a filed wage cost and the server refuses to change them).

### Not ours

`flushSync was called from inside a lifecycle method` fires on **every toast** in the
workbench. The stack lands in `ToastRoot.recalculateHeight` inside a layout effect in
`@base-ui-components/react@1.0.0-rc.0` — upstream, dev-only, and not reachable from a call
site. [lib/confirm.ts](../apps/workbench/lib/confirm.ts) already defers our half; this is
the other half and belongs in a Base UI upgrade, not a patch here.

`GET /v1/finance/expenses` answers **422** (a `FinanceError`), so Finance → Spending shows
its "could not load" state. Nothing in the staff module touches `wizeworks/packages/finance`; the
staff → `finance_expenses` chain itself is proven by the DB-backed
[labor.integration.test.ts](../packages/staff/test/integration/labor.integration.test.ts).
