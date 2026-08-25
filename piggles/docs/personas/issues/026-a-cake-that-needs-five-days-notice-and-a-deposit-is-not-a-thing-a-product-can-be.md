# 026 — A cake that needs five days' notice and a $30 deposit is not a thing a product can be

**Status:** confirmed at the counter and on the website; one card charge still unproven
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 6 (owed) — closed out 2026-08-20
**Surface:** mypiggles › Sell › Products — the product editor and every one of its tabs
**Filed:** 2026-08-20
**Fixed:** built 2026-08-24 — confirmed on screen the same day
**Confirmed by:** P03 · Juniper Row · 2026-08-24 — the counter path and the website path, each end to end
**Blocked on:** a tenant with live gateway credentials, for the card-charge half alone

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

**Written 2026-08-20, when the answer was nothing.** The reproduction above was
**read from the schema and the surface registry**, not walked on the screen — the
dev stack was down when it was closed out, and one claim made from the code
("Bookings is off") was already wrong when the screen came back.

It has since been walked twice, and both walks are recorded below rather than
here: **Confirmed on screen — 2026-08-24** for the counter, and **The website —
walked 2026-08-24** for the shopper's side. This heading is kept because the
reason it once said "nothing yet" is worth keeping: a claim read out of the code
was already false by the time anyone looked.

## Decision — 2026-08-24, Brandon

**In scope, and it needs fixing.** A thing that takes five days' notice and a
deposit is a real shape of a real business, not an edge case to route around.

That settles option **2** above, and takes option 3 with it: all three rules
belong on the product, because all three are things the shop says about the
thing it makes. A cake is not a slot on a calendar, and routing a baker into
Bookings to price a cake would have been the same bug with an extra app.

## Built — 2026-08-24

### The shape

One idea, three settings, called **Made to order** — the words a person would
use for a thing that has to be made before it can be handed over.

| She says                       | The column                              |
| ------------------------------ | --------------------------------------- |
| "five days' notice"            | `commerce_products.order_ahead_days`    |
| "$30 down, the rest on pickup" | `deposit_type` + `deposit_amount_cents` |
| "half up front"                | `deposit_type` + `deposit_percent`      |
| "24 a day"                     | `daily_limit`                           |
| "due Saturday"                 | `orders.ready_on` — frozen at placement |

Every column is nullable or defaults to `none`, so every product that exists
behaves exactly as it does today: off a shelf, paid in full, as many as there
are. `deposit_type` carries a CHECK pairing it with its own value, because a
percentage of nothing is money.

Deliberately NOT reusing `inventory_levels.lead_time_days`: that is how long a
SUPPLIER takes to restock her, and reading it as the cake's notice would promise
a date nobody agreed to. Two numbers that look alike and answer different
questions.

### Where the money actually splits

A deposit defers **the rest of that line** and nothing else. Tax, delivery, and
every line without a deposit rule are taken at checkout as they always were, so
`dueNowCents = total − deferred`. The deposits are a FLOOR: however the discounts
fall, a checkout never collects less than the amount the shop asked to hold.
[made-to-order.ts](../../../../wizeworks/packages/commerce/src/made-to-order.ts),
with the arithmetic under test in `made-to-order.test.ts` (20 cases).

The gateway is handed `dueNowCents`, the `OrderPayment` row records
`dueNowCents`, and the pay button says `dueNowCents`. All three had to move
together — a button reading the total while the card is charged less is the
version somebody disputes.

**One thing this exposed, which was already wrong.** The payment webhook
hard-set `paymentStatus: 'paid'` with the charge amount and published
`order.paid`, which is right for a single payment and wrong for every other. A
deposit order would have read as settled in full the moment the deposit cleared,
and the rest of the cake would never have been asked for. It now goes through
`recomputeOrderPaymentRollup` — the chokepoint every hand-recorded payment
already used — and `order.paid` fires only on the edge where the balance
actually cleared. Split tenders benefit from that too, and had the same bug.

### The counter, which is where most of these are actually taken

