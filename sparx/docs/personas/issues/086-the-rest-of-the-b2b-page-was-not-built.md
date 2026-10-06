# 086 — The rest of the /b2b page described a product that was not built

**Status:** open
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 5 (the /b2b promises left after 085)
**Surface:** sparx.works /b2b; site › product page, cart, account › Wholesale account (quotes, orders, fleet, service); workbench › Invoicing › quote editor; workbench › Wholesale › account; workbench › Sell › product trade pricing; workbench › Scheduling › booking; workbench › search box
**Filed:** 2026-10-02
**Fixed:** —
**Confirmed by:** —
**Blocked on:** —

## What happened

After 085, Doty checked the rest of the /b2b page against the product, one
sentence at a time. A read-only audit of the code backed each check. Of eleven
promises, three were kept, four were kept in part and four were not built at all.

**Not built:**

1. **"Accounts keep named saved carts and reorder a past order in a click."**
   No saved cart existed anywhere, and no order page had an "Order again".
2. **"Set minimum and maximum order quantities, case packs, and minimum order
   values per product per account."** Minimum and maximum quantities existed in
   the database, could not be set from any screen or API, and were checked only
   for fleet holds, never in the cart or at checkout. No case pack existed. The
   pricing group's minimum order value could be typed in, was never checked, and
   the console told Doty a group price applied "only on orders over $X".
3. **"Accounts with a registered fleet see a 'fits your fleet' badge and
   fitment-matched products first."** The site never read the fleet. Doty could
   not even add a vehicle: the account page showed the fleet read-only.
4. **"A fleet account books service from the same portal ... Service history
   records against the vehicle."** The portal had no booking, a site booking never
   recorded the account or the vehicle, and no screen showed a vehicle's history.

**Kept in part:**

5. **"From the catalog, the buyer builds a request (quantities, delivery needs,
   notes)."** Only from the portal's Quotes page, by searching for products inside
   it. No product page offered it. There was no place for delivery needs or a PO
   number on the request.
6. **"Margin shows as you price, off the cost basis. Markup rules help."** Margin
   showed only on lines priced by markup. On a flat or labor line, the cost Doty
   typed was thrown away, under help text reading "It is how you see your margin."
   A catalog line at a trade price lost its cost too. No total margin for the
   quote. Markup rules could be used but not made: no screen created one.
7. **"Contacts carry roles ... so AP can see invoices without being able to place
   orders."** A view-only contact could still order on account. Only quotes
   checked the role.
8. **"The lifecycle is tracked: submitted, under review, quoted ... converted."**
   Nothing ever sets "Under review", and there is no "Converted" stage (a converted
   quote stays Accepted and links to its order, on purpose).

**Kept, with a wrong detail:**

9. **A/R aging.** "Owed to you" works (5 invoices, $8,497.64, all not yet due). The
   page promised "current, 1–30, 31–60, and 60+ days"; the screen has five groups
   up to 90+. And typing the page's own words, "aging", into the search box found
   only an inventory report.
10. **Terms.** The page says Net 15, 30, 45 or 60; the product offers those and
    more (7, 14, 90, any number of days, pay before dispatch). True as written.
11. **PO number.** It rides from checkout to invoice and statement, but only on
    account: a trade buyer paying by card could not give one.

**Found on the way:**

12. **The search box said "3 orders are not in this box yet".** O-000008 and
    O-000009 were made from quotes before 085's fix and were never sent to search.
    O-000013 was held, then rejected: a held order publishes
    `b2b.order.pending_approval` instead of `order.placed`, a rejected one
    `b2b.order.rejected` instead of `order.cancelled`, and the search worker
    listened for neither. A held order could not be found by its number while it
    waited for sign-off, and a rejected one never could.

**Found on screen while confirming (2026-10-02 evening):**

13. **"Aging" passed its search test by luck.** Typing "aging" put Inventory's
    Reports above Owed to you on screen while the phrase test said Owed to you came
    first: the test read the catalog file by file, the box lists screens in
    registration order, and equal ranks keep their order. 14 other phrases also
    tied and passed only by that order.
14. **The fleet form said "Choose a engine"**, and showed made-up "Unit 12", "2019",
    "Ford", "F-350" as hints, so right after adding Unit 12 the empty form looked as
    if it still held Unit 12.
