# 340 — The ship form always started on USPS

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · checking issue 178 (a card-paid return)
**Surface:** Workbench › Commerce › an order › Mark it as sent, "Who took it" (both consoles)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Doty and Dana Whitcomb, 2026-10-18
**Blocked on:** —

## What happened

Marisol Vega chose "UPS Ground" at checkout (O-000034). Doty opened the order and pressed
"Mark it as sent". He did not touch "Who took it", which had started on USPS. Her order page
then read "On its way · USPS" beside "Shipping to · UPS Ground".

## What should have happened

The form starts on the carrier the customer chose. Doty changes it only when something else
took the parcel.

## How to reproduce

1. Order on the site with a UPS or FedEx delivery.
2. In the console, open the order. "Who took it" says USPS. Every time.

## Why it matters

The customer is told the wrong carrier, and looks for her parcel in the wrong place. The
owner has to remember to change a box that should already be right.

## Where it lives

`surfaces/commerce/record-handover.tsx` in both consoles: `useState<string>('usps')`.

## The fix

`carrierChosen(plan.description)` in `surfaces/commerce/carriers.ts` (both consoles, the same
file): the carrier whose name is a whole word in the chosen delivery ("UPS Ground" is UPS),
else USPS. The form starts there.

Test, red first: `surfaces/commerce/carriers.test.ts` in each console (4 each): UPS, FedEx,
DHL and USPS deliveries, a whole word only ("Groups delivery" is not UPS), USPS when nothing
is named, and the chosen service kept when the form starts on its carrier. Lint and format
clean.

## Confirmed by

P01 on screen, 2026-10-18. Dana Whitcomb's O-000035, "UPS Ground": "Who took it" started on
UPS. Doty pressed "Mark it as sent" without touching it. The shipment was recorded as `ups`,
"UPS Ground", and Dana's order page read "On its way · UPS · UPS Ground".

Marisol's O-000034 shipment, recorded before the fix, still says USPS. The Piggles console
was not opened; its test passes.

## Rating effect

—
