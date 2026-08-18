# P03 — Devi Raman · Juniper Row

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Clothing & accessories (`apparel`) · **Rail groups:** sell · web · people

## Account

| Field         | Value                   |
| ------------- | ----------------------- |
| Email         | `p03.devi@piggles.test` |
| Tenant id     | —                       |
| Subdomain     | —                       |
| Published URL | —                       |

## The person

Devi Raman, 29, she/her. Made clothes for four years on a marketplace that took
14% and owned her customer list. She is moving off it and she is nervous: the
whole business is 340 orders a year and a mailing list of 1,900 people, and she
cannot afford a month of broken checkout.

She is the most technical owner in this roster — she edits her own photos, knows
what a size chart is, and will notice if a variant grid makes her enter 22 prices
by hand. She will also notice if the site is slow or ugly, because that is her
whole margin.

**What made her look:** the marketplace changed its fee structure again.

## The business

**Juniper Row** — small-batch womenswear, made in a rented studio, sold online
only. No shop, no counter.

- Everything is **size × colour**: five sizes, two or three colourways
- Stock is genuinely finite — 12 of a size, then it is gone
- Two drops a year plus a permanent core range
- **Returns are 22% of orders.** Exchanges are the normal case, refunds the
  exception, and getting this wrong loses her money twice
- Ships domestically, flat rate, free over $150

## Why she is here today

1. "Move my catalogue over without typing every size twice."
2. "Run a sale without emailing 1,900 people a code that breaks."
3. "Handle a return without three messages back and forth."

## Onboarding answers

| Question       | Answer                                                   |
| -------------- | -------------------------------------------------------- |
| Business name  | `Juniper Row`                                            |
| Trade          | Clothing & accessories                                   |
| What do you do | I sell things · I need a website · I deal with customers |
| Look           | first retail-shelf option; record which                  |

## The data

### The catalogue

Sizes **XS · S · M · L · XL** throughout.

| Product                              | Colourways           | Price   | Stock per variant |
| ------------------------------------ | -------------------- | ------- | ----------------- |
| The Ash Overshirt                    | Clay · Slate · Bone  | $128.00 | 6                 |
| Sunday Trouser, wide leg             | Ink · Sand           | $110.00 | 8                 |
| Marlow Knit, merino crew             | Oat · Moss           | $96.00  | 5                 |
| The Everyday Tee, boxy               | White · Black · Clay | $42.00  | 20                |
| Linen Shirtdress with removable belt | Chalk · Indigo       | $145.00 | 4                 |

That is **5 products, 12 colourways, 60 variants**. The Ash Overshirt alone is 15
— enough to find out whether a variant grid is usable or a form to be endured.

### One-size accessories

| Product                       | Price  | Stock |
| ----------------------------- | ------ | ----- |
| Silk twill scarf, hand-rolled | $58.00 | 15    |
| Leather-covered belt, brass   | $72.00 | 10    |

### Collections

- **New in** — Ash Overshirt, Linen Shirtdress
- **The core range** — Everyday Tee, Sunday Trouser, Marlow Knit
- **Last chance** — anything below 3 in stock (see whether this can be automatic)

### Customers to load

At least 25, imported rather than typed — she is arriving with a list. Include:

- **Anneliese Van der Berg** — `anneliese.vdb@example.test` — 9 orders, her best customer
- **Jo Kim** — `jo.kim@example.test` — 4 orders, returned 3 times
- **Fern O'Doherty** — `fern.odoherty@example.test` — apostrophe, one order
- **Sam Ruiz** — `sam@example.test` — never bought, on the list since 2024

### The sale

`SPRING15` — 15% off, the core range only, expires in 14 days, one use per
customer, not stackable with free shipping.

## The run

### Act 1 — Sign up, onboard, and clear the decks

Spine at speed. Then remove the apparel pack's sample catalogue — hers is
arriving and two catalogues in one shop is a mess she would not tolerate.

**Done when:** in the console, `industry = 'apparel'`, sample catalogue gone.

### Act 2 — Options before products