15. **Every product's cost read "0.00".** All 777 of Gillett's versions have no cost
    on file, and the Pricing tab printed each as a measured $0.00 ("Was" too). A
    real $0 cost could not be recorded at all.
16. **"Add to quote request" was not on the live product page.** The helper put it
    in the React page, which only serves the sample-data preview; the live page is
    the published template. The same trap had hidden the fleet notice. Found with
    it: a template form that arrives after the first load was never wired up, so
    the browser did its own bare submit to `?accountId=...`.
17. **A customer who signs up on the website could not be found in the console.**
    Marcus Oyelaran-Pike's record existed, but "Add someone" on the account said
    "Nobody you already know is called that" and the search box offered no heal for
    ten minutes.
18. **The quote line's quantity box clipped "100" to "10("**, and an empty "Cost to
    you" showed a grey "0.00" under help text reading "From the product" for a
    product with no cost.
19. **After adding a contact, the picker still offered the same person.**
20. **The cores-owed list never showed a business name** (`customer.company` is
    shadowed by a computed field; found by `check:shadowed`).
21. **A sent quote request arrived at the list price.** Q-000012's lines were stored
    at $4.32 and $400.00, so Doty's screen read "Total $2,832.00" for an account
    that pays $3.80 and $352.00 ($2,492.00). Issue 077 fixed this for quotes typed
    in the console; the request path never got it.
22. **One failed read left a quote on "Loading…" for good.** While the API
    restarted, Q-000012's read failed once (503); the pane never retried and never
    showed its error, and the whole console sat on "Reconnecting" for minutes after
    the API answered again.
23. **A blip in the API signed Renée out.** Her session was intact, but while the API
    restarted the site sent her to the sign-in page; a reload a minute later showed
    her pages again. The site's proxy answered the failure as a bare 500.
24. **"Order again" and "Save this cart" said "Please try again"** on those same
    failures, with nothing about why.
25. **Next.js warned that the site's `<html>` scrolls smoothly** without telling Next,
    so changing page glided instead of starting at the top.
26. **Setting up service bookings, every made-up hint was from a salon.** The new
    service form showed "Full color & cut" and "Stylist"; the new person or thing
    form "Alex Rivera", "Treatment room 1" and "color, senior, treatment". In a
    diesel shop's empty form they read as somebody else's records.
27. **Every day switched on in Availability started at 9:00 AM to 5:00 PM**, right
    under a Monday set to 7:30 to 5:30, and no screen copied one bay's or one
    technician's week to another: Gillett would type the same week for 16 bays and
    every technician.
28. **A bay shows the person icon** on its own page, the same as a technician.
29. **The booking's "Move it" box read 8:00 AM for a 9:00 AM booking.** The header
    said "Sat, Oct 3, 2026, 9:00 AM" (Mountain); the box beside it used the
    computer's own time zone (Pacific). An owner away from the shop would move a
    booking to the wrong hour without being told.
30. **The booking's parts list printed the part number twice**: "Cummins Fuel
    Injection Crossover Tube O-Ring (4062328) (4062328)".
31. **A text message the shop never turned on was recorded as "failed".** Texting is
    off for Gillett; the booking still queued an SMS confirmation and marked it
    failed when the sender answered "Text messaging is not switched on for this
    business yet."
32. **The portal's booking button said "Book 9:00 AM"** without the day.
33. **"Add someone" offered people already on the account.** Searching "Wasatch" on
    Wasatch Front's account listed Renée and Marcus as if they were new. Picking
    Renée and pressing Add then failed with "Could not add that person. This
    customer is already an active contact on this account."
34. **The search box filed quotes under "Invoices", and opened the wrong screen.**
    "Wasatch" listed Q-000013, Q-000012, Q-000011, Q-000006 and Q-000002 under the
    heading Invoices, mixed with INV-000007 and the rest. Opening a quote landed on
    the Wholesale invoices list, not on the quote. A quote and an invoice are one
    kind of record underneath, and search indexed them as one kind.
35. **Two screens disagree about an account's price tier.** The Wholesale account
    screen shows Wasatch Front on "Fleet · 12% off"; the CRM account screen shows an
    empty free-text "Price tier". The CRM screen, the wholesale reports (accounts by
    tier, top accounts), the search line under an account, customer groups and the
    export all read an old text column that no Gillett account has filled in.
