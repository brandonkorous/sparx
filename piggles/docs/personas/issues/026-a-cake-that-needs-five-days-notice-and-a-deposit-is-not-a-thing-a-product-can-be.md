# 026 — A cake that needs five days' notice and a $30 deposit is not a thing a product can be

**Status:** open — established in the code, not yet walked on the screen
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 6 (owed) — closed out 2026-08-20
**Surface:** mypiggles › Sell › Products — the product editor and every one of its tabs
**Filed:** 2026-08-20
**Fixed:** —
**Confirmed by:** —
**Blocked on:** decision — see **The fix**, which is a product-shape question rather than a bug

## What happened

Act 6 put Marisol's whole catalogue in, priced. Two of her rules did not go
anywhere:

- **Celebration cakes need five days' notice and a $30 deposit.**
- The **sourdough baguette is 24 a day** — when they are gone, they are gone.

She added the cakes the way Sell invited her to: as products. A product in this
console is Name, Web address, Price, Product code, "Put it on sale straight
away", and tabs for pictures, choices, prices, stock, where it sells, and how it
looks in search. **There is no field on any of them for "you have to order this
ahead" and none for "pay some of it now."**

## What should have happened

She should have been able to say both things about the cake in the place she
created the cake, or been told plainly where else they live.

## Where it lives

The capability **exists**, and it is not on products — it is on **Bookings**:

- Five days' notice → `SchedulingService.minLeadMinutes`
  ([78-scheduling.prisma:84](../../../../wizeworks/packages/db/prisma/schema/78-scheduling.prisma#L84))
- $30 deposit → `BookingPolicy.depositType` = `deposit` + `depositAmountCents`
  ([78-scheduling.prisma:352-354](../../../../wizeworks/packages/db/prisma/schema/78-scheduling.prisma#L352))
- Both are reachable — `scheduling.services.detail` and `scheduling.policies` are
  registered surfaces and **not** hidden by the Piggles adapter
  ([lib/console/product.tsx](../../../apps/workbench/lib/console/product.tsx))

**Bookings is in her rail** — checked on the screen 2026-08-20. So the surfaces
are not hidden and the app is not absent; what is absent is any reason for a
baker adding a cake to Sell to think Bookings is where its notice and its deposit
live. Whether the module is actually ACTIVE, or merely listed the way Piggles
lists every app it could switch on, is **not checked**.

The commerce side has one `leadTimeDays`
([product-stock.tsx:438](../../../apps/workbench/surfaces/commerce/product-stock.tsx#L438)) —
that is **how long a supplier takes to restock her**, not how long a customer
must wait. Reading it as the cake's notice period would be wrong.

**The daily 24 has no home at all.** The nearest thing in the schema is
`PreorderWindow.maxQuantity` + `isCapped`
([61-inventory-demand.prisma:233-239](../../../../wizeworks/packages/db/prisma/schema/61-inventory-demand.prisma#L233)),
which caps **one window once** — not "24 again tomorrow". Searched the whole
schema for a recurring per-day cap (`dailyLimit`, `maxPerDay`, `perDayLimit`,
`dailyCap`, `dailyQuantity`): **no such column exists.** The only way to hold her
to 24 today is to set stock on hand to 24 and re-set it every morning, and stock
tracking is off for this business.

## Why it matters

A celebration cake taken with no notice and no deposit is the single most
expensive mistake this kind of shop makes — she bakes it, nobody collects it, and
she is out the ingredients and the oven slot. The 24 is smaller but it is the
promise the whole order-ahead idea rests on: if the site sells 40 baguettes for
Saturday, 16 people arrive to be told no.

## The fix

Not written yet, and it is a shape question rather than a defect to patch:

1. **A cake may genuinely be a booking** — it is a date, a deposit and a
   conversation, which is exactly what `SchedulingService` + `BookingPolicy`
   model. If that is the answer, the gap is that **nothing on the product editor
   says so**, and the Bookings app is off with no reason to think it is relevant
   to a bakery.
2. **Or "needs notice" and "take a deposit" belong on a product**, because the
   customer is buying a thing and not booking a slot.
3. **The daily cap is a third thing again** and matches neither — a repeating
   allowance, not stock and not a preorder window.

Whichever way it goes, this is Brandon's call: it is new surface, not a fix.

## Confirmed by

Nothing yet. The reproduction above is **read from the schema and the surface
registry**, not walked on the screen — the dev stack was down when it was closed
out, and one claim made from the code ("Bookings is off") was already wrong when
the screen came back. Before this moves off `open`, walk it: open the Cherry & Almond cake in
Sell, read every tab, then turn Bookings on and see whether the notice and the
deposit are actually reachable and actually work.

## Rating effect

None recorded — `sell.product` has not been re-scored on this, because the screen
was not re-walked.
