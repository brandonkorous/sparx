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

## The website

**This list is the definition of done for the site** (CLAUDE.md RULE #8). Every
page real, in Devi's voice, with real photographs — no template sentence left
anywhere, and the whole thing working from the public side.

She is leaving a marketplace. The site has to do everything that marketplace did
and look better than it.

| Page                                  | What is really on it                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Home                                  | Leads with New in, one photograph doing the selling                     |
| Shop                                  | Everything, filterable, with stock states honest                        |
| New in · The core range · Last chance | Three real collection pages, not one page three times                   |
| Product pages                         | Every colourway shown, size chart where the eye goes, fabric, fit, care |
| Size guide                            | Real measurements — the single biggest cause of returns                 |
| Made in the studio                    | Who makes it and where. Her whole premium                               |
| Shipping & returns                    | Flat $9, free over $150, 22% come back — say it plainly                 |
| Account                               | Order history, and starting an exchange without emailing her            |
| Contact                               | A form that reaches her                                                 |
| Privacy · Terms · Refund policy       | Real, published, linked                                                 |
| 404                                   | Offers New in                                                           |

**Working end to end:** variant picker across 15 combinations, out-of-stock
unbuyable, cart, `SPRING15` accepted and refused for the right reasons, the
free-shipping threshold showing in the cart, reviews on product pages, newsletter
signup, and search.

**Legal.** Run `get_legal_checklist` and close it out. Privacy is always
required, and returns/shipping/refund because the shop is on. Scaffolding drafts them; **publishing is the owner's act**
in Content → Legal pages, and the footer links have to actually resolve.

**The look.** Quiet, editorial, lots of white space and big photographs. The clothes are the design.

**Also required, as on every site:** a real header and mobile drawer, a footer
carrying hours, address, socials and legal links, per-page title and description
in plain words, a social card that renders, the sitemap, a favicon, a real 404,
and the same name/address/phone everywhere it appears.

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

## Standing checks

The run-wide list is in [CLAUDE.md](CLAUDE.md). These are Devi's instances of
it, and they are worked into the acts rather than saved for the end.

**Wrong moves.** Import the 25-customer CSV a second time. Refund the same Tee
line twice. Delete the Clay colourway with an open order against it. Apply
`SPRING15` to an order that has already been refunded.

**Dates.** The 14-day expiry boundary — the last hour the code works and the
first hour it does not.

**Money edge.** A partial refund of a discounted order that qualified for free
shipping: does the threshold recompute, and who ends up paying the $9?

**Buyer's side.** Anneliese's own account on the shop — her order history, and
starting the exchange herself rather than emailing Devi.

**Someone else's business.** Search for "Thistle" and deep-link a P01 product id.
Nothing must come back.

**Without a mouse.** The 15-variant grid, keyboard only. If it cannot be done,
that is the finding.

**Recorded for this run** — time from landing on meetpiggles to a live site,
how the lists feel at this business's volume, whether the growth board got its
contact + deal + `brand:piggles` tag, and whether the usage meters read sensibly
for this tenant.

| Standing check               | Result |
| ---------------------------- | ------ |
| Wrong moves                  | —      |
| Reload · deep link · restore | —      |
| Dates                        | —      |
| Money edge                   | —      |
| Buyer's side                 | —      |
| Someone else's business      | —      |
| One job without a mouse      | —      |
| Time to live site            | —      |

## Panes rated

Every pane opened during this run gets a Design and an Ease score in
[rating.md](rating.md), with its gap to 10 (CLAUDE.md RULE #6). Score it as you
leave it, not from memory at the end.

| Pane | Design | Ease | Gap to 10 |
| ---- | ------ | ---- | --------- |
| —    | —      | —    | —         |

## Issues found

Filed, fixed and re-proved from the screen during the run (CLAUDE.md RULE #3).
A row with no confirmation is not a fixed defect.

| #   | Severity | What (in her words) | Fixed | Confirmed by |
| --- | -------- | ------------------- | ----- | ------------ |
| —   | —        | —                   | —     | —            |