36. **Typing "sign-off" did not find wholesale Approvals.** The task Doty gets reads
    "waiting for your sign-off: approve or reject it under Approvals". The search
    box found Inventory's Sign-offs only, because the box read "sign-off" and the
    screen's own "sign off" as different words.
37. **Search showed Renée the list price; the product page showed hers.** "CP4" in
    the shop's search listed the S&S Gen2.1 kit at $400.00; its page one click
    later read $352.00 (Fleet, 12% off). Every product list (search, collections,
    categories, the builder's product grids) asked only for a signed agreement
    (contract) price, which a tier-priced business does not have.

## What should have happened

Each sentence on the page is a contract. Every one of them either works for Doty
and Renée on screen, or the sentence changes the same day.

## How to reproduce

1. As Doty: on a quote, add a flat line with a cost of $40 and a price of $55,
   save, reopen. The cost is empty and no margin shows.
2. Open Wasatch Front's account. There is no way to add a vehicle.
3. As Renée on the site: open any product. There is no way to add it to a quote
   request. Open an old order. There is no "Order again".
4. Add a contact to Wasatch Front with "Can view only", sign in as them, and check
   out on account. The order is placed.
5. In the workbench search box, type "aging". "Owed to you" is not offered.

Every time.

## Why it matters

Gillett onboards on what this page says. A distributor who sets a case pack and
watches a buyer order 5 of a case of 12, or an AP clerk who places an order her
role was meant to stop, finds out the product was not what it said. The margin
help text told Doty something false about his own money.

## Where it lives

See the audit list above; file paths are in **The fix**.

## The fix

**Search (12), done:** `wizeworks/packages/commerce-indexer/src/index.ts` listens for
`b2b.order.pending_approval` and `b2b.order.rejected`, and `src/handler.ts` routes
both to the order projection. Test: `test/unit/held-order-events.test.ts` (4 tests;
all 4 failed before the change). The three orders already missing come back with
the search box's "Put them back".

**Search words (9), done:** "Owed to you" answers "aging", "ar aging" and
"accounts receivable" in both consoles (`lib/surfaces/catalog/finance.ts`).
`components/launcher-owner-phrases.test.ts` has the three phrases; all 3 failed
before.

**Page copy (8, 9), done:** `sparx/apps/web/components/marketing/b2b-page.tsx` and
`b2b-sections.tsx` name the stages a quote really goes through ("submitted, quoted,
accepted, and the order it became") and the five aging groups; the aging picture in
`b2b-devices.tsx` shows the five groups the screen shows (and lost an inline style).

**Database:** migration `20270530000007_saved_carts_and_case_packs` adds
`b2b_saved_carts` and `b2b_saved_cart_items` (FORCE RLS) and
`b2b_account_product_overrides.order_multiple` (the case pack).

**Database (quote requests):** migration `20270530000008_open_quote_requests` adds
`b2b_quote_requests` and `b2b_quote_request_lines` (FORCE RLS, one open request
per account by a partial unique index). A request being built is not a draft
quote: a quote fires `crm.billing_document.created`, takes a Q- number and lists
for staff, and an unsent request must do none of those.

**Quote requests, reorder, saved carts (1, 5):**

- "Add to quote request" on the product page; the portal Quotes page builds the
  account's one open request (lines, needed by, deliver to, delivery notes, PO
  number, notes), saves it for later, throws it away behind a confirm, or sends
  it. Sending makes the quote at Submitted, as before. Service
  `crm/src/services/b2b-quote-request-service.ts`; routes
  `api-rest/src/routes/v1/public/b2b-portal-buying.ts`.
- The PO number rides on the quote's `metadata.poNumber`; delivery needs on
  `metadata.delivery`, copied onto the order the quote becomes (all three paths go
  through `convertToOrder`), shown under "Their PO number" on the staff order page
  (both consoles, `surfaces/commerce/order-delivery-needs.ts`) and printed on the
  packing slip (`inventory/src/services/packing-slip.ts`; a quote-made order with
  no shipping address printed a blank "Deliver to").
- "Order again" on the portal and the site's own order pages, at today's prices,
  through `cartService.addItem`, saying what was added and what was skipped and why
  (`commerce/src/services/cart-refill-service.ts`).
- Named saved carts for the account: save, rename, delete behind a confirm naming
  it, add to cart at today's prices (`commerce/src/services/saved-cart-service.ts`).
- A read-only connected app (`b2b:read`) can no longer write through the portal:
  `api-rest/src/lib/portal-writer.ts` guards quote submit, accept and decline and
  every new write. Nothing legitimate called them that way (site-mcp calls three
  GETs only).

**Quantity rules, roles, PO by card (2, 7, 11):**

- Minimum, maximum and case pack per product version per account, set in the
  console's product trade pricing ("Sold in cases of", "Least at once", "Most at
  once", "Keep their usual price"); a second row for the same business and version
  is refused (the price lookup picked one of two at random).
- Refused, never rounded, in cart add and change, at checkout start, at payment and
  at completion, naming the product and the nearest amounts that work. The site's
  quantity box starts at the minimum and steps by the case. Fleet holds refuse in
  the same words. Rules in `commerce-schemas/src/quantity-rules.ts` and
  `commerce/src/services/account-buying-rules.ts`.
- The pricing group's minimum order value is checked at checkout and shown in the
  cart ("Add $112.40 more ..."); the console sentence now says what is true.
- Viewers and approvers cannot order: refused server-side, and the site says who
  can ("Ask Renée to place orders.").
- A PO number given with a card payment rides on the card order. (Not for gateways
  that send the buyer away to pay: that flow has no step that finishes the order.)

**Fleet (3):**

- Vehicles have stable ids, year, make, model, the fitment entry, VIN and notes.
  Staff add, change and remove them on the account (both consoles,
  `surfaces/b2b/account-fleet.tsx`); the primary contact can on the portal's new
  Fleet page.
- The site's listings, search and builder product grids show "Fits your fleet" or
  "Does not fit your fleet", fitted parts first on the default sort; the live
  product page says which vehicles it fits or warns. A product with no fitment data
  shows neither. The fleet is read from the signed-in session, never the browser.
- Found on the way: the live product page is always the silica template, so a
  notice added to the React page would never have been seen; and the older builder
  feed (`/products/full`) showed a signed-in trade buyer the list price. Both fixed;
  a test pins that a buyer's own price never enters the shared page cache.

**Service (4):**

- The portal books service for one of the account's vehicles (service, real open
  time, note), stored with the account and the vehicle's id, through the same
  `createBooking` as the site, so the confirmation email goes out; reminders follow
  the service's booking policy, as on the site.
