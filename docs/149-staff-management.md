# 149 — Staff management (the `staff` module)

Version: 0.1 (design)
Author: Brandon Korous
Last Updated: 2026-08-11

> Status: **design / not started.** Sequenced behind [148](148-finance-spend-and-profitability.md),
> which ships first and works without this. Staff then turns 148's hand-typed "Wages"
> line into derived labour cost and unlocks true job profitability.

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

1. `StaffMember` + `StaffMemberSite` + `StaffPayRate`, and the links to `Member` /
   `SchedulingResource`. Roster and person surfaces.
2. `StaffTimeEntry` + timesheets + approval.
3. The labour deriver into `FinanceExpense` (§4) — the payoff milestone.
4. Shifts, time off, and the `AvailabilityException` write-through.
5. Certifications + expiry reminders.
6. Commission.
