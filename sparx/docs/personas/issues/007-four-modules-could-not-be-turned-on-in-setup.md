# 007 — Four modules could not be turned on in setup

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › Your story and Switch on what you use
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — all 16 modules listed; Social, Campaigns and Your team switched on; plan $440
**Blocked on:** —

## What happened

Doty wants every module. The story had no phrase for **Social**, **Finance**,
**Your team** or **Campaigns**, so he switched to "Prefer step-by-step?". That
screen's heading says **"Every module is one toggle"**, and it listed 12. The
same four were missing. The plan also never listed Finance, though Finance is
switched on free for any Commerce or B2B tenant.

## What should have happened

Every module sparx sells (16, `ALL_MODULES`) can be chosen in setup, at the price
the bill uses.

## Why it matters

The heading is false, and a business that wants a schedule for its staff or a
social calendar has to discover later, somewhere else, that sparx has one. Two of
the four are free; a free module nobody is shown is a reason to buy that nobody
hears.

## Where it lives

- `lib/onboarding/modules.ts` `SWITCHBOARD_MODULES` (both consoles): 12 rows.
- `@wizeworks/story-schemas` `CLAUSE`: no phrase for the four modules.
- `story-state.ts` `MODULE_PRIMARY_CLAUSE` (both consoles): no switch ⇄ phrase
  link for them.
- `story-summary.tsx` `storyPlanItems`: only modules the story chose.

## The fix

- Four story phrases: "post to my social pages", "run promotions and see what
  works", "know whether I'm making money", "keep my team's schedules and hours".
  The staff phrase says only what the module does (people, schedule, timesheets,
  time off, licenses); it does not claim payroll.
- Four switch rows in both consoles, priced from the billing catalog: Social Free,
  Campaigns Free, Finance $29 (Included with Commerce or B2B), Your team $29. The
  sparx rows name no other company (Piggles fixed that in its own copy, persona
  issue 362; the older sparx rows still do, see the act 1 note in the run log).
  Piggles rows use its rail names: Social posts, Campaigns, Money, My Team.
- A $0 module reads **Free**, never "+ $0", on the switch, the plan and the menu.
- The plan lists modules that come free with one chosen (Finance), as
  "Included". Listed only: setup does not save a flag the owner never picked.

## Confirmed by

> Re-ran P01 act 1, step-by-step: 16 rows. Switched on Social (Free), Campaigns
> (Free) and Your team (+ $29). Plan: … Social Free, Campaigns Free, Your team
> $29/mo, Finance Included; Total $440/mo. Hand sum against
> `MODULE_MONTHLY_CENTS`: 10+49+49+49+29+99+49+29+29+19+29 = 440.

## Rating effect

Recorded with the first-run setup row.