- Each vehicle's history shows on the portal and in the console. Staff link parts
  from the account's orders to a visit in the booking pane; the server refuses lines
  not on the account's orders.
- Found on the way: clearing a booking's vehicle never cleared it, and the booking
  history would have printed "Changed companyId".

**Margin (6):**

- Every line keeps its cost (flat, labor, catalog at any price); a picked part
  brings its cost; an edit that sends no cost keeps the one there. Margin shows on
  every line with a cost and in the Summary (cost, profit, margin, and how many
  lines have no cost). A missing cost is never $0.
- A Markup rules screen (list, create, edit, delete, preview and apply), linked from
  the line editor. The product Pricing tab described every rule as "Works the price
  out from what you last paid" and offered quote-only rules; both fixed.
- A quote's line costs follow it onto the order's invoice, which is now itemized
  from the quote when the quote's lines add up to the order to the cent.
- Tests prove no cost or margin reaches a buyer: the print page, the frozen copy,
  the emails, the signing page, and a parser scan of every public route.

**Found later (33, 34):**

- **33:** the picker still lists someone already on the account, with "Already on
  this account (can place orders)" under their name, and the row cannot be picked.
  Hiding them instead would read as "nobody is called that" and offer to add them
  as a new customer, a duplicate. Someone switched off stays pickable, because
  adding them again turns them back on. Both consoles: `PickerRow.unavailable` in
  `components/search-picker.tsx`, the `unavailable` map on `CustomerPicker`, and
  `alreadyOnAccount()` in `surfaces/b2b/accounts-data.ts`. Test
  `already-on-account.test.ts`: dropping the active-only filter or the reason on the
  row reddens 2 of 4.