**Take a sale** leads the Orders list for a reason its own comment states: most
of what this audience sells is sold in the room. A cake ordered across a counter
had to land in the same place as one ordered from the website, or the feature
would only have worked for the customers who never came in.

So the till reads the same rules. Put a celebration cake on a counter sale and:

- the pane says **Due Saturday, August 29** before she takes any money;
- the amount fills with **the deposit**, not the whole price — typing over a
  pre-filled total is how the wrong number gets taken at a counter;
- the sale does **not** auto-hand-over. Every other counter sale is over when it
  is made, and marking a cake collected on the day it was ordered would file it
  as done and take it off her list.

The daily allowance is deliberately NOT enforced at the till. That limit is a
promise the website keeps on her behalf; she is standing at her own counter and
can decide to make one more.

**Which forced the derivation to move.** `readyOn` started out written by
checkout after the order was created. It is now
[order-ready-on.ts](../../../../wizeworks/packages/crm/src/services/order-ready-on.ts)
in the order spine, fed by an explicit `orderAheadDays` on `CreateOrderInput` —
so the till, the storefront, MCP and any future import all land on the same day,
computed once, in the same zone.

### The day, and whose day it is

`readyOn` is a DATE, computed in the **business's own zone**
(`TenantBusiness.timezone`, UTC only when nobody has said). An order placed at
11:30pm on a Monday in Denver is already Tuesday in UTC, and five days' notice
from that is Saturday for the baker and Sunday for a server that counted wrong.
The daily allowance is bracketed the same way, or a shop's 24 would roll over
mid-service.

It is frozen onto the order at placement. Lengthening a cake's notice next month
must never silently move a date a customer was already promised.

`readyOn` is NULL when nothing on the order asked for notice. That is not "ready
today" and nothing renders it as one.

### Where it shows up

**Console** — Sell › Products › Overview grows a **Made to order** section with
all three settings and a sentence under each reading back what she just said
("$30.00 is paid when they order. The rest is paid when they collect."). On
Overview and not on Pricing, even though one of the three is money: a baker
adding a celebration cake is describing what the cake IS.

The order pane gains a **Due Saturday, August 29** callout above the money, and
its "still owed" alert now reads **"$90.00 due on collection"** in `info` rather
than "$90.00 still owed" in warning yellow — a deposit order is behaving
correctly, and chasing a customer who owes nothing yet is the wrong instruction.
The orders list carries a `Due Sat, Aug 29` line under the order number, at every
width, because that is what this shop scans the list for.

**Her website** — the buy box says how long the wait is, what the card will
actually be charged today, and (only when it is genuinely running out) how many
are left. The cart and the checkout summary both split "to pay now" from "to pay
when you collect", and the confirmation screen repeats both.

**Her email** — the default order confirmation carries a **Ready from** panel and
a **Due on collection** row, both of which self-drop on an ordinary order, so
every existing receipt is unchanged.

**Refusing an order she cannot fill.** Checked on add-to-cart so a shopper hears
it while they can still change their mind, and again at completion because that
is the binding moment and a basket can sit open past midnight. The message names
the product, the number, and that tomorrow starts again — "Only 4 Sourdough
Baguette left for today. There will be more tomorrow."

That message was going to be thrown away. The storefront replaced every non-409
cart failure with "please try again", which sends somebody to retry a thing that
cannot work until tomorrow — one outcome, two causes, and the message sending
her to redo what she just did. A 422 now carries the server's own words to the
shopper, and a refused quantity change says why instead of silently snapping
back.

### Files

Schema + migration `20270410000000_a_thing_that_has_to_be_made_before_it_is_sold`;
`@wizeworks/commerce` (`made-to-order.ts`, `services/made-to-order-service.ts`,
cart, checkout, product); `@wizeworks/commerce-schemas` (products, cart,
checkout); `@wizeworks/crm` (`order-ready-on.ts`, order service) and
`@wizeworks/crm-schemas` (`CreateOrderInput`); `@wizeworks/builder-schemas`
(binding + both default order confirmations); api-rest (public commerce, public
cart, the variant catalog, email-data, the payment webhook);
`wizeworks/apps/site` (buy box note, cart, mini-cart, checkout summary, payment
step, confirmation); and the console's product editor, order pane, orders list
and till.

