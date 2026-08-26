# P03 — Devi Raman · Juniper Row

**Version:** 2.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-25

**Status:** in progress
**Run:** 2026-08-23
**Trade:** Clothing & accessories (`apparel`) · **Rail groups:** sell · web · people

## Account

| Field         | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Email         | `p03.devi@piggles.test`                                 |
| Tenant id     | `2e78fb6c-a823-4698-bcb9-58a4f17710a0`                  |
| Slug          | `juniper-row`                                           |
| Property id   | `a3fd094d-c8fe-48fd-b8e7-d1e0dbb42586` (slug `primary`) |
| Subdomain     | slug is `juniper-row`; the address not checked yet      |
| Published URL | —                                                       |

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

- Everything is **size × color**: five sizes, two or three colorways
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

| Product                              | Colorways            | Price   | Stock per variant |
| ------------------------------------ | -------------------- | ------- | ----------------- |
| The Ash Overshirt                    | Clay · Slate · Bone  | $128.00 | 6                 |
| Sunday Trouser, wide leg             | Ink · Sand           | $110.00 | 8                 |
| Marlow Knit, merino crew             | Oat · Moss           | $96.00  | 5                 |
| The Everyday Tee, boxy               | White · Black · Clay | $42.00  | 20                |
| Linen Shirtdress with removable belt | Chalk · Indigo       | $145.00 | 4                 |

That is **5 products, 12 colorways, 60 variants**. The Ash Overshirt alone is 15
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

| Page                                  | What is really on it                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| Home                                  | Leads with New in, one photograph doing the selling                    |
| Shop                                  | Everything, filterable, with stock states honest                       |
| New in · The core range · Last chance | Three real collection pages, not one page three times                  |
| Product pages                         | Every colorway shown, size chart where the eye goes, fabric, fit, care |
| Size guide                            | Real measurements — the single biggest cause of returns                |
| Made in the studio                    | Who makes it and where. Her whole premium                              |
| Shipping & returns                    | Flat $9, free over $150, 22% come back — say it plainly                |
| Account                               | Order history, and starting an exchange without emailing her           |
| Contact                               | A form that reaches her                                                |
| Privacy · Terms · Refund policy       | Real, published, linked                                                |
| 404                                   | Offers New in                                                          |

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

Set up size and color as real options once, before entering anything. If that is
not possible and every product re-declares its own sizes, that is the finding —
file it before working around it.

**Done when:** the option structure exists, or its absence is filed.

### Act 3 — The variant grid

Build the Ash Overshirt: 5 sizes × 3 colors, one price for all 15, stock 6 each.
Time it honestly. Then do the remaining four products.

Watch for: whether one price can be applied to all variants at once, whether
stock can be set in bulk, whether SKUs generate, whether the grid survives at
360px, and what happens when a colorway is removed after variants exist.

**Done when:** 60 variants exist with correct prices and stock, plus the two
accessories.

### Act 4 — Photographs and words

At least three products with real images including one per colorway, size chart
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

| Check                                                          | Result                                                                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 60 variants created without entering 60 prices by hand         | Partly — 15 of 60. The Ash Overshirt's 14 missing combinations were created and priced in ONE press of **Give them all the same price**. Four products still to build.                                  |
| Free-shipping threshold behaves either side of $150            | Yes. One delivery option, $9.00 free over $150.00. A $128 basket is offered "Delivery · 4 days — $9.00"; a $192 basket is offered the same option "Free". Both read off the delivery step as a shopper. |
| Out-of-stock variant unbuyable from the public site            | —                                                                                                                                                                                                       |
| Exchange moves stock and no money; refund moves both correctly | —                                                                                                                                                                                                       |
| 25 customers imported; segment count matches reality           | —                                                                                                                                                                                                       |
| Discount refused for the three reasons it should be            | —                                                                                                                                                                                                       |
| Merge tags resolve against real data in preview                | —                                                                                                                                                                                                       |
| Abandoned cart recorded and findable                           | —                                                                                                                                                                                                       |
| Variant grid usable at 360px                                   | Yes. 15 rows grouped by size, name left and price right, no sideways scroll; an expanded row stacks to one column with every field full width. Checked in dark and light.                               |

## Run log

Machine clock: **PDT (UTC−7)**. Run opened 2026-08-23 02:53 PDT.

| Date       | Act | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-23 | 0   | meetpiggles on a phone. The bar had no way into the site and the menu opened behind it — [160], [161], both fixed and re-proved at 360px. The bill calculator is right to the dollar. [162] filed (7px of sideways scroll on home) and later fixed — the class plus `home.tsx` 714 lines into eight files.                                                                                                                                                                                          |
| 2026-08-23 | 1   | Signed up from `/pricing` (`?from=pricing-hero`), onboarded as **Juniper Row · Clothing & accessories** with website + sell + customers ticked. Setup failed: "could not finish setting things up", and the form replaced her answers with **Devi's workspace / Food & drink / nothing ticked** — [163], fixed and re-proved. Furnishing then failed twice more and worked on the third press — [164], a 4.25s bulk load against Prisma's 5s ceiling, fixed and re-proved by three console reloads. |
| 2026-08-23 | 1   | Look chosen: **Fashion Boutique (Minimal)** (`sparx-retail-apparel-minimal`) — the shelf re-ranked to apparel as soon as the trade was picked, offering it ahead of Streetwear Label, Bold Athletic, Couture Serif and Glossy Fashion.                                                                                                                                                                                                                                                              |
| 2026-08-23 | 1   | Cleared the decks. Practice data removed in one press. Then found six products named **sparx …** in her own shop, on every Piggles tenant in the database — [165], fixed at the config AND the gate. Removed those and the nine template products: 15 deletions, one at a time, no way to select more than one — [166], `Blocked on: scope`. **Act 1 done**: `industry = 'apparel'`, Products reads "Nothing to sell yet".                                                                          |
| 2026-08-23 | 2   | **Options before products: there is no such thing.** Searched "sizes and colors", "size", "options"; walked Selling settings, Kinds of product, Build-your-own. Sizes belong to a PRODUCT, so XS–XL gets typed five times over — [170], `Blocked on: decision`. Kinds of product listed **"shirt Apparel"**, **"utensils-crossed Food & Beverage"** — icon names printed as words, on every tenant — [167], source + migration fixed, rows need the pipeline.                                       |
| 2026-08-23 | 2   | Typing the sizes cost ten trips to the mouse: Enter did nothing and **Add a size** left the cursor on the button — [168], fixed. Re-proved by typing `XS ⏎ S ⏎ M ⏎ L ⏎ XL` and `Clay ⏎ Slate ⏎ Bone` without touching the mouse. `product-options.tsx` was 997 lines and is now six files, none over 250. **Act 2 done**: Size × Color committed, 15 combinations, swatches `#b08268` · `#5a6470` · `#e8e1d5`.                                                                                      |
| 2026-08-23 | 3   | **Her $128 overshirt came out at $128,000.** The price box held a real `0.00` that looked like a hint, so clicking in and typing merged with it — [169], fixed: the box starts empty and a price is now required. Re-proved with the Sunday Trouser at $110.00.                                                                                                                                                                                                                                     |
| 2026-08-23 | 3   | **The variant grid does not make her type fifteen prices.** One press of **Give them all the same price** created all 14 missing combinations at $128.00 with codes generated, after a dialog that said exactly that and promised nothing would go on sale. The grid holds at 360px and reads clean in both themes. The generated codes take their stem from the NAME, not from the code she typed — [172], `Blocked on: decision`.                                                                 |
| 2026-08-23 | 3   | Appearance menu: **Light and Dark wore the same icon**, and it changed with the current theme rather than describing the row — [171], fixed in `@piggles/ui` so all three apps get it, re-proved in both themes.                                                                                                                                                                                                                                                                                    |
| 2026-08-23 | 3   | The other four products and both accessories, using the same two fixes end to end. Every size and color list typed straight through on the keyboard; four prices went in click-and-type with nothing to clear. **60 variants across the five garments**, one price each — Ash Overshirt 15 × $128, Everyday Tee 15 × $42, Marlow Knit 10 × $96, Linen Shirtdress 10 × $145, Sunday Trouser 10 × $110 — plus the Silk twill scarf ($58) and Leather-covered belt ($72).                              |
| 2026-08-23 | 3   | **Stock sent her to the product for a panel that is not on it.** The empty state says "Open a product and use its Stock panel" — a product has seven tabs and none is Stock. The panel is REAL and good, but it is a dockable pane listed as "How many you have"; searching "stock" does not surface it. Then the first count is a locked room: "Add an item to count" only searches what is already stocked, while the scan box beside it reaches everything — [173], fixed.                       |
| 2026-08-23 | 3   | **A warehouse in Ohio she never opened.** Locations held `Main Warehouse` (deliberate, audited, bootstrapped on module activation) and `Fulfillment Center · Columbus, OH` — created 1.9s after `tenant.industry.installed {"industry":"apparel","installed":0}`, with no audit entry of its own. Practice data ruled out first: "Not loaded", and its loads came five minutes later — [174], `Blocked on: decision`.                                                                               |
| 2026-08-23 | 3   | **Act 3 done.** 62 items counted at 6 each through the scan box and the quantity table, finished and applied behind a confirm that named the number, the place, and that it could not be undone. DB agrees: 62 rows at `on_hand = 6`. The counts list then reported the whole thing as **Difference $0.00**, because none of her 62 versions has a cost — [175], `open`.                                                                                                                            |
| 2026-08-23 | 3   | **Fixed both, and split the files they lived in.** The Stock empty state now offers **Count what you have** and **How many you have**; the count-started toast counts the lines it made; "Add an item to count" became "Add something already counted here" and points at the scan box for anything new. Re-proved by starting a count at each location: "Nothing has been counted here before…" over 0 items, and "62 items are ready to count." over 62.                                          |
| 2026-08-23 | 3   | **The money column tells the truth now.** `varianceUnits` added to the shared count row (both brands), so the list can tell nothing-moved from nothing-costed: her count reads **No cost yet**, discarded ones read **—**. Found while re-proving it that discarding put three more `$0.00` rows on screen, and that at 360px the fold-back line truncated away the only copy of those numbers — both repaired. `stock-list.tsx` 525→248 and `count-detail.tsx` 1155→107 across twelve new files.   |