- **34:** a wholesale quote is now indexed as a `quote`. The route table already
  sent `quote` to the quote's own screen under "Quotes", and the CRM bridge already
  published `crm.quote.*` as `quote`, but no projector answered, so every one of
  those events was skipped. One reader in `commerce/src/universal-projection.ts`
  serves both kinds and each answers only for its own rows, with the real screen
  as the address (`/wholesale/quotes/:id`, `/wholesale/invoices/:id` for an invoice
  on account, `/invoicing/invoices/:id` for any other; the old
  `/invoicing/documents/:id` matched no screen). A quote is in the `b2b` module and
  every invoice stays in `invoicing`; each projector writes its kind and module out
  literally so `check:search-entities` can check them. The indexer re-reads a billing row under both kinds on every
  event (`commerce-indexer/src/same-row.ts`), so the kind it is gets indexed and
  the kind it is not loses its stale entry; a rebuild that keeps old entries clears
  them too. `deleteEntity` now treats "not found" as already deleted: without that,
  clearing an entry that never existed would fail every invoice event and retry it
  forever. Tests: `quote-search-home.test.ts` (2 of 5 red on the old reader),
  `quote-and-invoice-share-a-row.test.ts` (2 of 2 red without the shared row),
  `rebuild-clears-the-old-kind.test.ts` (1 of 2 red without the clear), and
  `delete-entity-absent.test.ts` (1 of 2 red without the 404 rule). **After the
  release, run the ops task `reindex-search`** so each tenant's quotes leave
  "Invoices"; until then a quote moves the first time anything happens to it.
- **35:** a company had two tier columns and half the platform read the wrong one.
  `pricing_tier_id` prices every order; `pricing_tier` is free text from before the
  tiers table, and nothing prices from it. The CRM account screen, the B2B summary
  and top accounts, the search box, segment rules, the account export, the importer
  and the sample data all read or wrote the text, so Wasatch Front (on Fleet) showed
  no tier anywhere but the Wholesale screen. Now `companyService` reads and writes
  only the tier id and hands out the linked tier's name as `pricingTier`, so the
  REST API, GraphQL, MCP and the export all carry the real name; the summary groups
  by tier id and counts accounts on normal prices as their own group; the search
  line and segment rules read the tier's name; the Wholesale screen no longer falls
  back to the text. The CRM "Price tier" box (sparx) and "Wholesale price" box
  (Piggles) are now the Wholesale screen's own select, built by one
  `tierChoiceItems`. The sample account goes on the business's Wholesale tier, or a
  marked sample one that Clear removes. Migration
  `20270530000011_price_tier_text_becomes_the_tier` links each company's text to the
  live tier of that name (1 row locally) and invents none; the column stays until a
  later release drops it. Tests: `company-price-tier.test.ts` (5 of 6 red on the old
  service, 1 of 6 on the old segment reader), `b2b-tier-breakdown.test.ts`,
  `account-search-tier.test.ts` (2 of 2 red), `account-tier-name.test.ts`,
  `tier-choices.test.ts` in both consoles, and `b2b_accounts.test.ts`. **After the
  release, run `reindex-search`** so every account's search line names its tier.
  A removed tier went on pricing: the remove dialog promises "Accounts on this tier
  go back to your normal prices", but `resolve_b2b_price` never read `deleted_at`,
  so an account on a removed tier kept its discount (Wasatch Front's $3,200.00 part
  stayed $2,816.00 with Fleet removed, measured in a rolled-back transaction). Migration
  `20270530000012_a_removed_tier_prices_nothing` makes the function skip a removed
  tier (verbatim otherwise; $3,200.00 after). Every reader goes through one rule,
  `companyService.tierInEffect` / `removedTier`: reports count those accounts as
  normal prices, search, segments, the API name and the price sentence drop the
  tier, and the account screens say "Spring trial (removed, so normal prices)" in
  the header and the select, both consoles. An account still linked to a removed
  tier can be saved again (the tier check now runs only when the tier changes),
  and a tier can be added without a note (the schema refused the null the pane
  sends). Tests: breaking the shared rule reddens 3 of 9 (`company-price-tier`),
  1 of 4 (`account-tier-name`), 3 of 5 (search and price sentence) and 1 of 4
  (`b2b-tier-breakdown`); the save check 1 of 4; the console wording 2 of 6 in each
  console; `tier-note.test.ts` 2 of 2.
- **36:** the launcher reads a dash or an underscore as a space on both sides of the
  comparison (`plain()` in `components/launcher-match.ts`, both consoles), for
  screens and for records, so "sign-off" meets "sign off" and "O-000012" still
  meets itself. Test in `launcher-match.test.ts`: without `plain()`, 2 of 13 red.
