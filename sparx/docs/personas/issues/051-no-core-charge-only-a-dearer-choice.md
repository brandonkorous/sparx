# 051 — sparx had no core charge, only a dearer choice

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3 (read ahead of the import)
**Surface:** catalog, cart, checkout, orders, invoices, returns, reports, the live site
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** sparx as Doty and the Gillett site, 2026-10-17, in part (a card purchase not checked: needs Stripe)
**Blocked on:** —

**Decision (Brandon, 2026-10-01):** build real core deposits and refunds. "No
shortcuts allowed at this point of the game."

## What happened

A core charge is a refundable deposit on a rebuilt part. The buyer pays it, sends
the old part (the "core") back, and gets the deposit back. 94 of Doty's products
carry one. Shopify has no such feature, so his store fakes it as a choice with a
higher price: "Accept Core Charge (+$150)" at $730.15, "Defer Core Charge" at
$600.00. sparx had no core charge anywhere: no field, no checkout line, no way
to track which cores are owed, no refund when one comes back.

## What should have happened

A rebuilt part can carry a deposit. The shopper sees it before paying, pays it
untaxed, and gets it back when the old part comes back. The counter can see
which cores are still out and settle each one.

## The fix

Design: the deposit rides on the part's own line (variant, cart line, order line,
invoice line), never as a separate item, so picking, stock and sales figures never
see it. It is never discounted, taxed or surcharged, never in a subtotal, always
in the total. Each unit's core ends one way: the part came back (refunded with
it), the old part came back (`coresReturned`, deposit refunded), or the business
kept the deposit (`coresKept`, with a reason). The rest is a core still owed.

- **Data:** migration `20270530000000_a_rebuilt_part_carries_a_core_deposit`
  (variant, cart line, cart, checkout session, order, order line, invoice, invoice
  line), with checks that a unit can only end one way.
- **Catalog:** variant inputs, service, MCP `create_variant` / `update_variant`;
  "Core deposit" on the variant editor in both consoles; import column
  **Core charge**.
- **Cart and checkout:** deposit snapshot on the line, total with it, gift card
  and account credit may pay it, the card charged it. Cart drawer, cart page,
  checkout summary, order total.
- **Product page:** a notice before the button (`coreDepositNote`), the version
  picker names each version's deposit when they differ, the older page design and
  the builder buy box too, and the page repair adds the notice to saved pages
  (`coreDeposit.shown`, reported to the owner if the live page lacks it).
- **Orders:** the order screen shows the deposit, how many cores are owed, and
  two moves: **Core came back** (usable cores refunded, unusable ones kept with a
  reason) and **Keep deposit**. An open invoice takes the deposit off first; paid
  money goes back to the card (through the gateway, its refund id saved) or onto
  account credit.
- **Cores owed:** workbench list (After the sale), REST `GET /v1/commerce/cores`
  and the two writes, MCP `list_cores_owed`, `receive_cores`,
  `keep_core_deposits`. Search: "cores owed", "core charge".
- **Returns:** a cored part that comes back brings its deposit back
  automatically; the refund dialog says so and shows the true figure.
- **Invoices:** line field, totals, invoice from order, quote to order, printed
  invoice (own row), template totals binding, invoice email (row and summary),
  invoice editor in both consoles.
- **Emails:** the order receipt lists each deposit as its own row and a
  "Refundable core deposits" total.
- **Shopper account:** the order page says the deposit and how many old parts are
  still to send back.
- **Reports:** deposits still held are not revenue (revenue summary, job profit).

## Defects fixed on the same path

- Return refunds "as store credit" never added any credit to the customer's
  balance. Now they do.
- Return refunds threw away the gateway's refund id, so the refund webhook could
  never match them. Now saved.
- With a card fee on, the card was charged the total without the fee while the
  page showed it with the fee, and the paid order read as part paid. One shared
  `liveTotal` now feeds both.
- A paid order with any partial refund was stored as "part paid", which lists it
  as money owed. "Paid" now asks whether the money that came in covered the order;
  2 stored orders repaired by migration `20270530000001_a_part_refund_leaves_an_order_paid`.
  The refund webhook now uses the same rule.
- A quote turned into an order dropped its card fee from the order's rows.
- The MCP `get_returns` filter could not ask for swapped returns.

## Checks

Commerce core service 11 tests (2 red when broken), cart deposits 3 (3 red),
order and invoice totals, payment rollup 2 (1 red), invoice email, site record 3
(3 red), import column, launcher phrases (red when broken). Type checks and lint
clean on every touched package.

## Not done here

- Sending cores on to the remanufacturer for credit (supplier side) is not part
  of this. The supplier return screens exist but have no "core" reason.

## Confirmed by

On screen, 2026-10-17, in part. SKU 0986435621 in the console: "+ $150.00 core, or old part first". On the site, signed in as Renée: $528.00 (was $600.00) and "A $150.00 refundable core deposit, or send your old part first". Cores owed: "2 cores owed on 2 order lines. If every deposit came back, you would give back $150.00.", with O-000033 (0986435621, 1 of 2, $150.00) and "Core came back" / "Keep deposit". Held order O-000020 lists "Core deposit 1 × $150.00" per injector. Earlier in the run, on screen: a core received on INV-000001 ($678.00 → $528.00, 2026-10-09) and the deposits left out of Reports' revenue ([172]). Not checked: buying with a test card, the gateway refund and the receipt email (no business here takes card payments).

## Rating effect

Commerce, orders, invoicing: to be scored on the re-run.
