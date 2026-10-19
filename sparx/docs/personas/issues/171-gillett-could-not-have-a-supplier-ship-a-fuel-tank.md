# 171 — Gillett could not have its supplier ship a fuel tank to a customer

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11 (dropshipping)
**Surface:** workbench › Dropshipping › Connect a supplier; a product's Dropshipping panel; same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen and in the dev outbox, 2026-10-11
**Blocked on:** —

## What happened

Doty's story at sign-up says: "have a supplier ship fuel tanks and transmissions". He
switched Dropshipping on. The S&B 68 Gallon High-Capacity Fuel Tank (10-1008,
$1,449.00) is already in his catalog, with its photos and fitment; S&B Filters ships
it straight to his customer when he sends them the order.

- Connect a supplier offers five kinds: Printify, Printful, DSers, Spocket and "CSV
  feed". The first four are online services for print-on-demand and marketplace
  goods. A CSV feed needs a product spreadsheet the supplier publishes on the web.
  S&B is none of these: a maker who ships when sent an order.
- A product's Dropshipping panel only appears on a product that was imported from a
  supplier's catalog. The tank Doty already sells cannot be pointed at a supplier
  from any screen (the API accepts it on a variant; no screen sends it).

## What should have happened

Doty adds S&B Filters as a supplier who ships when he sends them the order, ticks
"ships from S&B Filters" on his existing tank, and when a customer buys it, the order
goes to S&B (or waits for him to send it), and its tracking reaches the customer.

## Why it matters