- **37:** every product list now prices a signed-in trade buyer by the product
  page's own rule, `pricingService.resolve` for one unit on this site
  (`resolveViewerUnitPrices` in api-rest `routes/v1/public/commerce.ts`, over
  `viewerUnitPrices` and `cardYourPrice` in `lib/viewer-variant-prices.ts`). The
  contract-only shortcut is gone. Anonymous and retail visitors never reach it, so
  their pages stay cacheable. Test `viewer-variant-prices.test.ts`: dropping the
  kept price reddens 1 of 5.

Every new test was run red first; each helper's red proof is in its report.

## Confirmed by

In progress, on screen, 2026-10-02 evening, as Doty, Renée and Marcus:

- **Fleet:** Doty added Unit 12 (2019 RAM 3500 6.7L Cummins, "Plow mount. Runs the
  Bountiful–Farmington water route.") and Unit 7 (2017 Ford F-350 Super Duty 6.7L
  Powerstroke) to Wasatch Front. Renée's catalog put "Fits your fleet" on the
  Power Stroke and Cummins parts, first of 653; the S&S CP4 kit's page read "Fits
  Unit 7, 2017 Ford F-350 Super Duty 6.7L Powerstroke." The O-ring 4062328 has no
  fitment data and showed neither badge nor warning, as it should.
- **Quantity rules:** Doty set Wasatch's O-ring to "Sold in cases of 10 · at least
  20 at a time · no more than 200 at a time" with "Keep their usual price". Renée's
  page read "Sold in cases of 10. Minimum 20. Up to 200 per order.", the box started
  at 20, and 25 was blocked. Sent to the server directly: 25, 5, 300 refused with
  the rule's sentence ("...in cases of 10. Choose 20 or 30."), 20 accepted, 5 more
  refused ("You already have 20 in your cart, so that would make 25.").
- **Roles:** Marcus signed up and Doty added him as "Can view only". His product
  page read "Your account lets you see invoices and orders. Ask Renée to place
  orders." with no Add to cart; sent to the server directly, the cart refused with
  the same sentence. His portal shows "Viewer", the credit, 3 unpaid invoices, the
  statement, fleet and service, and no ordering actions.
- **Quote request:** Renée added 100 O-rings and 6 S&S kits from their product
  pages ("Added. Your request has 2 items and has not been sent yet."), added
  Needed by Oct 20, 2026, the delivery address, "Forklift on site. Deliver before
  10am, Mon–Fri." and PO WFUC-24-0931, and sent it: "Your request Q-000012 was sent
  to Gillett Diesel Service."
- **Margin:** Doty's Q-000011 for Wasatch (100 O-rings at the Fleet $3.80, cost
  $1.10) read "71.1% margin, $270.00 profit" on the line and "Cost to you $110.00 ·
  Profit $270.00 · 71.1%" in the summary; the buyer's preview showed neither. A
  markup rule "Seals & O-rings: cost plus 250%" was made on the new screen, which
  previewed "$100.00 sells for $350.00, a 71.4% margin."
- **Search:** "Put them back" restored the three missing orders; "aging" offers Owed
  to you.
- **[042]:** no silicaui warning in 85 console messages across the site and console
  on silicaui 0.58.2.

- **Delivery needs reached Doty:** Q-000012 in the console reads "Their PO number
  WFUC-24-0931 · Needed by Oct 20, 2026 · Deliver to Wasatch Front yard, 2275 S 900
  W, Salt Lake City, UT 84119. Gate 3. · Delivery notes Forklift on site. Deliver
  before 10am, Mon–Fri."
- **Order again:** O-000011 (4 O-rings) under the new case pack: "Nothing was added
  to your cart. Not added: ...buys ... in cases of 10. You already have 20 in your
  cart, so that would make 24. Choose 20 or 30."

