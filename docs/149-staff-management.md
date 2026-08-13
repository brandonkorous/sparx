# 149 — Staff management (the `staff` module)

Version: 0.3 (built)
Author: Brandon Korous
Last Updated: 2026-08-13

> Status: **built end to end — schema, services, API, six surfaces, marketing.** Every
> step of §8 is done. 84 tests pass: 57 pure units plus 27 DB-backed integration tests
> that walk approved time all the way into a `finance_expenses` row and out again as a
> payroll hours file.
>
> **Unverified in a browser.** Dev has been down for the whole build, so every surface
> here is typecheck-, lint- and build-green but has never been clicked. The `/staff`
> marketing page IS browser-proven in the sense that matters — `next build` prerenders
> it and `.bg-module-staff` is emitted into the CSS bundle, which is the failure this
> module was most likely to ship silently.
>
> Sequenced behind [148](148-finance-spend-and-profitability.md), which shipped first
> and works without this. Staff turns 148's hand-typed "Wages" line into derived labour
> cost and unlocks true job profitability.

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

All six are built — [apps/workbench/surfaces/staff/](../apps/workbench/surfaces/staff/),
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
  earns the module for a regulated trade, and it wants real semantic colour: expired is
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

3. ~~**`@sparx/staff`**~~ — **done.** Roster, effective-dated rates, time entries + the
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

5. ~~**staff-worker**~~ — **done.** A package inside `services/event-worker`, subscribing
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
   `/team/*` in `packages/links` (`check:routes`: 324 surfaces, all addressed).

   Two surfaces carry the module's convictions rather than just its data. **Timesheets**
   renders an uncostable person as `N hours unpriced` in solid `error` and labels the
   period total "so far", never `$0.00`. **Certifications** is the colour argument:
   expired is solid `error`, inside the item's own lead window is `warning`, and a
   qualification that never expires is `info` labelled "No expiry" — a real answer that
   must never sort to the top of a list about what needs attention.

   The schedule's shift editor is one of the few sanctioned **dialogs** (four fields,
   seconds of work, no surface to return to, and the week behind it is the context you
   need while filling it in). `updateShift` gained a pair-validation guard —
   `InvalidShiftWindowError` — because a PATCH that moves only the end time can invert a
   window and nothing upstream can see both halves; the table's CHECK would otherwise
   answer with a constraint violation instead of a sentence.

10. ~~**Marketing**~~ — **done.** Catalog tile (label **"Team"**, $29), all four colour
    maps, `ContactRound`, the megamenu column (Accounts & service, not Commerce — a
    landscaping firm with nine crew and no online sales is exactly the buyer), the pricing
    ledger row and feature card, both `ELSEWHERE_MONTHLY` maps at $60, the platform page,
    the `MarketingModule` union, `ModulePageSlug` + `MODULE_ORDER` in `lib/modules.ts`
    (which carries sitemap, both `llms*.txt` and the module page for free), the OG story
    card, and `module-staff` in `apps/web`'s `@plugin` block — **verified emitted**:
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

### Still to build

- **Browser verification of all six surfaces.** Everything is typecheck/lint/build green
  and none of it has been clicked ([[feedback_test_as_a_business_owner]] — a green
  endpoint proves nothing about whether anyone can reach the screen).
- **The nightly certification sweep.** `certificationsNeedingReminder` and `markReminded`
  are built and tested; nothing calls them yet. It wants an api-rest tick publishing
  `staff.certification.expiring` per certification, and an email template behind it.
- **A commission surface.** The service layer and the API are done and the person pane
  READS commissions; nothing writes one from the UI, because nothing yet calculates them
  from an order or a deal. That calculation is the missing piece, not the screen.
