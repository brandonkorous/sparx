# 351 — A cash refund was confirmed as going back to a card

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 349 on O-000033, as Doty
**Surface:** workbench › Selling › Orders › an order › Refund, the confirm and the toast (`sparx/apps/workbench/surfaces/commerce/order-detail.tsx`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19
**Blocked on:** —

## What happened

Brynn paid $1,587.00 cash for O-000033. Its refund row said it right: "Marks $793.50 as given
back. You hand the money over yourself." Doty pressed "Refund $793.50" and the confirm said
"This sends $793.50 back to the card used for order O-000033. The money leaves your account
straight away". The toast after it would have said "the customer's card has been credited".

## What should have happened

The confirm and the toast say what the row says: Doty hands the money back herself.

## How to reproduce

1. Open an order paid by hand (cash, cheque, a card on your own machine) with money left.
2. Press Refund. The confirm speaks of a card.

## Why it matters

It is the last thing she reads before an act she cannot undo. She can believe the money went
back by itself and never hand it over.

## Where it lives

The row branched on `refundGoesBackToACard`; the confirm and the toast were fixed strings.
Piggles already had all three in one place, `refund-words.ts`.

## The fix

`refund-words.ts` in the sparx console, the same as Piggles's, and the row, the confirm and the
toast all read from it.

Test, red first: `refund-words.test.ts` in both consoles. A card is named only when there is
one, and the order pane holds none of the fixed strings (red in sparx before the fix; Piggles
passes as it was). Commerce tests 513 (sparx) and 546 (Piggles) pass. Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19. O-000001's confirm read "This marks $600.00 on order O-000001 as given
back. You hand the money over yourself, so nothing is sent anywhere". O-000037, paid by card
online, read "This sends $121.85 back to the card used for order O-000037".

## Rating effect

—