- **Scheduling set up (Act 8 early, at Brandon's request):** two services, "Diesel
  oil change" (60 min, start every 30, 15 min after, $149.95, 2 hours' notice) and
  "Diesel truck service" (180 min, 30 min after, $289.00, a day's notice), each
  needing a light-duty bay and a diesel technician at once, each asking the customer
  which vehicle. People and equipment: Kirk Halvorsen, Tomás Begay (diesel, light
  duty), Bay 1 and Bay 2 (light duty). Bay 1's week saved: Mon–Fri 7:30–5:30, Sat
  8:00–12:00.

- **Saved carts:** Renée saved her cart as "Monthly seal kit, Unit 12" ("Your cart
  is unchanged."); Saved carts lists "1 item, 20 in all · Saved by Renée Castañeda ·
  Saved Oct 2, 2026"; Add to cart answered "It is in your cart, at today's prices
  for your account."
- **Request pricing (21):** a new request for 50 O-rings, PO WFUC-24-0944, arrived as
  Q-000013 at $3.80 with "Fleet price: 12% off $4.32" ($190.00 on Doty's list);
  Renée's copy reads "Not priced yet" with no figures.

- **Copying hours (27):** on Availability, Bay 1's week went to Kirk Halvorsen, Tomás
  Begay and Bay 2 with "Use these hours for…" → All people (2), All rooms and spaces
  (1) → "Copy to 3 others" → a confirm naming all three and that their hours are
  replaced → "Bay 1 (light duty)'s hours copied to 3 others". Each now holds the
  same six days.
- **Service booking from the portal:** Renée picked Unit 12, the Diesel oil change
  (1 hr, $149.95), Saturday Oct 3; the open times were 8:00 to 10:30 (the last one
  that ends with its 15 minutes before noon); she booked 9:00 AM with "At 15,200
  miles, due for its oil change. We run Rotella T6 in this one." The page read
  "Service booked ... A confirmation email is on its way" and her service history
  shows it. The booking took Bay 1 (light duty) and Kirk Halvorsen together, is
  filed under Wasatch Front and Unit 12, and its confirmation email was sent (the
  text message was not: 31). Doty's booking page shows the vehicle, her note and the
  account's orders to link parts from.

- **29–32 after their fix:** the booking's Move it box reads 10/03/2026 09:00 AM under
  "In Mountain time, where the booking happens. This computer is set to Pacific
  time, so this is not the time on your screen's clock."; the parts list reads
  "Cummins Fuel Injection Crossover Tube O-Ring (4062328)" once; the old text row
  now reads `not_set_up` (migration 20270530000010); the portal's button reads
  "Book Sat, Oct 3 at 10:00 AM MDT". Bay 1's heading and tab show a room icon, and
  after a reload both Bay 1 and the never-opened Bay 2 tabs draw the room icon
  while Kirk's and Tomás's draw a person.

- **Who can order (33), 2026-10-02 night:** on Wasatch Front's account, "Wasatch" in
  Add someone lists Marcus and Renée with "Already on this account (can view only)"
  and "(can place orders)" under them, and clicking either does nothing. Doty
  typed "Teodora Vukić-Hale", pressed "Add Teodora Vukić-Hale as a customer", and
  the new-customer page opened with her name and Wasatch Front filled in; saved
  with Fleet manager, teodora.vukic-hale@wasatchutility.test and +1 (801) 555-0163,
  she was already on the account, and Doty set her to "Can approve orders". Doty
  removed Marcus ("Removed", with Restore), found him again in Add someone with no
  note under his name, added him back as "Can view only": "Marcus Oyelaran-Pike
  added", and the box was empty again with its role back at "Can place orders".
- **Search (34):** after `ops:reindex-search` for Gillett, "Wasatch" lists Quotes
  (Q-000013, Q-000012, Q-000011, Q-000006, Q-000002) and Invoices (INV-000007,
  INV-000003, INV-000001) under their own headings, 10 records with none twice.
  Q-000012 opens on "Quote Q-000012" with its PO, needed-by date and delivery notes.

- **Sign-off (36):** "sign-off" in the search box now lists Inventory's Sign-offs
  and Spending limits, then Wholesale › Approvals, then Social › Approvals.

- **Held-order search, 2026-10-03:** Renée added 3 S&S Gen2.1 kits ($352.00 each,
  "Your price") to her 40 O-rings, cart $1,208.00, checked out on account with PO
  WFU-PO-24-0917: "Your order O-000014 is waiting for us to approve it." In the
  workbench, Wholesale › Approvals listed "O-000014 · Wasatch Front Utility
  Contractors, LLC · $1,208.00 · Over your $1,000.00 spending limit." Typing
  "O-000014" in the search box listed the task "Order O-000014 from Renée Castañeda
  is waiting for…" under Tasks and "#O-000014 · Renée Castañeda · Pending approval"
  under Orders; the order opened on "Order O-000014", badge "Waiting for approval",
  with her PO. (That "waiting for us" sentence, and Teodora never being asked, are
  issue 087.)

## Rating effect

—
