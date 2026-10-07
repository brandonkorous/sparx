# 119 — A booking place showed a blank time zone, and saving it could have changed every booking time

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 8 (putting the shop's address on the booking place)
**Surface:** workbench › Scheduling › Places (sparx console; Piggles already had the fix)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Gillett's only booking place was the one made at sign-up: "Main location", no address, no time zone of its own. A place with no zone follows the business (America/Denver), and the booking page did. But the place form showed the Time zone box empty, React logged "`value` prop on select should not be null", and the list's Time zone column was blank. Nothing said what blank meant, so an owner would pick a zone to "fix" it; the first option is UTC, which would have moved every time on his booking page by six or seven hours.

The Piggles console already showed "Same as your business (…)" for this case. Sparx was left behind.

## What should have happened

The form says the place follows the business and names the zone, and keeping it that way stays a choice.

## Why it matters

The time a customer books is the time the shop expects them. A blank that invites a wrong pick is how a whole calendar ends up off by hours.

## The fix

Sparx console, matching Piggles' words:

- `surfaces/scheduling/location-detail.tsx`: the first Time zone option is "Same as your business (America/Denver)" (or "(not set yet)"), stored as "no zone of its own"; the draft no longer hands React a null.
- `surfaces/scheduling/locations-list.tsx`: the column reads "America/Denver, from your business", or "Not set".
- `setup-data.ts`: `followBusinessLabel`; a place's `timezone` is typed as possibly empty.

Tests, proved red:

- `surfaces/scheduling/place-zone-label.test.ts`: dropping the words reddens 1 of 2. Piggles: the same test over its `followLabel`.

## Confirmed by

On screen, 2026-10-06, as Doty: the place showed "Same as your business (America/Denver)" and no page error. Renamed "Main Office & Shop (Heritage Crest)" with 14812 Heritagecrest Way, Bluffdale, UT 84065, United States; saved, and it still follows the business zone.

## Rating effect

—