A promise made at sign-up and on the Dropshipping screen ("Link a business that holds
stock and ships it to your customers") cannot be kept for the most common supplier a
parts business has.

## Options (Brandon chose 1 on 2026-10-10)

1. **"Your own supplier: they ship when you send the order."** (Recommended.) A
   fifth supplier kind with no feed and no API: name, order email. Any existing
   product can be set to ship from it (on the product's Dropshipping panel). A sale
   creates the supplier order, which sparx emails to the supplier as a purchase order
   with the customer as the ship-to address (the purchase-order email already exists
   for stock orders), and the owner types the tracking when it ships ([170]'s fix).
2. Only let an existing product be pointed at a CSV-feed supplier (link existing
   products), and keep placing orders by hand. Smaller; still needs [170].
3. Leave dropshipping to the online services and CSV feeds; change the sign-up story
   and the Dropshipping screen so they promise only that.

## Where it lives

- `wizeworks/packages/dropship/src/vendors.ts` and `adapters/`: the five kinds.
- `sparx/apps/workbench/surfaces/commerce/product-dropship.tsx`: the panel, read only.
- `wizeworks/services/api-rest/src/routes/v1/dropship/suppliers.ts`: products link to
  a supplier only by import from its catalog (`/catalog/:productId/import`).

## The fix

Option 1, "Your own supplier".

**The kind** (`wizeworks/packages/dropship`): `direct` in `SupplierType`, a catalog entry
(`vendors.ts`: "Your own supplier — They ship to your customer when you send them the
order"; asks for "Where they take orders" and "Who you deal with there"), and
`adapters/direct.ts`: no product list, no tracking, `authenticate` refuses an address that
is not one, `orderRecipient()` says where orders go. The integration plane says "Emails each
order to them".

**The order** (`dropship-worker` `handlers/route.ts`): a supplier whose adapter has
`orderRecipient` is emailed the order instead of called: `supplier-order-email.ts` builds the
`purchase-order-sent` props at what the supplier charges (never the customer's price), with
their code, the customer as ship-to and the customer's delivery note; no cost or no address
leaves it waiting for the owner with the reason. Sent `sendAs: 'tenant'`: the email worker
(`send-as.ts`, the only process with email-platform) fills the business's From and Reply-To.
The template (`purchase-order-sent.tsx`, `shipsToCustomer`) says "ship the items below
straight to our customer… keep your invoice and prices out of the parcel" and asks for the
carrier and tracking number. Held orders are not sent until approved (`order.placed` fires on
approval).

**The product** (`api-rest` `routes/v1/dropship/product-links.ts`): `PUT` points an existing
product at a supplier with no product list (their code, what they charge), writing the same
rows an import writes, the variants through `variantService.update` (audit, cost re-pricing,
send-first-core rule); `DELETE` stops it. `suppliers.ts` accepts every catalog kind, exposes
`capabilities`, and refuses sync and import for a supplier with no list.

**The screens** (both consoles): Connect a supplier offers the kind and hides price rule, Sync
and Browse for it, checks the address as typed; the suppliers list says "Takes orders by
email" instead of "Not synced yet"; a product's Dropshipping panel has "Have a supplier ship
this" (who, their code, what they charge, with the profit worked out as you type), and on a
linked product "Change their code or price" and "Stop them shipping it". Search finds the
panel by "who ships this". Piggles' new code is in files under 250 lines
(`product-dropship-link*.tsx`).

Found on the way and filed: 213 (long product addresses), 214 (no name on the ship-to),
215 (collection offered for a supplier's part), 216–222 (see each).

Tests, red first: email-worker `send-as.test.ts` (4), email `purchase-order-sent.test.tsx`
(+3), dropship-worker `supplier-order-email.test.ts` (6), each console's
`own-supplier.test.ts` (8). Lint clean on every touched file. Typecheck not run (Brandon:
leave it for now).

## Confirmed by

P01, 2026-10-11, as Doty in the workbench, Renée and Teodora on the site:

- Connect a supplier › Your own supplier: "orders@sbfilters" was refused on the form ("That
  is not an email address, so no order could reach them"); S&B Filters connected with
  orders@sbfilters.test, contact Marco: "Working normally. When someone buys a product they
  ship, we email them the order from your business." No price rule, no Sync, no Browse.
- The S&B 68 gallon tank › Dropshipping: S&B chosen, code 10-1008 filled from the SKU; empty
  price refused; $1,100.00 showed "You sell it for $1,449.00, so you make $349.00 on each".
  Saved: the card shows S&B, orders@sbfilters.test, $349.00 (24% of the price). In the
  database: link, item and both variants' source and cost, with an audit row.
- Renée ordered the tank (fleet price $1,275.12) on account: held for Teodora; nothing sent
  (no supplier order, no email). Teodora approved: the supplier order read "Sent to supplier"
  and the email was accepted for orders@sbfilters.test in the same second.
- A third order (O-000026, the S&B cleaning kit) after the dev outbox existed: the email S&B
  got, read from `.dev-outbox`: "Purchase order O-000026 from Gillett Diesel Service Inc. · Hi
  Marco, please ship the items below straight to our customer… · Ship to our customer:
  Accounts Payable, 2275 S 900 W, Suite 200, Salt Lake City, UT 84119, US · their code
  88-0008 · 1 × $18.00 · Our customer asked: "Leave it with the parts room at the fleet yard
  gate, 900 W side."", from "Gillett Diesel Service". The outbox did not record Reply-To then;
  rendered with the same code, it is contact@gillettdiesel.com.
- A mixed cart (kit + Gillett's own additive, O-000024): only the kit went to S&B.

- Stop them shipping it, on the cleaning kit: the confirm named S&B, the kit and what
  changes ("you pick, pack and post it yourself. Orders already sent to them are not
  changed."); after it, "You ship this one yourself", the toast "You ship S&B Precision II
  Cleaning and Oiling Kit (88-0008) yourself now", and in the database the link and its item
  gone, the version's supplier cleared, its cost ($18.00) kept. The tank still ships from S&B.

A product with several versions at different costs, 2026-10-19: one code and one price for
the whole product sent S&B the wrong version's code ([362], fixed). After the fix the 75-5094
intake ships from S&B at $250.00 (Oiled) and $262.00 (Dry), and Renée's Dry filter (O-000040)
went to S&B as "their code 75-5094D · 1 × $262.00". Not checked: Piggles on screen (it has no
ship-from-supplier form).

## Rating effect

—
