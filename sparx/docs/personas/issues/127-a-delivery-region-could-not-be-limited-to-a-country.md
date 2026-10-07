# 127 — A delivery region could not be limited to a country

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (setting up US shipping so a stranger can have a part shipped)
**Surface:** workbench › Shipping › Add a delivery region (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

"Deliver anywhere in the world" starts on. Doty turned it off to deliver to the United States only, and it stayed on: no country picker appeared, whatever he clicked. The form read "anywhere" from "no countries chosen". Turning it off kept the list empty, so it flipped straight back on. Every new region in either console could only deliver worldwide.

Also on the form: "Create this region first (use Save above)" while the button above reads "Create region"; and the picker said "Choose none and this region reaches everywhere", which is the switch's job.

## What should have happened

Turning the switch off shows the country picker, and the region delivers only where chosen.

## Why it matters

A US parts shop that cannot say "US only" offers its heavy parts to every address on earth at a US price.

## The fix

Both consoles, `surfaces/commerce/shipping-zone-detail.tsx`: the draft carries its own `limited` choice; the switch sets it; the picker shows when it is off; a limited region with no country cannot be saved, and says "Choose at least one country, or turn on Deliver anywhere in the world." The words now read "use Create region above" and "Start typing to find a country." The rule lives in `shipping-data.ts` (`regionCoverageError`).

Test, proved red:

- `surfaces/commerce/region-coverage.test.ts`, both consoles: the rule (2 tests) and a source check that "anywhere" is its own choice. Reading it from the empty list again reddens 1 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: the switch turned off, "Countries you deliver to" appeared with the message above; he chose United States and created "United States", "Delivers to United States".

## Rating effect

—
