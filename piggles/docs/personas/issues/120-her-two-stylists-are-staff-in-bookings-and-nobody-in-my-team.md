# 120 — Her two stylists are staff in Bookings and nobody in My Team

**Status:** open
**Severity:** major
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Sell › Order › Who sold it
**Filed:** 2026-08-22
**Fixed:** —
**Confirmed by:** —
**Blocked on:** decision — the two rosters are a product question, not a repair.

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
   shifts on one side; hours, colour, bookability on the other).
2. **A bridge.** Keep both tables, and offer "these people are in Bookings — add
   them to your team?" wherever the gap shows. Cheap, honest, and leaves the
   duplication in place for somebody to trip on later.
3. **Say the true thing.** Change nothing but the sentence, so it stops claiming
   she has no team. This is the floor, not a fix — the capability is still
   unreachable.

Whichever is chosen, the sentence should not survive as written.