Set up size and colour as real options once, before entering anything. If that is
not possible and every product re-declares its own sizes, that is the finding —
file it before working around it.

**Done when:** the option structure exists, or its absence is filed.

### Act 3 — The variant grid

Build the Ash Overshirt: 5 sizes × 3 colours, one price for all 15, stock 6 each.
Time it honestly. Then do the remaining four products.

Watch for: whether one price can be applied to all variants at once, whether
stock can be set in bulk, whether SKUs generate, whether the grid survives at
360px, and what happens when a colourway is removed after variants exist.

**Done when:** 60 variants exist with correct prices and stock, plus the two
accessories.

### Act 4 — Photographs and words

At least three products with real images including one per colourway, size chart
information where a customer will look for it, and descriptions in her voice —
fabric, fit, care. One description deliberately long.

**Done when:** the product pages read like a real shop's.

### Act 5 — Collections and the shop

Build the three collections, put them on the site, and make the homepage sell New
in. Set shipping: flat $9, free over $150.

**Done when:** the published shop can be browsed by collection and the shipping
rule shows in the cart at the right threshold.

### Act 6 — Be the customer, twice

Clean browser, published site, phone width for at least one of them.

1. **Buy two things** — an Ash Overshirt in M/Clay and an Everyday Tee — total
   over $150, so shipping should be free. Pay with a test card.
2. **Buy one thing under $150** and confirm shipping is charged.
3. Try to buy a variant with 0 stock. It must be impossible, not merely
   discouraged.
4. Start a third order, get to checkout, and abandon it.

**Done when:** two paid orders exist, one abandoned cart is recorded, and the
out-of-stock variant could not be bought.

### Act 7 — The return

Anneliese wants the overshirt in Slate instead of Clay.

- Take the return through the console the way Devi would
- Put the Clay one back into stock
- Send out the Slate one
- Confirm the money is right — an even exchange should move no money

Then a second case: Jo Kim wants a refund on the Tee. Refund it and confirm both
the money and the stock.

**Done when:** an exchange and a refund are both complete and the numbers are
right to the cent.

### Act 8 — The customer list

Import the 25 customers from a CSV. Then build a segment — **bought in the last
90 days** — and check the count against what you actually created.

**Done when:** the import lands, the segment count is correct and explicable.

### Act 9 — The sale

Create `SPRING15` with all four conditions. Then test it as a customer:

- On a core-range item — 15% comes off
- On the Linen Shirtdress — it must be refused, with a sentence that says why
- Twice with the same customer — the second must be refused
- After expiry (move the date if needed) — refused

**Done when:** all four behaviours confirmed.

### Act 10 — Email the list

Write a real drop announcement to the segment. Check the merge tags resolve
against real data, preview it, send it, and see what happens in dev (`email.send`
is a no-op — record the queued events, do not claim delivery).

**Done when:** the broadcast is built, previewed with real values, and its dev
behaviour recorded.

### Act 11 — Reviews and the aftermath

Leave a review as a customer on the published site, moderate it in the console,
and confirm it appears. Then check what she would look at on Monday morning: what
sold, what is nearly out, who bought.

**Done when:** a review round-trips and the reports answer those three questions.

## What only this persona proves

The **variant matrix** at a size that hurts (60 variants), collections, a
conditional discount tested against all four of its conditions, an exchange and a
refund with the stock and money both correct, a real CSV import, a segment, an
abandoned cart, and a broadcast with merge tags.

## Verification

| Check                                                          | Result |
| -------------------------------------------------------------- | ------ |
| 60 variants created without entering 60 prices by hand         | —      |
| Free-shipping threshold behaves either side of $150            | —      |
| Out-of-stock variant unbuyable from the public site            | —      |
| Exchange moves stock and no money; refund moves both correctly | —      |
| 25 customers imported; segment count matches reality           | —      |
| Discount refused for the three reasons it should be            | —      |
| Merge tags resolve against real data in preview                | —      |
| Abandoned cart recorded and findable                           | —      |
| Variant grid usable at 360px                                   | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Issues found

| #   | Severity | What |
| --- | -------- | ---- |
| —   | —        | —    |
