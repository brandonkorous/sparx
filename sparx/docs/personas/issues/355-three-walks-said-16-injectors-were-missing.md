# 355 — Three walks said 16 injectors were missing out of 6

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · checking issue 184 (a part-sent core line), as Doty
**Surface:** workbench › Inventory › Packing, "Still to pack" (`wizeworks/packages/inventory/src/services/packing.ts`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19
**Blocked on:** —

## What happened

Wasatch's O-000008 has 6 injectors. It was walked three times: PICK-000002 and PICK-000003
found none, PICK-000004 found 2. The pack bench then said "Nobody could find 16 of these while
picking" under a line of 6.

## What should have happened

"Nobody could find 4 of these": what the newest walk could not find.

## How to reproduce

1. Short a line on a walk, then send the order to the warehouse again and short it again.
2. The pack bench adds every walk's shortfall together.

## Why it matters

A number larger than the order tells the packer the screen cannot be trusted about what is
missing, which is the one thing that line is there to say.

## Where it lives

`packing.ts` summed `short_quantity` over every walk of the line. Each new walk asks again
for the units the last one missed, so the walks overlap.

## The fix

The query returns each walk's shortfall newest first; `stillShort` (`still-short.ts`) takes the
newest.

Test, red first: `still-short.test.ts` (3). Inventory 541 pass, `tsc` clean. Lint and format
clean.

## Confirmed by

P01 as Doty, 2026-10-19: the bench read "Nobody could find 4 of these while picking."

## Rating effect

—
