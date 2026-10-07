# 118 — A new person or machine could never be booked, and nothing said so

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 8 (adding the chassis dyno)
**Surface:** workbench › Scheduling › People & equipment (a resource page and the list) and Availability (both consoles); `/v1/scheduling/resources`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty added the chassis dyno for the "Chassis dyno run" service. A new person or thing starts with no weekly hours, and with none it can never be booked: every service that needs it shows no open times. The dyno's page said "In use" and nothing else. Hours live on a separate Availability screen that the page did not mention or link to. The list also said "In use".

When he then copied Bay 1's hours to it, the confirm warned "Their current weekly hours will be replaced, and the old ones cannot be brought back", on a red button, for a machine that had no hours to lose.

Also on these screens: "Off" was painted `neutral`, never approved (RULE #4); and the search entry for adding one read "Add one", which says nothing out of context.

## What should have happened

A person or thing with no hours says so where the owner is looking, and offers the way to set them. A copy onto an empty week says so plainly.

## Why it matters

A service that silently offers no times looks broken to a customer and fine to the owner. Nobody finds out until someone asks why the dyno is never free.

## The fix

- `scheduling/src/resources.ts`: `resourcesWithWeeklyHours(tenantId, ids)`. The resources list and the single read return `hasWeeklyHours` (absent on a write's echo, never a guess).
- Consoles, both:
  - `setup-data.ts`: `hoursMissingNotice`; `resourceState` reads "No hours" (warning) for one in use with none, and "Off" has no tone. Saving or copying hours refreshes the resources.
  - `resource-detail.tsx`: the notice "No hours yet, so nobody can book Chassis dyno" with **Set its hours**, which opens Availability on that resource.
  - `availability-settings.tsx`: opens on the resource it was sent for.
  - `hours-copy.ts` / `availability-copy.tsx`: when none of the targets has hours, the confirm says "They have no weekly hours yet.", the button reads "Copy hours to …", and it is not red.
  - The search entry and the list's own button both read "Add a person or equipment" (the list kept "Add one" until `create-label-agrees.test.ts` caught the mismatch).

Tests, each proved red:

- `surfaces/scheduling/resource-hours-notice.test.ts`, both consoles: no notice, no "No hours" state and the old confirm reddens 3 of 4.
- `scheduling/src/resource-hours.test.ts`: the set of resources with hours (2 tests).

## Confirmed by

On screen, 2026-10-06, as Doty: "Chassis dyno" saved with no hours (before the fix, nothing showed). After the fix, a new "Turbo balancer" read "No hours" in the header with "No hours yet, so nobody can book Turbo balancer"; **Set its hours** opened Availability on the Turbo balancer, every day Closed. Copying Bay 1's hours to it asked "Turbo balancer will get the same weekly hours as Bay 1 (light duty). They have no weekly hours yet." with "Copy hours to Turbo balancer", and the toast said it now has Bay 1's hours. The dyno has Mon–Fri 7:30 AM–5:30 PM and Sat 8 AM–12 PM.

## Rating effect

—
