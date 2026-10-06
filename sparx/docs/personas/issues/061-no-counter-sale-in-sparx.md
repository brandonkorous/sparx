# 061 — The parts counter could not write down a sale

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3 (needing an order to prove [057])
**Surface:** workbench › Orders; Wholesale orders; Search everything
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen as Doty, 2026-10-01: "take a sale" in Search everything → Take a sale first; the Orders toolbar's "Take a sale" opens it. A new buyer added from the sale ("Add Brynn as a customer"), then picked. The Bosch part showed "Core deposit $150.00"; "Their old part" offered both ways; deposit way totals $600.00 + $150.00 = $750.00; card with a note → O-000001 "Paid, Collected". Old part first → $600.00 cash → O-000002 "Waiting for an old part". Wholesale "Enter an order" and Piggles: **not checked** on screen.
**Blocked on:** —

## What happened

Gillett runs a parts counter (Kendra Ruiz). A walk-in buyer pays list, hands over
cash or a card, and leaves with the part. To prove [057], Doty needed one order with a
core deposit and one where the buyer sends the old part first.

The website could not take it: card checkout stops at "This shop cannot take card
payments online just yet", correctly, because his Stripe account is Brandon's to set
up. So he turned to the console to write the counter sale down, and there was no
screen for it. `POST /v1/orders` exists; nothing in the sparx console calls it.

Piggles has had this screen ("Take a sale", `commerce.sale.new`) since its own persona
pass: a salon, a bakery or a garage takes money in the room. sparx never got it.

The Piggles screen also knows nothing about core deposits. A rebuilt part rung up
there would be sold with no deposit and no "old part first" hold.

## What should have happened

From Orders, "Take a sale" opens a screen that sells anything in the catalog to the
person in front of you, takes the payment as cash or card, and writes the order. A
rebuilt part asks about the old part, the same two ways the website does, and the
deposit is a line of its own in the total.

## The whole surface (definition of done)

- [x] sparx `commerce.sale.new`, built in sparx's own layout, from the Piggles screen.
- [x] Reachable: Orders toolbar "Take a sale"; Wholesale orders "Enter an order";
      search ("take a sale", "counter sale", "walk-in", "phone order", "enter an
      order", "parts counter").
- [x] A version with a deposit asks "Their old part": pay the deposit, or (when the
      part offers it) bring the old part first, no deposit, held until it arrives.
- [x] Deposits on their own row, in the total taken.
- [x] The same in Piggles.
- [x] Tests proved red; parity check; both consoles typecheck.
- [x] On screen as Doty: a counter sale of the Bosch injector each way, then [057]'s
      order-side checks on those orders.
