# 356 — The pack bench promised a box to type a quantity in

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · packing O-000008, as Doty
**Surface:** workbench › Inventory › Packing, in both consoles (`surfaces/inventory/pack-bench.tsx`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19 (sparx)
**Blocked on:** —

## What happened

Three lines on the bench said what it does not do:

- An empty box: "Scan the first item, or type a quantity against a line below." The lines below
  have only "Add all"; a number box appears once a line is in the box.
- Four injectors nobody found: "Nobody could find it while picking."
- A sealed box: "Buy a label from the order when you are ready." The order has no label to buy.

## What should have happened

Each says what the bench and the order really offer.

## How to reproduce

1. Open the pack bench on an order and start a box.
2. Look for the box to type a quantity in, and after sealing, for the label on the order.

## Why it matters

A packer who looks for a box to type in, or a label button, finds none and stops.

## Where it lives

`pack-bench.tsx` in both consoles.

## The fix

`pack-bench-words.ts` in both consoles. The empty box: "Scan the first item, or press “Add
all” on a line below. Once it is in the box, you can change how many." `nobodyFound` says "it"
for one thing only and "any of these" for more. The sealed box: "Send it from the order: say who
took it when it goes." ([357] gives the order that control.)

Test, red first: `pack-bench-words.test.ts` in both consoles (5 each). Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19: packing O-000008, "Add all" and then changing the injectors to 2 in
the box worked as the new words say. Piggles not seen on screen; its test passes.

## Rating effect

—