| 2026-08-24 | — | **[026] carried over from P01**, both halves. At the counter: Take a sale with a Marlow Knit put **Due Saturday, August 29** above the money and pre-filled the amount with the **$30 deposit** rather than the $96 total. Two defects came out of it — [182] (ten indistinguishable size rows) and [183] (the customer picker searched only the first hundred, and told her to add someone who already exists; rebuilt as one shared control across all three pickers). |
| 2026-08-24 | — | **[026]'s website half.** Marlow Knit put on sale and bought end to end as a shopper. The ready date reaches the basket, both checkout steps and the confirmation, and the order agrees (`O-000003`, `ready_on 2026-08-29`). **Three defects, all fixed and re-proved**: [184] the product page said nothing at all about the five days or the deposit; [185] the confirmation told a customer "You paid $35.95 today" at a shop that charges nothing online; [186] at 360px the basket's thumbnail sat on the first letter of every product name. |
| 2026-08-24 | 4 | **Act 4 — photographs and words.** The Ash Overshirt written up in her voice: six paragraphs, fabric, fit, care, Cotton 60% / Linen 40%, made in Denver. Everything typed on the **Details** tab vanished the moment she clicked Overview, with **Saved just now** on screen — [188], fixed. Silica unmounts an inactive tab panel, so the draft, the dirty dot and the pane guard were all decoration; `product-detail.tsx` 543 lines into three files, none over 250. |
| 2026-08-24 | 4 | Three photographs uploaded, one per colorway, alt text written, each pinned to its color through **Where this photo shows**. All three render as **broken pictures in the console** — [189]. The storefront shows them fine, so no shopper saw it. My first diagnosis blamed the image allow-list and was wrong: Next refuses an upstream image resolving to a loopback address, and reports it with the SAME sentence the allow-list uses. The server log said which; I had not read it. |
| 2026-08-24 | 4 | **Then looked at the page a shopper sees, and it was the worst screen of the run.** Fifteen versions and **no way to pick one** — a hidden field bought the same size for everybody ([190], blocker). Her six paragraphs as one slab ([191]). An **empty grey box** above Add to cart on every ordinary product ([192], from yesterday's own [184]). Every typed detail **printed twice with a blank line above it** ([193]). All four fixed and re-proved as a shopper. |
| 2026-08-24 | 4 | Buying one then showed the basket calling an XS · Oat and an S · Moss both "Marlow Knit", with a product code as the only difference — [194], fixed: the cart line carries the words she picked from. |
| 2026-08-24 | — | **Brandon: the featured strip is bigger than the product it sits under.** [187] had closed that half as "needs a silicaui change, Brandon's call". It needed neither — silicaui ships `scroll-strip`, whose own description is this job. Rebuilt on it, one product centred, and the **66 stamped blueprints migrated** through the upgrade-on-read rule with their versions bumped: [195], and [187] corrected. |
| 2026-08-25 | 4 | **[189] proved on screen** once the console restarted: Clay, Slate and Bone all render. My diagnosis had been wrong — the allow-list I rewrote was never the cause. Next refuses an upstream image that resolves to a loopback address and reports it with the SAME sentence the allow-list uses; the server log said which, and I had not read it. The hardening stays; the real fix is one flag, dev-only. |
| 2026-08-25 | 4 | **The Marlow Knit and the Linen Shirtdress written up**, finishing act 4: six paragraphs each in her voice, fabric, fit, care, 100% lambswool / 100% linen, made in Denver, two photographs apiece pinned to their colorway. The Shirtdress went on sale. |
| 2026-08-25 | 4 | Filed a defect for letters vanishing as I typed, then **disproved my own report** — [196]. The automation types a hundred characters in under a second and React drops one; at human speed the same sentence lands character for character. Withdrawn. The one real thing it turned up, a tab registering itself twice, was fixed and recorded as the tidy-up it is. |
| 2026-08-25 | 4 | **Then read the page a blind shopper hears, and every photograph said "Product image"** — [197]. Seven sentences she typed into a field that promises they will be read aloud, and not one reached the site: an image binds its src OR its alt, never both, so the alt was dropped at resolution. The resolver keeps it now and a render stage writes it back, for every tenant. |
| 2026-08-25 | 4 | **The Media pane at 360px**, the check act 4 still owed. It holds: two photo cards to a row with the color underneath, and "This photo" stacks to one column with every control full width. The three photographs draw as themselves in both themes. One thing came out of it, at every width rather than only the narrow one: the pinning box said **"Any size Any size"**, its answer printed twice, because the select was handed a placeholder AND a real label for the empty value and both fired. [198], fixed. |
| 2026-08-25 | 5 | **Act 5 opens on a word Piggles does not use.** She typed "collections" into the search and got "Nothing matches that" — the screen is **Groups of products**, four rows down the panel she had open. Renaming a screen DELETES its old name from search, for all ~220 renames; "inventory" and "coupon" only work because somebody hand-added them. [199], fixed at the point the vocabulary is applied, so every rename keeps its platform name as a keyword. |
| 2026-08-25 | 5 | **The groups still held 21 products four acts after she emptied the shop.** Bestsellers said 6 and its page on her website said 0; the six chips read "Product" because a deleted product cannot be named. [200], fixed by counting only products that still exist — filtered on READ, so restoring a product puts it back. Then the whole pane in sparx vocabulary, "collection" thirty times over including the delete button, against the one word RULE #3 names — [201], plus four `neutral` colors and two files over the 250-line ceiling. |
| 2026-08-25 | 5 | **A group could not be saved at all.** Name, address, description, two garments ticked, and Save answered "That didn't save. Check what you entered" twice. Nothing was wrong with what she entered: the pane sends `null` for every blank optional field and the schema accepted only `undefined`. Four nulls, 422, every time, for every tenant. [202], blocker, fixed by making the clearable fields nullable — which is what lets a banner be REMOVED as well. |
| 2026-08-25 | 5 | **Then the worst one: her shop page said she had nothing to sell.** Seven garments in the console, three on sale, and `/shop` read "0 products · No products found". So did every collection page, and so did Thistle & Rye's. Listings are index-only and the index is never built in dev; the catalog was one endpoint away. [203], blocker, fixed by falling back to the database when the index comes back empty — which is also what stands between a Typesense outage and every tenant's shop going blank. Thistle & Rye now lists 9. |
| 2026-08-25 | 5 | **The three groups built.** New in (Ash Overshirt, Linen Shirtdress, featured, her own sentence), The core range (Everyday Tee, Sunday Trouser, Marlow Knit), Last chance (automatic, "Stock is running low"). The rules editor asks in plain words, but "running low" would not say HOW low — [204], fixed to say it is the reorder point set per size under Stock. Whether a rules-driven group actually fills is **not checked**: it needs the inventory worker, which dev does not run. The six template groups deleted, one at a time. |
| 2026-08-25 | 5 | **Her $9 delivery came out at nine thousand.** The Price box held a real `0.00`, so click-and-type made `9.000.00` — [169] again, four acts later, on the field every shopper pays through. It was in the SHARED money field this time, so it was every amount in the console that opens at zero. [205], fixed by selecting the text on focus. Postage set: one option, **$9.00, free over $150.00, arrives in about 4 days**. |
| 2026-08-25 | 5 | **Checkout said shipping was Free before it knew where to send it** — on a $128 basket, on two of three steps, while the delivery choice beside it said $9.00. It corrected only at Payment, where the button reads $137.00. The same summary also showed a $192 line over a $96 subtotal after a basket edit. [206], fixed: the session becomes the authority on money only once delivery has been submitted. Both sides of her threshold then proved — $128 → $9.00, $192 → Free. |
| 2026-08-25 | 5 | **The bulk bar could retire four products or delete them, and not sell them.** Four garments written but not out; she ticked all four and was offered Retire and Delete. The filter tabs above the same list say All · On sale · Not on sale · Retired, so the screen names the state she wants and will not move anything into it. The endpoint had always taken `active` — only the button was missing. [207], fixed: **Put on sale** leads the bar in `success`, and it counts only the ones it would actually move, so choosing all seven asks about 4. |
| 2026-08-25 | 5 | **The console told her the shop was blank while it was selling.** The products list carried a warning that "anyone visiting is told there is nothing to buy" over a shop that was listing three garments in the next tab. True yesterday, false since [203] gave listings a database fallback, and nobody went back to the sentence describing the consequence. [208], fixed: it now says searching is what won't find them, in `info`, leading with "your products are on your site and people can buy them". A fix that repairs a consequence has to visit whatever was describing it. |
| 2026-08-25 | 5 | **Then the shop quietly dropped three garments and said "4 products".** Putting the last four on sale indexed those four — and the index answering with anything at all stopped [203]'s fallback firing, so Marlow Knit, The Ash Overshirt and the Linen Shirtdress vanished from her own shop. Her two newest pieces, at $128 and $145, invisible while a $58 scarf led the page. **A blank shop is loud; a shop that is four-sevenths right looks finished.** [209], blocker, fixed: on a browse listing the catalog decides the set and the index only supplies facets, and only when it is provably in step. Shop now reads 7, New in reads 2, Thistle & Rye still reads 9. |
| 2026-08-25 | 5 | Her homepage is still the stock starter, addressed to HER in front of customers — "This is your homepage; edit every word to make it yours" — and it lists all seven products twice, the second time under a heading that says **Featured**. All four of her builder pages are drafts ("Not live yet"); what the public sees is the published starter. **Not yet filed**: the duplicate grid and the Featured binding still need checking in the builder, and her Site identity pane showed the tagline **"Seasonal food for occasions that matter."** on a clothing shop — a string that exists only in the catering blueprint, which she never installed, and which is in no table I can find. The dev stack went down before I could read the field's real value; verifying that is the first thing when it is back. |
| 2026-08-25 | 5 | **Her clothing shop was branded as a catering company.** Her Site identity pane offered "Seasonal food for occasions that matter." as her tagline, and her site's stored brand is `Saffron & Sage Catering` entire — saffron, sage, Fraunces — from a blueprint she never installed (she installed `sparx` then Kestrel, "Fewer, better clothes"). Her live page still downloads Fraunces in five weights and paints none of it. It is not her: **every tenant wears a sample company's name** — Thistle & Rye is "Kettle & Crumb", Everson Apparel is "Farm Fresh" — because an install stamps the demo identity, and the marketplace PREFERS that dead key over the business's own name. [210], fixed at the root and at the read, which repairs every existing tenant with no migration. How catering specifically reached her is **unresolved** and recorded as such. She rewrote her tagline: **"Made here, in small runs."** |
| 2026-08-25 | 5 | **The block that sells products could only ever sell everything.** The Add panel offers "Products — pick the source (all, featured, new, related, a category)"; the Inspector offers an anchor name, a layer name and a lock. `ProductsSource` has five values, the storefront renders all five, `node.setData` writes the ref, and **no screen ever called it** — so every listing anyone dropped was the whole catalog for good, which is why the starter's second grid is headed "Featured" over the identical seven products. [211], fixed: a **What this shows** panel listing her own groups by name with counts, repointing every node in that section bound to the ref rather than just the repeat. Confirmed on screen — three sources plus New in (2), The core range (3), Last chance (0). |
| 2026-08-25 | 5 | **Her homepage is still not built, and this is why.** With the picker working I built it — opening with a wide picture, then New in — and the workbench went to a 500 mid-edit: `Module not found: '@wizeworks/brand-core'` from `@wizeworks/auth`. The package is correct on disk and correctly linked; the symlink is stamped 04:19 today, so **`pnpm install` ran into a live dev session** and Turbopack kept a stale failed resolution. Environmental, the same species as P01's reload storm on 2026-08-20, and not a product defect — but it took the unsaved draft with it. The page is owed a rebuild once dev is restarted. |
| 2026-08-25 | 5 | **Her homepage was live, and the editor said it did not exist.** Dev came back, I reopened her Home page, and the canvas was empty — one line in Layers, and "Nothing saved on this page yet" along the bottom. Her website was serving a full homepage at that moment. Not a rendering hiccup: **two starter systems, and the seed still wrote the retired one.** The storefront and the page switcher both read silica; `listOrSeed` seeds `STARTER_PAGES` into the legacy column, which nothing downstream reads. So the rows list, open blank, and her first Save would have overwritten five sections she had never seen. `siteService.reset` promises the editor "re-opens on the CURRENT starter seed" — but the next page-list read materialized the _retired_ seed first, so **the one door back into the old tier was the seed meant to get you out of it**, and `ops:retire-legacy-tier` has been draining a pool something else was filling. Her "How your pages do" report scored the page **0 people, 0 times opened, Not measured** — the page every visitor lands on. [212], blocker, fixed at both ends: a page with no body opens on the body the SITE is serving (which heals every affected tenant on open, no migration), and the seed now writes silica rows. The message is now "This is the page your visitors see. Save it to make it yours." |
| 2026-08-25 | 5 | **She wrote her homepage.** Four blocks, in her voice, on the page her customers were already reading: "Made in small runs." / "Everything here is cut and sewn in small batches. When a size goes, it does not come back.", then **New in** and **The core range** pointed at her own two stocked groups through [211]'s picker, then the closing band — which had been Piggles telling _her_ to "invite your team", in front of her customers — rewritten as "Not sure on size? Tell me what you usually wear and I will tell you which of ours will fit. I answer these myself." Saved, published, and live: New in shows the Overshirt and the Shirtdress with their photographs, The core range shows three. **Two product bands on one page, each showing only its own group** — which is [211] proved end to end on a real page for the first time. |
| 2026-08-25 | 5 | **"Featured" showed everything, and she had featured nothing.** The starter's second band listed her whole shop under a heading claiming somebody picked it — the same seven garments, in the same order, immediately below the same seven. The resolver falls back to the catalog when nothing is tagged, and the comment says why: so the rail is never an empty heading. **That reasoning was sound and had gone stale** — issue 187 already moved a curation's heading inside `headingRow`, so an empty rail now takes its heading down with it. The guard outlived the thing it guarded and went on doing its side effect. A fallback is a claim about what happens when the real answer is missing; **when something else starts handling that case, the fallback does not become harmless, it becomes wrong.** [213], fixed: `commerce.featured` is what she featured and nothing else. On Threadline — 24 products, nothing tagged — the band is gone entirely, catalog once. Thistle & Rye's authored homepage is undisturbed. |
| 2026-08-25 | 5 | The Design inspector spells alignment **"Centre"**. Small, and it is on every text node in the builder. Noted, not yet filed — worth one sweep for the rest of the British spellings rather than three separate reports. |
| 2026-08-25 | 6 | **The out-of-stock test, first.** She counted the Ash Overshirt in XS · Bone to zero — the console was clear ("your website shows it as sold out and will not take an order for it") — and the product page listed it, said "sold out" in its label, and **let a shopper select it anyway**. Add to cart did not change; the refusal came after the click, worded "just sold out", which describes a race that had not happened. The guard held at the server and nothing oversold; the twenty seconds before it were the defect. [214], fixed: a gone version renders a DISABLED, struck-through radio that binds nothing, which also makes "just sold out" true again by making it unreachable any other way. **My first cut broke the other fourteen** — I gated the buyable branch on the flag being ABSENT, and an absent ref is UNKNOWN to the engine, not false, so it kept the node and stopped resolving the label inside it. Fourteen bare radios, no words. The types were happy; the screen was not. |
| 2026-08-25 | 6 | **Two orders bought, both sides of her threshold.** Anneliese Vogt: Ash Overshirt M · Clay + Everyday Tee, $170, **Delivery · 4 days — Free**, O-000004. Jo Kim, at 390px in an iframe: Everyday Tee L · Black + Marlow Knit M · Oat, $138, **Delivery · 4 days — $9.00**, total $147.00, O-000005. [206] holds all the way through — "Once we know where" first, then the real figure, and the button matches the summary. |
| 2026-08-25 | 6 | **Then the checkout told a mail-order customer to come and collect.** "You pay when you collect" on the last screen before a $170 order posted to Portland, Oregon, from a maker whose whole business is _sold online only, no shop, no counter_ — and on the receipt after it, and on the product page, and in the basket. **Nothing anywhere said how to actually pay.** The platform's manual-payment mode is NAMED "in person", so every screen wrote copy for a room; what she chose is described in her own console as "record check, cash, wire or bank transfer by hand" — four ways to be paid, none of them a counter. It came in with [185]'s fix, which was right about the half it was looking at. [215], fixed: the order already knows whether it is being collected, so the screens ask it. She still cannot say HOW she wants to be paid — that needs a column, and is recorded as blocked. |
| 2026-08-25 | 6 | **A basket left behind, and the screen for chasing it would not say who.** Priya Menon typed her name, her email, reached the delivery step and closed the tab. Four rows in Baskets left behind, $657 between them, all four reading **"Guest shopper"** — and the pane said "A guest — there is no account attached to it", which is true about the database and useless to Devi. Her name and address were one join away, on the checkout session, the whole time. **The pane exists to make a lost sale chaseable and refused to name the person.** [216], fixed: the list, the tab and the pane now carry the name, the email as a link, and how far they got. Three real names and one honest "Nobody left a name". |
| 2026-08-25 | 6 | **Free delivery showed as no delivery at all.** Her $170 order — the one her free-shipping rule applied to — had no Delivery row in the console, while the $138 one showed $9.00. Read side by side they look like a posted order and a collection. It is the platform-wide rule inverted: usually absence renders as a measurement, here a measurement rendered as absence, on the screen where she would see what her own threshold costs her. [217], fixed: a posted order always shows the row and reads **Free** at zero; a collected one still shows none, which O-000001 confirms. |
| 2026-08-25 | 6 | **Act 6's fourth job is half done, and recorded as such.** Priya's basket is in the list and identifiable, but it is 20 minutes old against a 120-minute abandonment window, and moving it to **Walked away** is a worker's job, not a screen's. That tab was empty throughout, so the abandoned path itself is **not checked** — to be re-checked later in this run, once the window has passed. |
| 2026-08-25 | 6 | **Neighbour check (RULE #7).** Checkout, the order pane and the version picker are shared spine, so Thistle & Rye was reopened: their collection-only checkout still reads "You pay when you collect" word for word, shipping still Free, shop still lists nine. The collected branch was also proved on Devi's own O-000001 — "the earliest day it can be **collected**", no Delivery row, "$66.00 due on collection". Both branches, one afternoon. |
| 2026-08-25 | 6 | **And their footer had the legal links falling out of the bottom of it.** Five published policies in a column sitting below the footer band, on the page background, hard against the left edge. The safety net that guarantees a legal column when the chosen footer has no slot for one was appending it to the footer ELEMENT rather than to the container inside it — so it worked, and the result did not look like part of the site. [218], fixed to land in the grid the other columns are in. Confirmed at the tree and by a test and **not on a page**: a frame is stored once seeded, so this reaches new sites and not existing ones — the third time this run has met a code fix that a stamped tree does not receive. |
| 2026-08-25 | 7 | **The returns module had no front door.** Anneliese wants Slate instead of Clay. The order pane has payment, delivery, refund and cancel and nothing about anything coming back; Sell › Returns has seven filter chips, a nine-state lifecycle, per-line approvals, prepaid labels, condition grading, four dispositions, restocking fees and three ways to settle — and no way to add one. `returnService.create` is written, validated, audited, publishes its event, and **has no caller anywhere in the repository**. The order pane's own refund row says "to take stock back in, use a return instead", pointing at a thing with no door. [219], fixed: `POST /v1/commerce/returns`, and a **Coming back** section on the order that lists what can still be sent back, capped at what actually WENT OUT minus what is already on its way. A test can pass on a function nobody can reach; only looking for the button finds this. |
| 2026-08-25 | 7 | **Then the exchange could only be ended by refunding it.** The return said "Wants a replacement" from the moment it was opened, and at the end the pane said _"Give the customer their money back to finish"_ and offered one button that moves real money and cannot be undone. Click it and Anneliese gets $128.00 back on an even swap; don't, and the return sits in the work queue for ever and the Slate one goes in the post unrecorded. The system had `preferredOutcome` the whole time, PRINTED it at the top, and then wrote every sentence below as though the answer had been "Money back". [220], fixed: settling follows what the customer asked, and an exchange ends at its own terminal state — **Swapped**, `$0.00 moved` — rather than a $0.00 refund that would put a nil refund in her books for every swap she ever does. |
| 2026-08-25 | 7 | **Choosing the replacement offered five identical rows.** Typing `slate` returned five lines all reading "The Ash Overshirt · $128.00" — XS, S, M, L and XL — with nothing to tell them apart, on the screen whose whole job is sending the RIGHT one. The option values were already loaded and documented in the data file as "what actually tells two rows apart"; the row never drew them, and the search matched on a SKU it also never showed. [221], fixed: `M · Slate` under the name, options in the filter, and the commit button reads **Send M · Slate**. Shared picker, so bundles and the configurator were choosing out of the same wall. |
| 2026-08-25 | 7 | **The swap itself came out exact.** Clay 6 → 5 (sale) → 6 (return), Slate 6 → 5 (sale, "Replacement sent for return …"), order still `paid $170.00`, `refunded $0.00`. One in each direction and not a cent either way, which is the whole of what an even exchange means. My own bug on the way: `ProductVariant` has `title`, not `name`, so the first attempt 500'd — caught by clicking the button, not by the typechecker. |
| 2026-08-25 | 7 | **Jo Kim's refund settled, and the order never heard about it.** $42.00 given back on the return; the order still read **Paid $147.00**, nothing refunded, the line unmarked, and a live **Refund $147.00** button underneath. Two clicks from $189.00 going out on a $147.00 sale. `orderRefundsService.recordRefund` is the one write path that keeps amountPaid, paymentStatus, refundTotal and each line's quantityRefunded in step — and `issueRefund` called none of it. [222], fixed: the refund is apportioned across the lines that came back and recorded against the order. Anneliese's Tee, taken through after the fix, reads **Part paid · Paid so far $128.00 · Given back $42.00 · 1 refunded**. O-000005 keeps the pre-fix state as the before-picture. |
| 2026-08-25 | 7 | **And writing the cheque number down had made an order un-refundable.** Devi noted "Cheque 4471, banked Aug 25" in a box labelled "Anything to note (optional)", placeholdered "Cheque number, who took it…". It was written to `processorRef` — _the gateway's reference for this charge_ — so the refund path concluded a gateway charge existed and tried to reverse it at a gateway this shop has never had. Jo Kim's identical refund had gone through a minute earlier; the only difference was that Devi left that box blank on hers. [223], fixed: the note goes to `metadata.note`, the PROCESSOR decides whether there is a charge to reverse, and the Money in row finally shows what she typed. It is also half of a uniqueness constraint, so two cheques noted the same way collided. |
| 2026-08-25 | 7 | **What the screen said while all that was happening: "That didn't save. Check what you entered and try again."** The server had sent _"No payment gateway is configured to settle this refund. Refund the customer manually or issue account credit"_ — a cause and two remedies — in the same response. The shared error helper drops every `VALIDATION_ERROR` message, because Zod's is the useless fixed string; one code, two senders, and silencing it silenced the sentence a service had deliberately written for a person. [224], fixed by the discriminator that was always there: the schema layer attaches per-field `details` and a service never does. Confirmed by typing 5 into "Accept back" on a return of one — **"You can accept back at most 1, because that is what the customer asked to send."** That message also used to name a uuid. |
| 2026-08-25 | 7 | **Sell › Returns opened on twenty rows for sales that do not exist.** No order, "Unknown customer", an item called "Item", dated before her shop existed — and each one offering **Approve**, which buys a prepaid carrier label. The sample-data cleaner's comment says orders "cascade … returns"; `ReturnRequest.orderId` is a bare uuid with **no foreign key**, so four sample reloads left four sets of five behind, intact and pointing at nothing. [225], fixed: the cleaner deletes them explicitly, and a return whose `orderNumber` is null now reads **"The sale is gone · Nothing to do"** with no actions at all. "Unknown customer" was a guess dressed as a fact — the customer is not unknown, there is nobody to know. |
| 2026-08-25 | 7 | **Money edge (standing check), computed by hand first.** $170.00 order, $42.00 line returned → $128.00 paid, $42.00 back, `partially_paid`, one unit restocked. Matched to the cent. The restock is idempotency-keyed on the inspection, so choosing **Back on sale** and THEN refunding moved stock exactly once — 5 → 6, one `return` movement, not two. |
| 2026-08-25 | 7 | **Wrong move (standing check).** Typed 5 into "Accept back" on a return where one item was asked back. Refused, in her words, with the number she can actually use. |
| 2026-08-25 | 7 | **Neighbour check (RULE #7), both halves.** Deep-linked Threadline's return and Halo & Hem's order into Devi's console: **no leak** — api-rest answers 404 for both, and for an id belonging to nobody. RLS holds with real neighbours in the database. But the pane shows "Just a moment…" and never stops, on all three, while an order of Devi's own that had never been opened resolved from the address bar instantly. A refusal that looks exactly like a slow load. [226], **open** — it reproduces on every detail pane for any unresolvable id, the cause is in the dock or the query layer rather than in the surfaces this act was testing, and the cause is honestly **not isolated** rather than guessed at. |
| 2026-08-25 | 7 | **And the fixes were re-checked against an earlier shape.** Devi's own O-000001 — collection, deposit, made-to-order — still reads "the earliest day it can be **collected**", no Delivery row, "$66.00 due on collection", Paid so far $30.00 / Still owed $66.00, and its new **Coming back** section correctly says nothing has gone out yet and points at Cancel instead. Nothing act 7 changed disturbed the deposit or collection maths. |
| 2026-08-25 | 7 | **Both new panes seen at 360px in dark before scoring (RULE #6).** The order pane collapses to the mobile stack and reads cleanly — Part paid · On the way · $170.00, the returned line marked "1 refunded", Paid so far and Given back both present; the start-a-return form stacks to one column, checkbox and price on one row and three full-width fields under it; `scrollWidth === innerWidth` at 356px throughout, so nothing overflows the page. The return pane's decision table scrolls inside its own container, correctly. **One find:** its Item column read `T…` — one letter — because the cell carried `max-w-0` and `truncate` together, and the name it fell back to was a SKU while the card four inches above said "The Everyday Tee". [227], fixed: it wraps with a floor, and the query coalesces to the order line's frozen name so the two agree. |
| 2026-08-26 | 8 | **Her mailing list, dropped in as a spreadsheet.** 25 contacts, eleven columns. The importer answered in a green tick: **"This is a Squarespace contacts export — we can tell because it has the Email column."** She has never used Squarespace. Four adapters require `Email` and nothing else, all four scored an identical 0.6, and the tie went to whichever was listed first; the winner then supplied the column map and **dropped seven of her eleven columns in silence** while the screen said "25 of 25 ready". [228], fixed: a one-column gate that no hint corroborates now falls below the certainty line the file already documented, a tie between platforms is not an answer, and the surface asks instead of asserting. 4 fields before, **11 after**. |
| 2026-08-26 | 8 | **The mapper then asked a clothes shop to confirm `province` and `accepts_marketing`.** The labels existed on the schema and the options rendered them; silica’s Select paints its CLOSED trigger from `items`, which was not passed, so it printed the raw field key. Only call site in the console missing it. [229], fixed: reads "State / region", "Email opt-in", "Address line 1". |
| 2026-08-26 | 8 | **Then the addresses went nowhere.** `address1`/`city`/`province`/`country`/`zip` are listed in the importer’s `RESERVED_COLUMNS` — claimed by the mapping so they are not swept into custom properties — and the mapping never wrote them. Reserved, and dropped. [230], fixed: written as the customer’s default address, country resolved from what a person would type, and a partial address notes itself rather than failing the contact. **25 addresses on file.** |
| 2026-08-26 | 8 | **The practice run promised to check every row against what she already had, and did not.** 25 new, 0 updated — with Anneliese Vogt, a customer since yesterday, on the list. `customers` used the shared legacy wrapper whose preview calls every row a create. [231], fixed: a real preview, one query for the file. Now **24 new, 1 already here**. |
| 2026-08-26 | 8 | **She ran it for real and ten of twenty-five were refused.** Every one tagged `market stall`, `gift guide` or `made to order` — tags with a SPACE. The rule was a slug pattern, which describes a slug, and nobody writing a tag writes a slug. The practice run had reported zero problems, and the reason recorded against each row was a raw Zod JSON dump. [233], fixed on all three counts: a tag may contain a space (a comma still may not, and the message says why), the preview runs the write’s own validation from a helper that lives beside the schema so it cannot drift, and a refusal is a sentence. Re-run: **9 imported, 16 updated, 0 errors** — the practice run and the import now agree. |
| 2026-08-26 | 8 | **Import complete and whole.** 29 customers, **21 with a phone, 25 with tags, 25 with an address**. Anneliese matched on email rather than duplicating. Priya Anand came in as a second record because the Priya already on file has no email at all — a genuine duplicate for the Possible duplicates surface to earn its keep on. |
| 2026-08-26 | 8 | **Then the customer list itself.** **Jo Kim paid $147 and her record said $0.00. Anneliese’s said minus $42.** Tessa, who has paid nothing, read $101.95. Ravi, who has paid a $30 deposit, read $96. Four figures, four different kinds of wrong, one of them a negative lifetime spend. [232]: the columns were kept by an event consumer applying `{ increment }`, a consumer failure is swallowed into a one-line log, and the increment ran at PLACEMENT on the face value while the decrement ran on money received — one column, two definitions. Fixed by deriving all four from the orders inside the same transaction that writes the order, the payment, the refund or the cancellation. Five DB-backed tests, one per failure shape. **The already-drifted rows need migration 20270418000000, which is authored and awaiting the data stage.** |
| 2026-08-25 | 8 | **Then the segment, and every group she had was empty.** Eight built-in groups, all "No members yet" — on a business with twenty-nine customers, four of whom have ordered. She built "Bought in the last 90 days"; the builder counted **2 of 29 match** as she typed, she pressed Create, and the panel underneath said **Members: 0**, under its own promise that membership is "refreshed after you save changes to the rules". Two numbers on one screen disagreeing by the width of the pane. [234], fixed: the consumer that fills a new segment was correct and had never once run, because the CRM→platform bridge carried a hand-kept allowlist naming `crm.segment.*` as the long tail nothing consumes locally. **Seven live topics were being dropped**, five of them scoring's, so deal scoring had never run either. The allowlist is gone — the bridge asks the bus whether anything subscribes, so subscribing is what makes an event forwarded. |
| 2026-08-25 | 8 | **The test for that was written so it could not catch it.** `segment-fills-itself.test.ts` already existed and passed. It called `recomputeFull` by hand and said why: "the subscription itself is one line, the arithmetic underneath it is what can be wrong." The one line was the wrong thing. It now goes through the bus exactly as pressing Create does, and a CI-visible unit test asserts the property rather than the topic list — a topic forwards BECAUSE something subscribes to it, including one case that subscribes mid-test and watches forwarding begin. Both shown to go red against the old bridge before being trusted green. |
| 2026-08-25 | 8 | **A second cause underneath it.** Her twenty-five imported contacts had joined nothing either, and fixing the bridge alone would not have helped: `crm.customer.created` is published and nothing subscribed to it, so a person joined a group only once something later edited them — and a freshly imported contact is never edited. [235], fixed in both evaluators, kept identical on purpose. |
| 2026-08-25 | 8 | **The built-in "New Customers" did the opposite of what it says.** Description: "Created in the last 30 days, regardless of order activity." Rule: `daysSinceLastOrder <= 30`, which depends on nothing else and excludes everyone who has never bought. Of twenty-nine people added that week it found two. The rule could not say what the description said — a date field takes absolute values, so "in the last 30 days" freezes on the day it is written. [236], fixed by adding `customer.daysSinceCreated` (the counterpart `daysSinceLastOrder` already is for orders), offered in the builder as "Days since they were added"; existing tenants repaired by migration `20270419000000`, scoped to rows still holding the exact seeded rule. |
| 2026-08-25 | 8 | **And nobody could have seen that, because the column that would show it was broken.** Nine groups, and every Rules cell read "From activity". `ruleCount` looked for `conditions`/`rules`/`all`/`any`; the stored tree's key is `children`, so it returned 0 for every segment ever written and every row fell through to the same fallback. Worse than a blank, because the phrase reads like a statement about the group rather than a value that could not be computed. [237], fixed: the column says what the rule is, in the builder's own words — "Relationship is Wholesale", not "is b2b" — nine rows, nine different sentences. `segment-rules.ts` was 568 lines and this touched it, so it was split by responsibility into five files, all under the cap. |
| 2026-08-25 | 8 | **Confirmed on her screen.** "Bought in the last 90 days" now fills itself on save: the bar reads **2 of 29 match** and the panel reads **Members: 2**, with Tessa Wren and Ravi Naidoo named. The two numbers agree, which is the actual repair. It is 2 rather than 4 because Anneliese and Jo Kim still have a null `last_order_at` — [232] reaching this surface through the same rollup columns, and it will read 4 once migration `20270418000000` lands. |
| 2026-08-25 | 8 | **The mailing list imported without being a mailing list.** After both fixes, "Newsletter Subscribers" still matched nobody: 29 customers, 26 contactable, **0 with marketing consent**. The importer read her mapped opt-in column for one thing, `do_not_contact` — which says nobody has objected, not that anyone agreed — and left `gdpr_consent` at `{}`. The schema has carried `source: 'import'` as a valid value since it was written and nothing ever wrote it. [238], fixed: an explicit yes now writes the consent record too, with no invented `grantedAt`, and consent is only ever added on a re-import, never revoked. Three tests, red without it. **Her own twenty-nine still need the file importing again — no migration can give them consent, because inferring it from a contactable flag would be inventing it.** |
| 2026-08-25 | 8 | **Not confirmed on screen (honest gap).** That re-import is the one step of act 8 not driven through the UI: the Chrome window kept dropping to the background, which silently discards clicks, and the run never started. The behaviour is proven by test and the mechanism was read out of the database directly. |
| 2026-08-25 | 8 | **The migrations landed and the rollups agree with the orders.** `20270418000000` and `20270419000000` were applied by the user. Anneliese Vogt −$42.00 → **$128.00**, Jo Kim $0.00 → **$105.00**, Ravi Naidoo $96.00 → **$30.00**, Tessa Wren $101.95 → **$0.00** across 2 orders — exactly the four corrections predicted read-only. "New Customers" now stores `customer.daysSinceCreated ≤ 30` under a description that matches it. |
| 2026-08-25 | 8 | **But the answers the groups store are still the old ones**, because membership is materialised and none of those repairs touched a person or a rule the evaluator was watching. Computed by hand against the repaired data: "Bought in the last 90 days" should hold **4**, "New Customers" **29**. Both still read 2. |
| 2026-08-25 | 8 | **And the remedy was only reachable one group at a time.** **Update membership** lives on a group's own screen; the LIST — the one place "these are all out of date" is visible — had nothing to press, so nine groups meant nine panes. Every real cause of staleness is tenant-wide (built-ins are seeded together; a stalled bridge stalls all of them; a data repair changes what every rule sees), so a per-group remedy is the wrong shape for the problem. [239], fixed: `POST /v1/crm/segments/recompute` (the tenant-wide call the nightly CronJob already made) plus an **Update all** button in the toolbar, reporting what moved rather than going silent. |
| 2026-08-25 | 8 | **The thing that had to be true first, and was never tested.** A whole-tenant re-cut walks every group, and a hand-picked list has no rules to re-derive membership from — evaluating one would match nobody and remove everybody. One clause in the evaluator prevents it (`kind: 'dynamic'`) and nothing asserted it, so if it had ever slipped the nightly job would have emptied every hand-picked list on the platform and nothing would have errored. Now guarded, and proven red first: with the clause removed the test fails `expected +0 to be 3`. |
| 2026-08-25 | 8 | **Confirmed on her screen — the groups now hold the right people.** Pressed **Update all** on the Groups list: "Bought in the last 90 days" went 2 to **4** and "New Customers" 2 to **29**, the two numbers written down in advance. The detail pane reads **4 of 29 match** over **Members: 4**, naming Jo Kim, Anneliese Vogt, Tessa Wren and Ravi Naidoo, with Jo Kim and Anneliese the two [232]'s rollup repair let in. Bar and panel agree. [239] and [236] both confirmed; act 8's "correct and explicable" is met. At 360px the new toolbar has no horizontal overflow and both buttons sit on one wrapped row. |
| 2026-08-25 | 8 | **[238] confirmed on her screen.** Re-ran the import as Devi: the mapper read 11 of 11 columns with **"Accepts Marketing" to "Email opt-in"**, and "Customers 25 of 25 brought over". In her records: **22 with marketing consent**, all `source: 'import'`, **0** with an invented `grantedAt`, **3** do-not-contact, matching the file's 22 yes / 3 no exactly, with no duplicates. |
| 2026-08-25 | 8 | **And the mailing-list group was still empty.** 22 people had just said yes and "Newsletter Subscribers" read "No members yet". Pressing **Update all** filled it with exactly those 22, which proved the rule, the projection and the consent were all already right and nobody had re-cut the group. [240], fixed: `customerService` publishes `crm.customer.*` on an IN-PROCESS bus whose consumers are registered by **api-rest**, and imports run in **import-worker**, a different process. Nothing carries those topics across (the Pub/Sub bridge is outbound; event-worker has no customer consumer; `platform-crm-worker` handles `tenant.*`/`module.*`). The import now reconciles once per job, not per row, only for entities that can move membership, and never throwing over rows already written. Three tests, red first. |
| 2026-08-25 | 8 | **[240] confirmed end-to-end, with nothing pressed.** Imported one new contact, Nadia Okonjo, `Accepts Marketing: yes`, through the same screen: "1 of 1 brought over". Without touching **Update all** or anything else, **Newsletter Subscribers 22 to 23** and **New Customers 29 to 30**, and she is in both, carrying `{"scope": ["marketing"], "source": "import"}` with no invented `grantedAt`. The import now fills the groups by itself. |
| 2026-08-26 | 9 | **The sale took every condition and enforced none of them.** SPRING15: 15% off, minimum spend $100, one per customer, ends 30 September. A shopper put ONE t-shirt in the basket, $42.00, typed the code, and it was accepted. `discount.conditions` is stored, edited and read back in the console and **nothing in the repo reads it** — `redeemCode` checks the date window and the usage limits, then takes the percentage off the whole cart. Minimum spend, minimum items and first-order-only are all offered on the screen and none of the three does anything. [241], fixed: a real evaluator, refusing in a sentence the shopper can act on. |
| 2026-08-26 | 9 | **And two of the four conditions could not be written down at all.** `product_in` and `collection_in` have been in the schema since the module shipped and no screen ever offered them, so "15% off the core range" was unexpressible. Added as a **What it applies to** section listing her groups with their sizes. `discount-detail.tsx` was 917 lines and this touched it, so under RULE #0.5 it split into eight files, all under the cap. |
| 2026-08-26 | 9 | **Worse than not enforcing it: the code was accepted and the money never moved.** The basket showed a `SPRING15 ×` chip and still said $42.00. Checkout said "Place order — $51.00 to pay". Order **O-000006** landed with `discount_total 0.00`, `total 51.00` — full price — while `discount_usages.applied_cents` recorded **630**. So her books say she gave away $6.30 she never gave, and the shopper's one-per-customer allowance was spent on a discount they did not receive. [242], fixed: `recomputeTotals` existed and summed the rows correctly; `redeemCode` simply never called it. |
| 2026-08-26 | 9 | **The same omission facing the other way.** Removing the code deleted the join row, the chip vanished, and `discount_total_cents` stayed at 1890 through a full reload. The route said so in a comment — "recompute happens lazily on the next cart read" — and nothing recomputes on a read; the serializer returns the stored total. An assumption written as a fact, directly above the code it was wrong about, and the market checkout carried the same comment and the same bug. [243], fixed: a real `removeCode` that puts the money back. |
| 2026-08-26 | 9 | **"One per customer" held for nobody.** Rowan Ellery had already used SPRING15, filled in checkout, and was allowed to use it again — the cart's `customer_id` was NULL and had been the whole time. `assertUsageLimit` guards on `if (customerId)`, so a null does not fail, it SKIPS. `submitContact` wrote the email onto the session and resolved the customer only at order placement. [244], fixed: giving an email at checkout now links a shopper the shop already knows. It recognises, it does not create — minting a `customer` lifecycle row for every abandoned checkout would be a worse bug than the one being fixed. |
| 2026-08-26 | 9 | **All four behaviours confirmed on her own shop.** 1 tee $42 → "This code needs a basket of at least $100.00. Add $58.00 more to use it." · 3 tees $126 → **Discount −$18.90, total $107.10** · add the Linen Shirtdress, $271 → discount **still** −$18.90, the dress at full price (15% of $271 would be $40.65) · dress alone → "This code does not apply to anything in your basket." · as Rowan again → "You've already used this discount the maximum number of times" · end date moved back, badge turns **Ended** → "Discount \"SPRING15\" has expired". End date restored afterwards, so her sale is live. |
| 2026-08-25 | 8 | **Owed, not done.** The dev stack is down, so [239]'s button is typechecked, linted and test-backed but not yet pressed as Devi, and [238]'s re-import is still not driven through the UI. The two counts "Update all" should produce are written down in advance — **4** and **29** — so the confirmation is a real check rather than a rubber stamp. |

## Standing checks

The run-wide list is in [CLAUDE.md](CLAUDE.md). These are Devi's instances of
it, and they are worked into the acts rather than saved for the end.

**Wrong moves.** Import the 25-customer CSV a second time. Refund the same Tee
line twice. Delete the Clay colorway with an open order against it. Apply
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

| Standing check               | Result                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wrong moves                  | not checked                                                                                                                                                                    |
| Reload · deep link · restore | Partly. Reloaded onboarding after the failure: the name came back from the tenant, the trade and the ticks did not — which is the reverse of what was saved (see [163]).       |
| Dates                        | not checked                                                                                                                                                                    |
| Money edge                   | not checked                                                                                                                                                                    |
| Buyer's side                 | not checked                                                                                                                                                                    |
| Someone else's business      | not checked                                                                                                                                                                    |
| One job without a mouse      | not checked                                                                                                                                                                    |
| Time to live site            | Not measurable yet — the site is not built. Started 02:53 PDT; act 3 opened 04:47 PDT. That elapsed figure measures the repairs, not the product, so it is not offered as one. |

## Panes rated

Every pane opened during this run gets a Design and an Ease score in
[rating.md](rating.md), with its gap to 10 (CLAUDE.md RULE #6). Score it as you
leave it, not from memory at the end.

Seen in dark AND at 360px before scoring; the product tabs were also seen in
light. Everything else this run opened stays unrated rather than assumed fine.

| Pane                      | Design | Ease  | Gap to 10                                                                                                                                                                                                         |
| ------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sell › Add a product      | 8      | 4 → 8 | The price box held a `0.00` nobody typed ([169]). Now blank and required. Remaining: the generated code stem ([172])                                                                                              |
| Sell › Product › Options  | 8      | 4 → 8 | Enter did nothing, the add button did not focus what it made, a blank card opened red ([168]) — all three fixed. Remaining: no shop-wide size list ([170])                                                        |
| Sell › Product › Variants | 9      | 8     | One press prices every missing combination, behind a dialog that says exactly what it will do. Holds at 360px. Codes take the wrong stem ([172])                                                                  |
| Sell › Kinds of product   | 7      | 7     | Every built-in wears the NAME of its icon ([167]) — fixed at source, waiting on the pipeline                                                                                                                      |
| Sell › Selling settings   | 8      | 7     | The right things, well said. Nothing here about how a product is SOLD, which is where she looked first ([170])                                                                                                    |
| Stock › Stock             | 8      | 3 → 7 | Said the thing that matters, then sent her to a panel that is real but is a PANE, not a product tab ([173]). Now offers the two actions. Fix not re-proved — her shop has stock, so the bare state is unreachable |
| Stock › Locations         | 8      | 5     | Reads well. Two locations she never created, one of them in Ohio ([174])                                                                                                                                          |
| Stock › Set up your stock | 9      | 8     | Five steps, any order, honest counters, and it says what each step is FOR. "Not measured yet" instead of a fake number                                                                                            |
| Stock › New count         | 8      | 5 → 8 | "Everything kept at this location" promised a full list and gave an empty one ([173]). Both it and the toast now describe what is actually there                                                                  |
| Stock › Count             | 9      | 6 → 9 | Scan-or-type, a real quantity field, a two-stage finish, and a confirm that names the number and the place. The two add-cards now say which reaches what ([173])                                                  |
| Stock › Stock counts      | 8      | 4 → 9 | 372 garments arrived and the money column read $0.00 ([175]). Now "No cost yet", "—" for discarded, and the 360px line wraps instead of eating its own numbers                                                    |

## Issues found

Filed, fixed and re-proved from the screen during the run (CLAUDE.md RULE #3).
A row with no confirmation is not a fixed defect.

| #                                                                                                | Severity | What (in her words)                                                                                      | Fixed | Confirmed by                                                                                                    |
| ------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| [160](issues/160-on-her-phone-the-menu-is-off-the-edge-of-the-screen.md)                         | major    | On her phone, the menu is off the edge of the screen                                                     | yes   | Four pages at 360px, no sideways scroll, ☰ at 269–317                                                          |
| [161](issues/161-the-phone-menu-opens-behind-the-bar-that-opened-it.md)                          | major    | The phone menu opens behind the bar that opened it                                                       | yes   | Reopened it — all five items whole, bar behind the panel                                                        |
| [162](issues/162-one-button-drags-the-home-page-sideways-on-a-phone.md)                          | minor    | One button drags the home page sideways on a phone                                                       | yes   | Fixed; not re-measured on screen — no browser attached                                                          |
| [163](issues/163-setting-up-failed-and-the-form-answered-for-her.md)                             | major    | Setting up failed, and then the form answered for her                                                    | yes   | Resubmitted with furnishing still failing — all three answers stayed                                            |
| [166](issues/166-clearing-the-decks-took-fifteen-separate-deletions.md)                          | minor    | Clearing the decks took fifteen separate deletions                                                       | no    | Blocked on scope — a selection model for every list, not just this one                                          |
| [167](issues/167-every-kind-of-product-has-a-stray-word-in-front-of-its-name.md)                 | minor    | Every kind of product has a stray word in front of its name                                              | part  | Source + migration written; the rows change when the pipeline runs                                              |
| [168](issues/168-typing-five-sizes-took-ten-trips-to-the-mouse.md)                               | minor    | Typing five sizes took ten trips to the mouse                                                            | yes   | XS S M L XL and Clay Slate Bone typed straight through, no mouse                                                |
| [169](issues/169-her-128-dollar-overshirt-came-out-at-128000.md)                                 | major    | Her $128 overshirt came out at $128,000                                                                  | yes   | Sunday Trouser added at $110.00, click-and-type, first try                                                      |
| [170](issues/170-every-product-has-to-be-told-what-a-size-is-all-over-again.md)                  | minor    | Every product has to be told what a size is, all over again                                              | no    | Blocked on decision — a shop-wide option list, or a per-trade default                                           |
| [171](issues/171-light-and-dark-wore-the-same-icon.md)                                           | design   | Light and Dark wore the same icon                                                                        | yes   | Menu reopened in both themes — screen, sun, moon, three distinct glyphs                                         |
| [172](issues/172-fourteen-of-her-fifteen-codes-were-not-the-one-she-typed.md)                    | minor    | Fourteen of her fifteen codes were not the one she typed                                                 | no    | Blocked on decision — which stem, and whether a printed code may change                                         |
| [173](issues/173-she-was-sent-to-the-product-for-a-panel-that-is-not-on-it.md)                   | major    | She was sent to the product for a panel that is not on it                                                | yes   | Two counts started as Devi — each toast now matches the list under it                                           |
| [174](issues/174-a-warehouse-in-ohio-she-never-opened.md)                                        | major    | A warehouse in Ohio she never opened                                                                     | no    | Blocked on decision — what an industry pack may create, and audit it                                            |
| [175](issues/175-372-garments-arrived-and-the-count-was-worth-nothing.md)                        | major    | 372 garments arrived and the count says it was worth $0.00                                               | yes   | Her own row now reads "No cost yet"; discarded ones read "—"                                                    |
| [176](issues/176-two-scarves-got-the-same-code-and-one-lost-its-price.md)                        | blocker  | Two scarves got the same code, and one lost the price she typed                                          | yes   | Distinct codes; a code she types that is taken blocks the save by name                                          |
| [177](issues/177-the-sentence-telling-her-what-went-wrong-is-the-smallest-on-the-form.md)        | design   | The sentence telling her what went wrong is the smallest text                                            | no    | Blocked on decision — the 12px is hardcoded inside silicaui                                                     |
| [178](issues/178-her-shops-clock-is-set-to-a-timezone-nobody-chose.md)                           | major    | Her shop's clock is set to a timezone nobody chose                                                       | yes   | Set Denver once on the business; the place followed, still NULL in the row                                      |
| [188](issues/188-she-wrote-the-fabric-the-fit-and-the-care-and-moving-one-tab-erased-it.md)      | major    | She wrote the fabric, the fit and the care, and one tab erased it                                        | yes   | Added a line, left the tab, came back — still there, dot on Details, guard fired                                |
| [189](issues/189-every-photo-she-uploaded-showed-as-a-broken-picture.md)                         | major    | Every photo she uploaded showed as a broken picture                                                      | yes   | Clay, Slate and Bone all render on the Media tab, each under its colorway name                                  |
| [190](issues/190-nobody-could-choose-a-size-or-a-color.md)                                       | blocker  | Nobody could choose a size or a color                                                                    | yes   | Fifteen radios in her own order; a submit with none picked is refused                                           |
| [191](issues/191-six-paragraphs-came-out-as-one-block-of-text.md)                                | major    | Six paragraphs came out as one block of text                                                             | yes   | Her six paragraphs, spaced, in the order she typed them                                                         |
| [192](issues/192-an-empty-grey-box-sat-above-add-to-cart-on-every-product.md)                    | major    | An empty grey box sat above Add to cart on every product                                                 | yes   | Gone from the Overshirt; the Marlow Knit still carries the real panel                                           |
| [193](issues/193-every-detail-she-wrote-printed-its-own-name-twice.md)                           | minor    | Every detail she wrote printed its own name twice                                                        | yes   | Five sections, each once, under its own heading, materials on two rows                                          |
| [194](issues/194-the-basket-called-two-different-garments-by-the-same-name.md)                   | major    | The basket called two different garments by the same name                                                | yes   | The basket reads "XS · Oat" and "S · Moss"                                                                      |
| [195](issues/195-the-cross-sell-was-bigger-than-the-thing-it-was-selling.md)                     | design   | The cross-sell was bigger than the thing it was selling                                                  | yes   | One card, centred, at card size; 66 blueprints migrated and versions bumped                                     |
| [196](issues/196-letters-vanished-as-i-typed-and-it-was-my-keyboard-not-the-console.md)          | none     | Letters vanished as I typed, and it was my keyboard                                                      | n/a   | Withdrawn: the automation types faster than any person; clean at human speed                                    |
| [197](issues/197-every-photo-on-her-website-was-announced-as-product-image.md)                   | major    | Every photo on her website was announced as "Product image"                                              | yes   | Her own sentence is the alt on the live page; every tenant's images follow                                      |
| [198](issues/198-the-size-box-said-any-size-any-size.md)                                         | minor    | The size box said "Any size Any size"                                                                    | yes   | "Size: Any size" and "Color: Clay", once each; "Any size" still first in the list                               |
| [199](issues/199-she-searched-for-collections-and-was-told-nothing-matches.md)                   | minor    | She searched for "collections" and was told nothing matches                                              | yes   | "collections", "price lists" and "fitment" all reach their screens                                              |
| [200](issues/200-she-cleared-her-shop-and-the-groups-still-claimed-21-products.md)               | major    | She cleared her shop and the groups still claimed 21 products                                            | yes   | Every group reads 0, matching her website; chips name live products                                             |
| [201](issues/201-the-groups-screen-called-them-collections-thirty-times.md)                      | copy     | The Groups screen called them collections, thirty times                                                  | yes   | "group" throughout, delete button included; four neutrals and two oversized files fixed with it                 |
| [202](issues/202-a-group-could-not-be-saved-unless-she-filled-in-everything-optional.md)         | blocker  | A group could not be saved unless she filled in everything optional                                      | yes   | "New in" saved with two products; the database agrees                                                           |
| [203](issues/203-her-shop-page-said-she-had-nothing-to-sell.md)                                  | blocker  | Her shop page said she had nothing to sell                                                               | yes   | Shop lists 3 with photographs, New in lists 2; Thistle & Rye lists 9                                            |
| [204](issues/204-running-low-would-not-say-how-low.md)                                           | minor    | "Running low" would not say how low                                                                      | yes   | The row now names the reorder point and where it is set                                                         |
| [205](issues/205-her-nine-dollar-delivery-came-out-at-nine-thousand.md)                          | major    | Her $9 delivery came out at nine thousand                                                                | yes   | Typed straight over a `0.00` and got 150.00; option saved at $9 free over $150                                  |
| [206](issues/206-checkout-said-shipping-was-free-before-it-knew-where-to-send-it.md)             | major    | Checkout said shipping was free before it knew where to send it                                          | yes   | "Once we know where" / "Total so far"; $128 → $9.00, $192 → Free                                                |
| [207](issues/207-she-could-retire-four-products-or-delete-them-but-not-sell-them.md)             | major    | She could retire four products or delete them, but not sell them                                         | yes   | Seven chosen, asked about 4, toast "4 products put on sale"; shop went 3 → 7                                    |
| [208](issues/208-the-console-told-her-the-shop-was-blank-while-it-was-selling.md)                | minor    | The console told her the shop was blank while it was selling                                             | yes   | Reads "Searching your shop won't find these", in info, over a shop that sells                                   |
| [209](issues/209-her-shop-quietly-dropped-three-garments-and-said-four.md)                       | blocker  | Her shop quietly dropped three garments and said "4 products"                                            | yes   | Shop lists 7, New in lists 2, Thistle & Rye still lists 9                                                       |
| [210](issues/210-her-clothing-shop-was-branded-as-a-catering-company.md)                         | major    | Her clothing shop was branded as a catering company                                                      | yes   | Nine tenants resolve to their own names; her tagline is "Made here, in small runs."                             |
| [211](issues/211-the-block-that-sells-products-could-only-ever-sell-everything.md)               | major    | The block that sells products could only ever sell everything                                            | yes   | "What this shows" lists her three groups by name; New in (2) selected on screen                                 |
| [212](issues/212-her-homepage-was-live-and-the-editor-said-it-did-not-exist.md)                  | blocker  | Her homepage was live, and the editor said it did not exist                                              | yes   | Every section editable; she rewrote it and published "Made in small runs."                                      |
| [213](issues/213-featured-showed-everything-she-had-never-featured.md)                           | major    | "Featured" showed everything, and she had featured nothing                                               | yes   | The band is gone on a 24-product shop; Thistle & Rye's authored home undisturbed                                |
| [214](issues/214-a-sold-out-size-was-selectable-and-only-the-button-said-no.md)                  | major    | A sold-out size was selectable, and only the button said no                                              | yes   | XS · Bone struck through and inert; the other fourteen still pick and buy                                       |
| [215](issues/215-it-told-a-mail-order-customer-to-come-and-collect.md)                           | major    | It told a mail-order customer to come and collect                                                        | yes   | "We'll be in touch about paying for it"; the console reads "can be sent"                                        |
| [216](issues/216-the-follow-up-list-would-not-say-who-to-follow-up.md)                           | major    | The follow-up list would not say who to follow up                                                        | yes   | Four "Guest shopper" rows became Priya Menon and two more, her email a link                                     |
| [217](issues/217-free-delivery-showed-as-no-delivery-at-all.md)                                  | minor    | Free delivery showed as no delivery at all                                                               | yes   | O-000004 reads Delivery · Free, O-000005 still $9.00, the collection order still none                           |
| [218](issues/218-the-legal-links-fell-out-of-the-bottom-of-the-footer.md)                        | design   | The legal links fell out of the bottom of the footer                                                     | yes   | Seeded tree and a test — **not** a rendered page; a stored frame keeps the old placement                        |
| [219](issues/219-there-was-no-way-to-start-a-return.md)                                          | blocker  | There was no way to start a return                                                                       | yes   | An exchange and two refunds opened from the order pane and settled end to end                                   |
| [220](issues/220-an-even-exchange-could-only-be-ended-by-refunding-it.md)                        | major    | An even exchange could only be ended by refunding it                                                     | yes   | "Swapped · $0.00 moved"; Clay 5→6, Slate 6→5, not a cent either way                                             |
| [221](issues/221-five-identical-rows-and-no-way-to-tell-which-was-the-m.md)                      | major    | Five identical rows, and no way to tell which was the M                                                  | yes   | The picker reads `M · Slate` and the button says "Send M · Slate"                                               |
| [222](issues/222-she-gave-42-back-and-the-order-offered-to-give-it-all-back-again.md)            | blocker  | She gave $42.00 back, and the order offered to give it all back again                                    | yes   | O-000004 now: Part paid, Paid so far $128.00, Given back $42.00, the line marked "1 refunded"                   |
| [223](issues/223-writing-the-cheque-number-down-made-the-order-unrefundable.md)                  | blocker  | Writing the cheque number down made the order un-refundable                                              | yes   | The same order refunded $42.00 where it had refused twice; the note now shows in Money in                       |
| [224](issues/224-the-server-explained-the-problem-and-the-screen-said-check-what-you-entered.md) | major    | The server explained the problem, and the screen said "check what you entered"                           | yes   | "You can accept back at most 1, because that is what the customer asked to send"                                |
| [225](issues/225-twenty-returns-for-sales-that-do-not-exist.md)                                  | major    | Twenty returns for sales that do not exist                                                               | yes   | Twenty rows read "The sale is gone · Nothing to do"; the pane offers no actions                                 |
| [226](issues/226-a-link-to-somebody-elses-record-spins-for-ever.md)                              | minor    | A link to somebody else's record spins for ever                                                          | no    | **Open** — no leak (api-rest 404s cleanly), but the pane never says so. Cause not isolated; `Blocked on: scope` |
| [227](issues/227-the-column-naming-the-goods-was-the-one-squeezed-to-nothing.md)                 | design   | The column naming the goods was the one squeezed to nothing                                              | yes   | At 360px it reads "The Everyday Tee" over three lines; the table still scrolls inside itself                    |
| [228](issues/228-it-told-her-the-file-was-from-a-platform-she-has-never-used.md)                 | high     | It told her the file was from a platform she has never used, and threw away seven of her eleven columns  | yes   | Asks instead of asserting; the mapper matched 11 of 11 and all 11 came across                                   |
| [229](issues/229-it-asked-a-clothes-shop-to-confirm-province-and-accepts-marketing.md)           | medium   | It asked a clothes shop to confirm `province` and `accepts_marketing`                                    | yes   | Reads "State / region", "Postcode", "Email opt-in"                                                              |
| [230](issues/230-the-mapper-offered-a-home-for-her-addresses-and-nothing-wrote-them.md)          | high     | The mapper offered a home for her addresses and nothing wrote them                                       | yes   | 25 contacts imported, 25 addresses on file                                                                      |
| [231](issues/231-the-practice-run-checked-nothing-against-what-she-already-had.md)               | medium   | The practice run checked nothing against what she already had                                            | yes   | 24 new / 1 already here, then 9 / 16 after the first import                                                     |
| [232](issues/232-jo-kim-paid-147-dollars-and-her-record-said-zero.md)                            | blocker  | Jo Kim paid $147 and her record said $0.00, and Anneliese’s said minus $42                               | code  | Derived in the write path; 5 tests. Row repair is migration 20270418000000, awaiting the data stage             |
| [233](issues/233-ten-contacts-refused-because-market-stall-has-a-space-in-it.md)                 | high     | Ten contacts refused because "market stall" has a space in it, and the practice run had said it was fine | yes   | 9 imported / 16 updated / 0 errors; practice run and import agree                                               |
| [234](issues/234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md)  | blocker  | Every group of customers was empty, because a bridge had been told nobody wanted these events            | yes   | Segment fills on save: 2 of 29 match, Members 2, Tessa and Ravi named. Seven live topics were being dropped     |
| [235](issues/235-she-imported-twenty-five-people-and-they-joined-nothing.md)                     | high     | She imported twenty-five people and they joined nothing                                                  | yes   | `crm.customer.created` now watched in both evaluators; test red without it                                      |
| [236](issues/236-new-customers-meant-people-who-had-bought-recently.md)                          | medium   | "New Customers" meant people who had bought recently, under a description promising the opposite         | code  | `customer.daysSinceCreated` added; existing tenants repaired by migration 20270419000000                        |
| [237](issues/237-nine-groups-and-the-same-three-words-beside-every-one.md)                       | medium   | Nine groups, and the same three words beside every one                                                   | yes   | Nine rows, nine different sentences; `ruleCount` read four key names belonging to no schema                     |
| [238](issues/238-she-imported-a-mailing-list-and-got-contacts-instead.md)                        | high     | She imported a mailing list and got contacts instead                                                     | code  | Consent written from the mapped opt-in column, 3 tests. **Her own 29 still need the file importing again**      |
| [239](issues/239-eight-groups-were-out-of-date-and-the-only-fix-was-one-at-a-time.md)            | medium   | Eight groups were out of date and the only way to fix them was one at a time                             | code  | Tenant-wide recompute route + **Update all** on the list; hand-picked lists now guarded against it              |
| [240](issues/240-she-imported-her-mailing-list-and-the-mailing-list-group-stayed-empty.md)       | high     | She imported her mailing list, and the mailing-list group stayed empty                                   | code  | The evaluator lives in api-rest; imports run in import-worker. Reconcile once per job, 3 tests                  |
| [241](issues/241-the-conditions-on-a-sale-were-stored-and-never-read.md)                         | blocker  | The conditions on a sale were stored, shown back, and never read                                         | yes   | A real evaluator + the missing "What it applies to" screen; 11 unit tests                                       |
| [242](issues/242-the-saving-was-recorded-and-never-taken-off-the-bill.md)                        | blocker  | The saving was recorded, shown as accepted, and never taken off the bill                                 | yes   | O-000006 paid $51.00 in full while a $6.30 saving was booked against it                                         |
| [243](issues/243-taking-the-code-back-off-left-the-saving-on.md)                                 | high     | Taking the code back off left the saving on                                                              | yes   | "Recompute happens lazily on the next cart read" — nothing recomputes on a read                                 |
| [244](issues/244-she-gave-her-email-and-the-basket-stayed-anonymous.md)                          | high     | A shopper gave her email at checkout and the basket stayed anonymous                                     | yes   | `if (customerId)` skips silently, so one-per-customer held for nobody                                           |
