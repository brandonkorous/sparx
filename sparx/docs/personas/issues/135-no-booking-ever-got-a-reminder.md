# 135 — No booking ever got a reminder

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (checking the Book page's promises before rewriting it)
**Surface:** workbench › Scheduling › a service (both consoles); `createService` in `@wizeworks/scheduling`; the MCP and REST service create
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Gillett's Book page says customers get "a reminder before the day". Wade Okonkwo-Larsen booked a pre-purchase inspection; he got the confirmation email and no reminder was ever planned.

Reminders belong to a set of booking rules. When Scheduling is turned on, it makes one: "Standard", 24 hours' notice, reminders a day and two hours before. But a new service started with no rules, and the sparx service screen called that choice "No deposit or cancellation rules", without a word about reminders. All seven of Doty's services had none.

The Piggles console had already renamed the choice ("No rules, and no reminders") and warned on it. Sparx had not.

## What should have happened

A new service starts with the business's rules, and choosing none says it means no reminders.

## Why it matters

Reminders cut no-shows, and the site promises them. A shop that set nothing up wrong still sent none.

## The fix

- `scheduling/src/services.ts` `createService`: a service created without naming rules takes the business's oldest set (the seeded "Standard"); an explicit none stays none. The REST route and the MCP tool use it, so they follow.
- Workbench `service-detail.tsx` (sparx): the choice reads "No rules, and no reminders"; with rules picked, the summary "No deposit · 24h cancellation notice · Reminder 1 day and 2 hours before"; with none, the warning "Nobody booking this gets a reminder…". `reminderSummary` and `defaultPolicy` in `setup-data.ts`. Ported from Piggles.
- Both consoles: a new service waits for the rules and opens with the first set picked, so the form is not "changed" before anything is typed.

Tests, each proved red:

- `api-rest/test/integration/new-service-gets-reminders.test.ts` (database, 2): a service naming no rules gets "Standard" (not the second set); one asking for none keeps none. With the old `?? null`, 1 fails.
- `scheduling/src/service-quoted.test.ts`: its fake database now holds booking rules (18 files, 183 tests pass).

## Confirmed by

On screen, 2026-10-06, as Doty: Diesel oil change showed "No rules, and no reminders" and the warning; he picked Standard, the summary read "No deposit · 24h cancellation notice · Reminder 1 day and 2 hours before", saved. Same for the other six; the database shows all seven on Standard. New service: opens with Standard and the summary, Create service disabled until a name is typed, nothing "unsaved".

## Rating effect

—

## Left as it is

Bookings made before the change keep no reminders; rebooking or editing the booking lays them.
