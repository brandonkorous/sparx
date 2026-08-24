# 120 — Her two stylists are staff in Bookings and nobody in My Team

**Status:** fixed — confirmed on Juniper Row; Halo & Hem's own screen owed by a P02 re-run
**Severity:** major
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Sell › Order › Who sold it
**Filed:** 2026-08-22
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Devi Raman (both directions, on a fresh roster)
**Blocked on:** —

## What happened

Every order written at the till carries a **Who sold it** panel:

> Credit this sale to someone on your team. If they are paid on commission,
> theirs is worked out from it straight away.
>
> [ Nobody yet ▾ ]
>
> **Nobody is on your team yet. Add people under Your team, and they will appear
> here.**

Nia has a team. Dara Bell and Nia Okafor were both set up in act 3, under
Bookings › People and equipment, both marked **Staff**, and both appear by name
whenever a booking is assigned. The booking form lists them. The calendar lists
them. This screen says they do not exist.

They are `scheduling_resources` with `kind = 'staff'`. The panel reads
`staff_members`, of which this tenant has **zero**. Both statements are true of
their own table and the screen is false about the business.

## What should have happened

A person she has already told the product about, and already calls staff, should
be creditable for a sale. At the very least the message must not tell her to add
people she has added.

## How to reproduce

1. Bookings › People and equipment — Dara Bell and Nia Okafor, both Staff.
2. Sell › any order › Who sold it. Every time: "Nobody is on your team yet."

## Why it matters

She cannot credit a sale, so commission cannot be worked out, so Money › By job
and anything downstream of attribution is empty for a business that plainly has
two people in it. And it is the shape that hides best: a missing registration
renders exactly like a correct one, so nothing looks broken — it just says the
opposite of what she can see on the next screen.

## Where it lives

- [surfaces/commerce/sold-by-section.tsx](../../../apps/workbench/surfaces/commerce/sold-by-section.tsx) — reads `useStaffMembers({ status: 'active' })`
- `scheduling_resources` (kind `staff`) vs `staff_members` — two tables, one fact

## The decision this needs

Three ways to go, and it is not mine to pick:

1. **One roster.** A person is a person; a scheduling resource of kind `staff`
   IS a staff member, and creating one creates the other. Cleanest, and the most
   invasive — the two models carry different fields (pay rates, certifications,
   shifts on one side; hours, color, bookability on the other).
2. **A bridge.** Keep both tables, and offer "these people are in Bookings — add
   them to your team?" wherever the gap shows. Cheap, honest, and leaves the
   duplication in place for somebody to trip on later.
3. **Say the true thing.** Change nothing but the sentence, so it stops claiming
   she has no team. This is the floor, not a fix — the capability is still
   unreachable.

Whichever is chosen, the sentence should not survive as written.

## Decision — 2026-08-24, Brandon

**One roster, and it lives under My Team.** Bookings does not keep a separate
list of people; the staff a business books work against are the same people its
team is made of.

## The fix — 2026-08-24

### The model already said they were one person

`StaffMember.resourceId` has pointed at the bookable resource since the staff module
was designed, and that module's own header says its whole point is to **be the person
the other modules already point at**. Nothing was missing from the data model. The
WRITE PATH was missing: no code ever created both.

So the pairing lives in `wizeworks/packages/scheduling/src/roster.ts`, and it runs
inside `createResource`'s own transaction — not in a route, because three separate
callers reach `createResource` (the API, the blueprint installer, the MCP tool) and a
route-level fix would have covered one of them.

| Direction                                  | What happens                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Somebody added under **Bookings**          | `addToRoster` creates the person, carries their color across, and mirrors the resource's sites |
| Somebody added under **My Team**           | The Appointments switch calls `setBookable`, which mints the bookable record and links it      |
| A bookable person **renamed** in Bookings  | `renameOnRoster` renames the person — but only while the two names still agree                 |
| A person **switched off** for appointments | The bookable record goes inactive. They stay on the team, and the link stays with them         |

### The rename guard is the subtle one

If somebody has edited the person under My Team — given them a surname, corrected a
spelling, recorded the name they actually go by — the two records have been pulled
apart deliberately, and a rename in Bookings must not quietly undo it. So the rename
only lands while the person's full name still equals the resource's previous name.
Same discipline as a backfill: change what nobody has touched, and nothing else.

### Site links were part of it, not an extra

The two tables read an empty list in OPPOSITE directions. A resource with no site
links works every site; a person with no site links matches no site-scoped roster at
all. Copying "nothing" across would have created people the roster still could not
see — which is [179](179-she-added-someone-to-her-team-and-the-team-was-still-empty.md),
found while confirming this one.

### The backfill

`20270409000000_a_bookable_person_is_a_person_on_the_team`, per-tenant with
`app.tenant_id` set on each pass (`sparx_owner` is not a superuser in production, so an
unscoped write under FORCE RLS touches zero rows there while passing locally).

**26 bookable people joined the roster, every one with a home site and exactly one
main.** Dara Bell and Nia Okafor are on Halo & Hem's team, which is what this issue
asked for.

### The sentence

The "Who sold it" panel's message stays, because a genuinely empty roster still needs
one — it just no longer fires at a business with two stylists in it.

### Where it lives

`packages/scheduling/src/{roster,roster.test,resources,errors,index}.ts` ·
`packages/db/prisma/migrations/20270409000000_…` ·
`services/api-rest/src/routes/v1/staff/{members,views}.ts` (a `bookable` field and a
`PUT …/bookable`; `bookable` is `null`, not `false`, when Bookings is off — a business
that has not bought appointments is not a business whose people are "not bookable") ·
`piggles/apps/workbench/surfaces/staff/*` · `surfaces/scheduling/resources-*.tsx` ·
`surfaces/commerce/sold-by-section.tsx`

### Confirmed on screen

Added **Priya Nandakumar** under My Team and pressed _Let customers book them_ — she
appears under Bookings › People and equipment as "A person · In use". Added **Tomas
Okonkwo** under Bookings — he appears on My Team. One roster, both doors.

Bookings › People and equipment now says so out loud: _"The people here are your team.
Add somebody in either place and they appear in both."_

### Not confirmed yet

Halo & Hem's own "Who sold it" panel — the screen this was reported from — is owed by a
P02 re-run. The backfill's effect on her two stylists is verified in the database; the
panel itself has not been looked at since.