`@wizeworks/commerce` gained a dependency on `@wizeworks/time` — the platform's
zone math, rather than a second copy of it here.

## Still owed

**Nothing has been driven on the screen.** That is the whole of what is left.

The database side is DONE, on 2026-08-24: Brandon stopped dev so `pnpm install`
(which links `@wizeworks/time` and regenerates the Prisma client on postinstall)
and `prisma migrate deploy` could run. Both did. Confirmed against the database
rather than the command output — `commerce_products` carries `order_ahead_days`,
`deposit_type` (default `none`), `deposit_amount_cents`, `deposit_percent` and
`daily_limit`; `orders` carries `ready_on date`; and all four CHECK constraints
are live, including the one that refuses a `percent` deposit with no percent.

The whole monorepo is green afterwards — `pnpm lint`, `pnpm typecheck`,
`pnpm format:check` and `pnpm test` all exit 0. Every typecheck error that
existed before was the stale client and nothing else.

**What is needed to finish it: dev back up.** Then, as Devi: put a five-day
notice and a $30 deposit on a real product, take it
through her own checkout, and confirm the card is charged the deposit, the order
says which day it is due, and the balance reads as due on collection rather than
overdue. Then take the same product across the counter through **Take a sale**
and confirm it lands on the same day, asks for the deposit, and stays on her
list instead of filing itself as collected.

Two things that are known and unresolved rather than not checked:

- `piggles/apps/workbench/surfaces/commerce/products-data.ts` is **3,014 lines**
  and RULE #0.5 was not applied to it. Two type additions were made and nothing
  else; splitting the console's highest-traffic data module mid-feature was the
  larger risk. It is owed, and it is its own piece of work.
- A daily allowance is counted from **order lines placed that day**, so a line
  cancelled after the fact gives its allowance back and a line refunded does
  not. That is the right reading of "24 a day" for a bakery and may not be for
  every trade.

## Rating effect

None recorded — `sell.product` has not been re-scored, because the screen has not
been re-walked. It stays where it is until it is.

## Confirmed on screen — 2026-08-24, as Devi

Marlow Knit, a $96 knit Juniper Row makes to order. Five days' notice, $30
deposit, no daily limit.

**The product editor.** The Made to order section sits on Overview, where a maker
describing what the garment IS would look for it. Each field reads its answer
back in her own words as she types:

| Field               | What it said                                                          |
| ------------------- | --------------------------------------------------------------------- |
| notice `0` (before) | "People can buy this and take it away the same day."                  |
| notice `5`          | "Your website asks for 5 days, so nothing is due before then."        |
| deposit `$30`       | "$30.00 is paid when they order. The rest is paid when they collect." |
| daily limit `0`     | "There is no daily limit."                                            |

The deposit picker is three plain sentences — "No deposit, the whole price at
checkout" / "A set amount" / "A share of the price" — with no jargon and no
percent field until a percentage is what she picked.

Saved, and the columns are right, with the two unused ones left NULL rather than
zeroed (`deposit_percent` and `daily_limit` are absent, not `0`):

```
title       | order_ahead_days | deposit_type | deposit_amount_cents | deposit_percent | daily_limit
Marlow Knit |                5 | amount       |                 3000 |                 |
```

**The counter.** Take a sale, one Marlow Knit, Ravi Naidoo:

- **"Due Saturday, August 29"** appeared between the lines and the money, saying
  the sale stays on her list until she hands it over.
- **The amount asked for filled itself with `30.00`, not `96.00`.** This is the
  thing the issue was filed about: a pre-filled total is how the wrong number
  gets taken at a counter.
- "**$66.00 of $96.00 will still be owed**" underneath it.

**The order it wrote.** `O-000001`, and every part of it reads correctly:

- Chips: **Part paid** · **To collect**. Not "collected" — the handover is
  skipped for anything still to be made, so it stays on the list of things to do.
- "Due Saturday, August 29 — Something on this order has to be made first, so
  this is the earliest day it can be collected. **It was agreed when the order was
  placed and does not move if you change the product afterwards.**"
- "**$66.00 due on collection**" in an `info` tone — not "still owed" in a
  warning tone. A deposit order is not a debt.
- Orders list: "**Due Sat, Aug 29**" under the order number.

**The date arithmetic is confirmed against the hardest case there is.** The order
was placed at `2026-08-25 00:35 UTC` — already the 25th in UTC — and `ready_on`
came out `2026-08-29`. Five days from the **24th**, which is the day it was in
Juniper Row's own zone. A naive "UTC date plus five" would have promised the
30th, and the customer would have been told the wrong day.

`payment_status` is `partially_paid`, derived by the rollup rather than declared,
and `status` is `placed`.

## The website — walked 2026-08-24, as a shopper

Marlow Knit put on sale (with a description Devi wrote), and bought from Juniper
Row's own website end to end. The delivery zone the note below asked for already
existed: **US domestic**, with Economy / Standard / Express rates, seeded
2026-08-23.

**The ready date reaches the customer.** The basket, both checkout steps and the
confirmation all carry **Ready from Saturday, August 29 — one item needs 5 days
to make**, and the order row agrees: `O-000003`, `ready_on 2026-08-29`. That is
the same day the counter sale produced, from the same derivation, which is what
moving it into the order spine was for.

**The arithmetic is right where it can be checked.** Before the payment provider
was settled, the summary read Total `$101.95` ($96.00 + $5.95 delivery), **To pay
now `$35.95`**, To pay when you collect `$66.00` — the deposit plus delivery
taken now, the rest of the line deferred. Exactly what `made-to-order.ts`
describes.

**Three defects came out of the walk**, all filed and all fixed:

- **[184]** — the product page said nothing at all about the notice or the
  deposit. `MadeToOrderNote` was built against the legacy section path; the live
  page is the silica record template, which had no such node. Fetched and never
  rendered.
- **[185]** — on a shop that takes payment in person, the confirmation said "You
  paid $35.95 today" about an order where nothing was charged, and the payment
  step carried three disagreeing numbers.
- **[186]** — at 360px the basket's thumbnail sat on top of the first letter of
  every product name.

## Still owed

**A card actually being charged the deposit.** Not walked, and not walkable here:
no tenant on this machine has live gateway credentials. Juniper Row's Stripe is
chosen but has no keys, every other tenant's gateway is inactive, and the only
provider that can complete a checkout is Manual payments — which by definition
charges nothing. Entering an API key is not something I will do, so this needs
Brandon to put a test key on a tenant. Everything downstream of the charge is
built and unit-tested (`made-to-order.test.ts`, 20 cases) and the button/gateway/
`OrderPayment` all read `dueNowCents`; what is unproven is the round trip.

**Juniper Row is now on Manual payments.** It was on `stripe_direct` with no keys
— which renders as "This shop cannot take card payments online just yet" and
dead-ends checkout — so the walk switched it. Two clicks to switch back once
there are keys.

**`products-data.ts` (3,014 lines) still owes its RULE #0.5 split.** Two type
additions went in without it.

**Two more defects were found on the way and filed separately**, both on Take a
sale: [182](182-ten-identical-rows-and-she-has-to-guess-which-size.md) (ten
indistinguishable rows for one garment's sizes) and
[183](183-the-customer-picker-only-knows-the-first-hundred.md) (the picker
searches only the first hundred customers, and tells her to add one who already
exists).

[184]: 184-the-page-that-sells-the-knit-never-said-it-has-to-be-made.md
[185]: 185-it-told-her-customer-they-had-paid-at-a-shop-that-takes-no-money.md
[186]: 186-on-a-phone-the-picture-sat-on-top-of-the-product-name.md
