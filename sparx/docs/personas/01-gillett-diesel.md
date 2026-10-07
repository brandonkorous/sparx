# P01 — Doty Brown · Gillett Diesel Service

**Version:** 1.5
**Author:** Brandon Korous
**Last Updated:** 2026-10-06

**Status:** in progress
**Run:** 2026-10-01 —
**Modules:** all 16 (builder, commerce, cms, crm, email, b2b, invoicing, dropship,
inventory, chat, ai, scheduling, social, finance, staff, funnels)

## Account

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| Email          | `p01.doty@gillettdiesel.test`                        |
| Password       | `Sparx-Persona-2026!`                                |
| Tenant id      | `5944fe23-be83-4ce5-aafc-ef56b8594508`               |
| Slug           | `gillettdiesel` (was generated `eager-harvest-4010`) |
| Workbench      | http://localhost:3011                                |
| Published site | http://localhost:3004/?tenant=gillettdiesel          |
| MCP key name   | —                                                    |

Site shopper accounts (Gillett's own site, http://localhost:3004/account/login?tenant=gillettdiesel):

| Who                                                                                           | Email                                      | Password                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| Renée Castañeda, Wasatch Front (buyer)                                                        | `renee.castaneda@wasatchutility.test`      | `Wasatch-Buyer-2026!`    |
| Marcus Oyelaran-Pike, Wasatch Front (accounts payable, view only)                             | `marcus.oyelaran-pike@wasatchutility.test` | `Wasatch-AP-2026!`       |
| Teodora Vukić-Hale, Wasatch Front (fleet manager, "Can approve orders"; +1 (801) 555-0163)    | `teodora.vukic-hale@wasatchutility.test`   | `Wasatch-Approver-2026!` |
| Dana Whitcomb-Nguyen, Salt Lake County Public Works (buyer; signed up on the site 2026-10-06) | `dana.whitcomb-nguyen@slcopw.test`         | `SLCo-Buyer-2026!`       |

Gillett team (workbench, http://localhost:3011):

| Who                                                              | Email                                | Password              |
| ---------------------------------------------------------------- | ------------------------------------ | --------------------- |
| Mike Van Der Berg, service manager (Editor; joined 2026-10-06)   | `mike.vanderberg@gillettdiesel.test` | `Sparx-Persona-2026!` |
| Kendra Ruiz, parts counter (Editor; joined 2026-10-06)           | `kendra.ruiz@gillettdiesel.test`     | `Sparx-Persona-2026!` |
| Alyssa Thompson, accounts receivable (Editor; joined 2026-10-06) | `alyssa.thompson@gillettdiesel.test` | `Sparx-Persona-2026!` |

Each sign-up also made a home workspace of its own ("Mike's workspace" `305ad459-…`,
"Kendra's workspace" `d0ef9750-…`, "Alyssa's workspace" `222e8f26-…`). Every account
has one; their own settings are stored there ([122]), and the toolbar switcher lists
it beside Gillett ([124]). Their verification links were built with the dev secret
(scratchpad `verify-link.mjs <email> <invitation id>`), not read from an email: the
console mailer prints to the event-worker's output.

Dev note: every tenant's site shares `localhost:3004`, so its sign-in cookie is
shared too. Another agent signing in to a different shop on the same browser
signs Renée out. Sign her in again; it is not a product defect (in production
each shop has its own address). Doty's own workbench sign-in on the same host no
longer signs her out: that one was a defect, fixed in [084].

Local docker only. Fill these in as soon as signup gives them. A run nobody can
revisit is a run nobody can confirm.

## Resume here (handoff, 2026-10-01)

Read this first, then the run log.

**Where Doty is:** act 2 done; act 3 (catalog import) next. Act 2 delivered:
Business details, Site identity (tagline "Diesel Done Right Since 1986!", logos,
favicon, socials), all five policies live and reviewed, cookie banner on
(opt-out, analytics, title "Cookies at Gillett Diesel"), theme Workshop in his red
#CE333C and navy #101633, stock locations WH-CP and HQ, and his own words on Home,
About, Contact, Shop and Journal (published; footer shows his tagline). Proved on
the customer side: three made-up buyers sent messages from /contact (Seamus
O'Malley, Lars Høgberg twice before [048], Renée Castañeda); all are in Form
submissions. The invoice preview carries his logo, address, phone and Net 30
words. Also made to prove [033]: discount FLEETSPRING (15%, $250 minimum, live)
and invoice template "Gillett invoice – Net 30" (in use). Hours: his real site
shows none; they belong to act 7. Book (act 7) and Wholesale (act 5) still carry
template words; Check lists them ([046]). Search titles and descriptions: act 9.

**Act 3 done, act 4 under way (2026-10-02):** Act 3's done-when holds on screen:
Products search "L5P" finds the 12 L5P parts (plus one LML part whose old-store web
address says "l5p"), "6.7L Cummins" 47, "6.7L Powerstroke" 23. Built and proved:
[065] bulk "What they fit" and "Category" with "Choose all N that match"; [067] the
add box's example follows the parent; [070] word-by-word search over name, code,
brand, kind and fitment, full product names in the list, "Remove" takes everything
under an entry. His engine list is complete (5 makes, 18 models, 51 engines; the Ford
ones renamed to his spelling "Powerstroke"); 126 parts carry 443 rules: all six 6.6L
Duramax engines, 6.7L Cummins, 6.7L Powerstroke. Still to place: 5.9L Cummins (12- vs
24-valve needs the years), 7.3L/6.0L/6.4L/3.0L Powerstroke, EcoDiesel, LM2/LZ0/LWN.
18 categories from his 18 kinds hold 652 of 653 products (one has no kind; the
template's empty "Goods" is still there). Act 4: opening stock imported from his old
store's inventory export after [068] (empty column, location by name, the odd item,
a five-second limit): Warehouse (Concord Park) 3,524 units in 556 items, Main Office
& Shop 254 in 128, equal to the file. [069] the till and every item picker could not
reach past the 500th item (fixed). silicaui 0.58.1 (#106) and 0.58.2 (#107) released;
#108 fixed the release-notes check for a small release. Act 4 then finished: supplier Alliant Power (three parts
recorded by name after [071]); PO-000001 (6 × AP54800, 10 × AP0128, 2 × AP54851,
$3,608.00) placed, printed on his letterhead, booked in with one pump kit short:
warehouse AP54800 2 → 8, AP0128 13 → 23, AP54851 0 → 1, order "partial"; reorder
levels set in the stock grid after [072]. **Act 4's done-when holds.** Next: act 5
(wholesale), and the engines still to place.

**Act 5 (2026-10-02):** Brandon's answers: email a purchase order to the
supplier, built ([071]: PO-000002 placed and emailed, resent to a second address);
a changed web address keeps the warning only ([070]). Wholesale set up on screen:
"dealer prices" found nothing ([074], fixed); tiers Dealer 20%, Fleet 12%, Contract
15%; all five trade accounts with buyer, billing address, terms and limit (15 days
could be added but never saved again, [076], fixed); Salt Lake County's $19.25 on
FPPF 90343 and its $2,500 sign-off rule; tax certificates for O'Malley (agricultural,
Utah) and Høgberg (resale, Idaho) after [075] built the screen. Also fixed: [073] a
cleared box never cleared (supplier email, address lines), [078] a toast for his own
new customer, [079] "UT, 84119" and United States picked by hand, [080] five "set up
prices and terms" tasks for work already done. The quote for Wasatch Front found
[077] (full price, a product list capped at 100, no PO number, bill-to not filled),
fixed. Renée signed in on the site: Fleet price $528.00 in the catalog and cart;
checkout offered her a choice of Net 15/30/60/90 the invoice ignored ([082], fixed);
web order O-000007 on account with PO WFUC-24-0823 made INV-000001, due Nov 1. Doty's
quote Q-000002 (6 × injector $528.00 + $150.00 deposit, 2 × O-ring $3.80, PO
WFUC-24-0817, $4,075.60) previewed without its deposits and said "Catalog item"
([083], fixed). Renée could not find it, kept being signed out by the workbench's
cookie, saw it as "Draft" with no Accept, and her credit counted it as an unpaid
invoice ([084], fixed). She accepted it; O-000008 came out at the Fleet prices with
the PO number, and INV-000003 reads due Nov 1, 2026 (Net 30) with WFUC-24-0817.
**Act 5's done-when holds.** A second quote, Q-000004 for Høgberg, proved the order
now invoices itself (INV-000005); both migrations applied and confirmed ([084]).
Checking the rest of the /b2b page against the product found five promises it did
not keep ([085], fixed): accepting a quote now places the order (O-000011 from
Q-000006, invoiced and emailed by itself), an order over a spending limit or the
credit limit waits for sign-off (O-000012 approved, O-000013 rejected), every
invoice on terms is emailed with a link to print or save it, the buyer can print
or save any priced quote or issued invoice as a PDF, and accounts have statements
with the PO number on every line. Act 3's leftover engines placed: 5.9L Cummins 12-valve 15 parts and
24-valve 33 (split by year), 7.3L 13, 6.0L 13, 6.4L 7, 2.8L Duramax 1; 206 parts now
fit an engine. No part in his catalog fits the EcoDiesel, LM2, LZ0 or F-150 3.0L, so
those stay empty.

**Act 6 (2026-10-06): done-when holds.** Money in, every balance checked by hand to
the cent. Fleet invoice INV-000015 for Salt Lake County (O-000018 on the site: 2 ×
Bosch injector at the contract $510.00 + $150.00 deposit each, PO SLCO-FM-26-1203,
Net 45, due Nov 20) itemized after [095]; part payment $500.00 by check ("Check
20417, Salt Lake County Auditor"), $820.00 left; INV-000005 (Høgberg, $13.84) paid
in full by bank transfer; two old bills moved in from his previous books as
overdue: 4471 for O'Malley, $1,286.40, due Aug 27 ("Late by 40 days", O'Malley
suspended by the ladder), and 4466 for Høgberg, $412.80, due Sep 16 ("Late by 20
days", credit hold, owner notice). Hand sums: Wasatch $5,976.80 (credit $19,023.20
left of $25,000.00), Salt Lake County $4,535.00, O'Malley $1,286.40, Høgberg
$412.80; Owed to you $11,798.20 before 4466, the statement for Wasatch ends at
$5,976.80 with every PO number. Fixed on the way: [094]-[102]. Two open
questions for Brandon: an invoice cannot print the account's own terms (Doty's
footer says "Net 30" on a Net 45 county bill); and the Try again / 360px items
from act 5. Migrations 0025 and 0026 applied locally, and another session's
0024 with them.

**Act 7 (2026-10-06): done-when holds.** Wasatch Front's company page shows People
here (Marcus, Renée, Teodora), Orders (5, all Renée's), What they owe ($5,976.80 on
4 invoices; quotes show their step and a dash), Deals (Service plan for all 38 RAM
3500s, 2027, $86,400, Proposal sent) and Requests, with Fleet, buyers and statement
one press away. Customers: his Shopify export (30, asset
`assets/gillett/shopify-customers-export.csv`) moved in; 37 customers after two
merges (the second Desmond from the phone match, and Brynn's Lehi and Kanab records
by hand) and Kekoa added. Pipeline "Fleet accounts": First call 10%, Visited their yard 25%, Proposal
sent 50%, Trial order 75%, Won 100%, Lost 0%. Deals: Wasatch $86,400.00 (Proposal
sent, Nov 16), O'Malley $7,250.50 (First call, Jul 15 2027), Salt Lake County
$61,380.00 (Visited their yard, Jan 29 2027), Red Rock $9,840.00 (Trial order, Oct
30), new prospect Uintah Basin Oilfield Services (Kekoa Aldana-Price, Fleet
superintendent, 24 trucks) $54,000.00 (First call, Mar 31 2027), and Høgberg's
dealer program $15,000.00 on Sales, lost ("Lars went with a regional distributor in
Boise…"). Task: "Send Renée the 2027 service plan pricing sheet", Oct 9 10:00 AM,
High, on the Wasatch deal. Request #1 for Dana: "Unit 34 turbo whines after the
Cheetah install", High, assigned to Doty. Fixed on the way: [104]-[116]. Migrations
0027 and 0028 applied locally.

**Act 8 (2026-10-06): done-when holds.** As Mike, Scheduling > Calendar shows Wade
Okonkwo-Larsen's "Pre-purchase inspection, used diesel truck", Wed Oct 7, 3:00 to
4:30 PM Mountain, with Kirk Halvorsen in Bay 1 (light duty), Confirmed, "Call +1
(801) 555-0177". Wade booked it on the public site. Services: Diesel oil change,
Diesel truck service, Turbocharger rebuild and balance, Pre-purchase inspection,
Diesel diagnostic, Chassis dyno run, Injector replacement set of 6; the turbo
rebuild and the injector set are "Quoted after we look". People and equipment: Kirk
Halvorsen, Tomás Begay, Bay 1, Bay 2, Chassis dyno, Turbo balancer; the two new
ones carry Bay 1's hours (Mon-Fri 7:30 AM-5:30 PM, Sat 8 AM-12 PM). Place: "Main
Office & Shop (Heritage Crest)", 14812 Heritagecrest Way, Bluffdale, UT 84065,
following the business zone (America/Denver). Team: Mike invited as Editor, joined.
Fixed on the way: [117]-[123]. Migration 0029 applied locally.

The invitation flow, reproduced with Kendra and fixed ([124]): accepting now opens
Gillett directly (proved with Alyssa); the sign-in and sign-up cards name Gillett;
sparx has a business switcher; the setup of an invitee's own empty workspace has
"Go to Gillett Diesel Service Inc.". Kendra and Alyssa are invited and joined as
Editors (act 11's team, one act early). After a dev restart Alyssa signed out and
in and opened in Gillett.
Kept by Brandon (2026-10-06): an invitee verifies their address after signing up,
although the invitation reached that mailbox, because a link can be forwarded. The booking page still carries template words
(act 9).

**Act 9 (2026-10-06, in progress):** The truck finder works on every shop page and a
year no longer hides parts that fit every year ([125]); product pages say what the part
fits ([126], "What it fits" on his Each product template). Shipping: region "United
States", UPS Ground $15.00, free from $250.00, 5 days, under "All products" ([127],
[128]); "Customers can also collect" on, and checkout offers both ([129]). Card payments
are not set up, so the cart, the drawer and checkout now say so before anything is typed
([131]). Built a Locations page (Main Office & Shop, Mon-Fri 7:30 AM-5:30 PM, Sat 8 AM-12
PM, (801) 571-7780; Warehouse, shipping, cores and returns, (800) 638-4679), linked in the
menu, the phone menu and the footer, published. Pages are in search now ([130]; Locations
was findable a moment after its first save). Site checks: every one of his eight pages has
a search title and summary, set from the page check itself ([133]); the length is measured
as served ([134]); scores About 90, Book 86, Wholesale 86, Contact 84, Shop 84, Home 81,
Locations 80, Journal 76. Fixed on the way: [132] (two Insert rows with one key).
Then: three real articles in the Journal (Fleece Cheetah vs Stock Turbo, Fleet Downtime
Reduction, and Doty's own "The Unseen Impact: Why Diesel Fuel Quality Matters", with
Doty Brown added as an author and the expired May 2025 promo code left out), each with
a fitting picture of his. Book and Wholesale rewritten in his words with his own shop
and warehouse photos, described. "Ask for an appointment" on Home is now "Book an
appointment" to /book. The 404 page is in his look. Before promising reminders on Book:
no booking had ever got one ([135], fixed; all seven services on "Standard"). Utah sales
tax 7.25% on and collecting; a counter pickup was untaxed ([137], fixed) and the [131] fix
had shut out trade buyers on account ([136], fixed). Renée's O-000020 (pickup, PO
WFUC-24-0906): $1,007.60 + $73.05 tax = $1,380.65, waiting for Teodora's sign-off.
[138] one British spelling. Act 9's done-when still needs the test-card purchase and its
email (blocked: Stripe test onboarding is Brandon's). Migrations 0030 and 0031 applied
locally; no new ones since.

**Act 3 status (2026-10-01 evening):** [057] proved on screen end to end:
all 84 faked core choices converted (one part each, a real deposit, send-first on);
the live product page offers both ways once [060] (the console never said his live
pages were behind) was fixed and published; the same Shopify file re-imported as a
practice run leaves all 84 alone. Orders came through the new counter sale ([061]):
O-000001 deposit way (core came back, $150.00 refunded), O-000002 old part first
(handover refused until the old part arrived, then collected), O-000003 "don't wait".
Also fixed: [062] toasts hidden in the corner and zoom, [063] undo still "unsaved",
the "ships" wording on pickup orders, "Paid, deposit back". [045] and [052]
confirmed. [064] fixed and proved on the broker (every link now `https://gillettdiesel.sparx.zone/…`,
pickup receipts say pickup, the marketplace and sales-channel links too). Seen, not
traced: during a dev restart a failed counter sale showed its banner plus two
identical "That didn't save" toasts from other background writes. Next: act 3's
leftovers (fitment by engine) and act 4.

**Act 3 status (later the same day):** his Shopify file imported three times: 653
products, 777 versions, 0 errors, every photo copied ([052]-[056] filed and fixed;
[049], [053], [054], [055], [056] confirmed on screen or in the database). Setting a
deposit on his Bosch injector found [057]: 84 parts fake the core charge as a choice,
and half let the buyer send the old part first. Built: send-the-old-part-first end to
end, one shipping rule ([058], a held B2B order could ship), the conversion screen, the
re-import guard; [059] (11 queries spelled "canceled") fixed with a new check. Next:
Brandon restarts dev; convert the Bosch injector on "Core charges set up as choices",
then buy it both ways on the site, receive the core, and convert the rest.

**Act 3 status before that:** not started on screen (dev was down). Read ahead of the import
and fixed [049] (repeated SKUs: 94 products would lose a choice and its price,
two products would merge) and [050] (a "Title: Default Title" picker on 523
products). [051] core charges: Brandon chose to build them; built end to end
(variant, cart, checkout, orders, invoices, returns, cores owed, emails, site,
reports), not yet proved on screen. silicaui 0.58 released and installed ([042],
[045] now reachable). Next: Move in, his Shopify file, then set core deposits on
his reman parts, the hand-check SKUs and the L5P / 6.7L searches; prove [042],
[045], [049], [050], [051] on screen.

**Open:** [032] first click on Search everything (real-mouse check). [019] and
[021] confirmations pending. [042] and the false "CSS plugin is not loaded" warning:
released in silicaui 0.58.1 / 0.58.2; sparx still pins 0.58.0 until the install.
[069] "Try again" not yet seen on screen (needs a failed search). [078] not seen on
screen. Checkout with a tax certificate: Gillett collects no tax yet (act 9).

**Asked of Brandon:** Stripe test onboarding (outside service); the real-mouse
check for [032]. Answered 2026-10-02: email a purchase order to the supplier, yes,
built ([071]); keep the old web address working, no, warning only ([070]). Done 2026-10-01: silicaui 0.58 released and the catalog pins
raised and installed; the leftover `cache-revalidation-worker` folder deleted.

**Checks last run:** sparx workbench tsc 0; api-rest tsc 0; site tsc 0;
silicaui-builder tsc 0; site-lint 395/395; silica-catalog 1380/1380 and
upgrade-frame 37/37; blueprints 47/47; `check-blueprint-journal` OK; api-rest
link-choices 3/3 and site-check 23/23; owner phrases 10/10 per console. Each new
guard proved red.

## The person

Doty Brown, he/him, Chief Operating Officer of Gillett Diesel Service Inc. He is a
real person (the site credits him as the author of one of its blog posts); the
details below that are not public are marked **assumed** and exist only to give
the verdicts a lens.

**Technical level (assumed).** Runs operations every day in business software:
a parts counter system, a shop management system, spreadsheets, QuickBooks-style
accounting. Not a developer. He knows "SKU", "Net 30", "core charge" and "PO"
cold; he does not know "module", "surface", "slug" or "webhook", and he should
never need to.

**What he is nervous about (assumed).** Moving the fleet accounts. A fleet
customer's negotiated price, terms and credit limit are the relationship; one
wrong price on one invoice to a fleet is a phone call from their controller and a
reason to buy elsewhere.

**What made him look today.** sparx is the platform Gillett is about to go live
on. This is the last walk-through before that: he is building the real business
in it, end to end, and deciding whether it is ready.

## The business

**Gillett Diesel Service Inc.** ("G.D.S."): a family-owned, full-service diesel
repair and performance shop in Bluffdale, Utah, in business since 1986 (diesel
experience since 1977). A factory authorized injection pump rebuild shop, a
turbocharger rebuild shop, a 14-bay service shop with a chassis dyno, and a parts
warehouse distributing 50+ brands. It works on light-duty diesel pickups (the
Big 3: Cummins, Duramax, Powerstroke) and sells heavy-duty parts, but does not
service Class 8 trucks. Today it sells online on Shopify (653 public products).

- Main office and shop: 14812 Heritagecrest Way, Bluffdale, UT 84065
- Warehouse: 14830 S Concord Park Dr, Bluffdale, UT 84065
- Phone (801) 571-7780 · toll-free (800) 638-4679 · contact@gillettdiesel.com
- Timezone: Mountain (America/Denver)
- Brand: red #CE333C, near-black #121212, navy #101633, Inter type, the GDS
  checkered-flag logo

Every real detail is in [assets/gillett/content.md](assets/gillett/content.md)
and [assets/gillett/products.csv](assets/gillett/products.csv), captured from
gillettdiesel.com on 2026-10-01.

Constraints that are inconvenient for software, on purpose:

- **Two kinds of buyer on one catalog.** Walk-in and online retail buyers pay list;
  dealers (other shops) and fleets pay tier or contract prices, on account, on
  terms. Today the dealer sign-up is a Shopify add-on that no menu links to.
- **Core charges.** 84 products carry a refundable core deposit ("Accept Core
  Charge (+$500)" or "Defer Core Charge"), refunded when the old part comes back
  with their Core Return Form.
- **Fitment is the search.** Buyers look for parts by truck and engine ("2019 RAM
  6.7L Cummins", "L5P Duramax", "6.7L Powerstroke"), not by product name. 604 of
  653 products sit in a vehicle collection today.
- **Tax-exempt buyers.** Dealers buying for resale and farm customers hold
  exemption certificates. Utah sales tax applies to retail.
- **Heavy parts and local delivery.** Same-day shipping, local delivery around
  the Salt Lake valley, and some parts (fuel tanks, transmissions) too heavy for
  parcel.
- **Service, not just parts.** A 12-bay light-duty shop, a 4-bay medium-duty
  shop, a turbo department and a pump/injector department. Today the site only
  says to call for an appointment.

## Why he is here today

1. "Our dealers and fleets need to log in, see their price, and reorder without calling the counter."
2. "Every invoice to a fleet has to be right the first time, on their terms."
3. "I want one place for parts, service bookings, customers and the website."

## The data

**This is the test data. Type it as written** (RULE #2). Company facts come from
[assets/gillett/](assets/gillett/). People are made up and use `.test` addresses.

### Catalog

All **653** real products, moved the way Doty would really move them: a Shopify
product export, [assets/gillett/shopify-products-export.csv](assets/gillett/shopify-products-export.csv)
(787 variant rows, Shopify's own column layout, built from the public capture),
imported through sparx's switch-from-another-platform screen. Product images are
the real ones on Shopify's CDN; local copies are in `assets/gillett/images/products/`.

Products the run checks by hand after the import (real data, typed as written):

| SKU          | Product                                                                              | Brand         | Price     | Why this one                                                                         |
| ------------ | ------------------------------------------------------------------------------------ | ------------- | --------- | ------------------------------------------------------------------------------------ |
| 0986435621   | Bosch Remanufactured Fuel Injector (0986435621)                                      | Bosch         | $730.15   | Core charge as a Shopify option: "Accept Core Charge (+$150)" vs "Defer Core Charge" |
| 1045772      | BD Diesel Screamer HE300VG Turbo for 19-24 Dodge/RAM Cummins 6.7L                    | BD Diesel     | $3,794.95 | Core charge on a big-ticket part                                                     |
| 12709881080  | BorgWarner OEM Replacement Turbocharger \| 20–23 GM 6.6L L5P Duramax                 | Alliant Power | $2,350.00 | A pipe and an en-dash in the name                                                    |
| 0986437441   | Bosch 0986437441 Remanufactured CP4 Fuel Pump                                        | Bosch         | $1,457.26 | Powerstroke fitment, core                                                            |
| 10-1008      | S&B 68 Gallon High-Capacity Fuel Tank, 17-26 Ford Powerstroke 6.7L Crew Cab Long Bed | S&B Filters   | $1,449.00 | 80+ character name, heavy part                                                       |
| 4062328      | Cummins Fuel Injection Crossover Tube O-Ring                                         | Cummins       | $4.32     | Cheapest item in the store                                                           |
| 07-CC-24V19+ | Hamilton Cams 2019+ Flat tappet conversion kit (07-CC-24V19+)                        | Hamilton Cams | $3,399.00 | `+` in the SKU                                                                       |
| #80          | Mag-Hytec Dana 80 Differential Cover                                                 | MAG-HYTEC     | $319.00   | `#` in the SKU                                                                       |
| 90343        | FPPF Total Power Fuel Treatment                                                      | FPPF          | $22.99    | "Single or Case of 12" option                                                        |
| AP65124      | Alliant AP65124 Remanufactured Fuel Injection Control Module (FICM)                  | Alliant Power | $675.00   | "Select Core Type" option                                                            |

Fitment checks: searching **L5P**, **6.7L Cummins** and **6.7L Powerstroke** must find
the parts that fit.

### Dealer and fleet accounts (made up, Utah region)

Gillett services light-duty diesel pickups, so its trade buyers are other shops
(dealers) and businesses running pickup fleets.

| Account                                                             | Kind   | Contact (buyer)       | Email                               | Phone             | Terms        | Credit limit | Tier     | Notes                                                  |
| ------------------------------------------------------------------- | ------ | --------------------- | ----------------------------------- | ----------------- | ------------ | ------------ | -------- | ------------------------------------------------------ |
| Wasatch Front Utility Contractors, LLC                              | Fleet  | Renée Castañeda       | renee.castaneda@wasatchutility.test | +1 (801) 555-0148 | Net 30       | $25,000.00   | Fleet    | 38 RAM 3500s, 6.7L Cummins; PO number on every invoice |
| O'Malley Ranch & Hay Co.                                            | Fleet  | Seamus O'Malley       | seamus.omalley@omalleyranch.test    | +1 (435) 555-0172 | Net 15       | $10,000.00   | Fleet    | Tax-exempt (agricultural); spring and harvest spikes   |
| Salt Lake County Public Works Department, Fleet Management Division | Fleet  | Dana Whitcomb-Nguyen  | dana.whitcomb-nguyen@slcopw.test    | +1 (385) 555-0109 | Net 45       | $40,000.00   | Contract | Long name on purpose; orders over $2,500 need approval |
| Høgberg Diesel & Performance                                        | Dealer | Lars Høgberg          | lars.hogberg@hogbergdiesel.test     | +1 (208) 555-0133 | Net 30       | $7,500.00    | Dealer   | Idaho shop; resale-exempt; sends cores back            |
| Red Rock Hotshot Trucking                                           | Fleet  | Marisa Delacroix-Ward | marisa.dw@redrockhotshot.test       | +1 (435) 555-0161 | Pay at order | $0.00        | Fleet    | New; no credit yet. 6 Powerstroke 6.7L hotshot rigs    |

Billing addresses (made up): Wasatch Front, 2275 S 900 W, Suite 200, Salt Lake
City, UT 84119; O'Malley Ranch, 4410 N Old Hwy 91, Hyde Park, UT 84318; Salt Lake
County Public Works, 604 W 6960 S, Midvale, UT 84047; Høgberg Diesel, 1180 E
Seltice Way, Post Falls, ID 83854; Red Rock Hotshot, 389 N Bluff St, St. George,
UT 84770.

Price tiers (made up; Gillett's real trade discounts are not public):

| Tier     | Discount off list | Who                                   |
| -------- | ----------------- | ------------------------------------- |
| Dealer   | 20%               | Other shops buying for resale         |
| Fleet    | 12%               | Businesses running pickup fleets      |
| Contract | 15%               | Salt Lake County, plus contract lines |

Contract price: Salt Lake County pays **$19.25** for FPPF Total Power Fuel
Treatment (90343, list $22.99), its standing monthly order.

Approval rule: any Salt Lake County order over **$2,500.00** holds for staff
approval.

The quote: Wasatch Front asks for **6 × Bosch Remanufactured Fuel Injector
(0986435621)** and **2 × Cummins Fuel Injection Crossover Tube O-Ring (4062328)**,
their PO **WFUC-24-0817**. Since act 3 the injector is $600.00 plus a $150.00
refundable core deposit (his old store's "Accept Core Charge" $730.15 became the
deposit, [057]). At Fleet tier (12% off; the deposit is not discounted): injector
$528.00, O-ring $4.32 → $3.80. Hand sum: 6 × 528.00 = 3,168.00; 2 × 3.80 = 7.60;
goods $3,175.60; core deposits 6 × 150.00 = $900.00; before tax.

### Retail customers (made up, at least 25 for paging)

Loaded through the screen (import if the screen offers it). Utah, Idaho, Nevada
and Wyoming addresses; apostrophes, accents and long street names; `.test` emails.

### Staff (made up)

| Name              | Role                | Email                              |
| ----------------- | ------------------- | ---------------------------------- |
| Kendra Ruiz       | Parts counter       | kendra.ruiz@gillettdiesel.test     |
| Mike Van Der Berg | Service manager     | mike.vanderberg@gillettdiesel.test |
| Alyssa Thompson   | Accounts receivable | alyssa.thompson@gillettdiesel.test |

### Departments and service menu

Departments are real (Full Service Shop, Turbo Department, Pump/Injector
Department). Their prices are not public, so the prices below are made up.

| Service                                       | Department        | Length | Price   |
| --------------------------------------------- | ----------------- | ------ | ------- |
| Diesel diagnostic, light-duty pickup          | Full Service Shop | 2 h    | $285.00 |
| Chassis dyno run, before and after            | Full Service Shop | 1 h    | $150.00 |
| Injector replacement, set of 6 (Cummins 6.7L) | Pump/Injector     | 6 h    | quote   |
| Turbocharger rebuild and balance              | Turbo Department  | 4 h    | quote   |
| Pre-purchase inspection, used diesel truck    | Full Service Shop | 1.5 h  | $195.00 |

---

## The deliverable — Gillett Diesel, live on sparx

**This list is the definition of done** (RULE #8).

| Item                        | What it must have                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant + brand              | Real name, logo, favicon, colors, address, phone, hours, timezone (Mountain, America/Denver)                                                                                                                    |
| All 16 modules on           | And the bill sparx shows for them, checked by hand                                                                                                                                                              |
| Catalog                     | 40+ real products, real part numbers, brands, categories, images with alt text, fitment by truck and engine                                                                                                     |
| Core charges                | On every reman part, refunded when the core comes back                                                                                                                                                          |
| Inventory                   | A warehouse per Gillett location, real stock counts, reorder points, a supplier, a purchase order received                                                                                                      |
| Wholesale                   | 5 dealer and fleet accounts above, tiers, a contract price, credit limits, terms, an approval rule, a quote turned into an order                                                                                |
| Invoicing                   | A fleet invoice on Net 30 with a PO number, a partial payment, a paid invoice                                                                                                                                   |
| Customers                   | The accounts as companies, contacts, a pipeline with real deals, tasks, a ticket                                                                                                                                |
| Scheduling                  | Service bays as resources, the service menu, opening hours, a booked service                                                                                                                                    |
| Website                     | Home, parts catalog by engine, product pages, cart, checkout (Stripe test), shopper account, trade sign-in and reorder, service booking, about, locations, contact, blog with 3 real articles, legal pages, 404 |
| Content                     | Blog articles from the real site, legal pages published                                                                                                                                                         |
| SEO                         | Per-page titles and descriptions, sitemap, social card                                                                                                                                                          |
| Email                       | Order confirmation and invoice emails read in the event-worker log; one broadcast to fleets                                                                                                                     |
| Automations                 | One real automation (e.g. invoice overdue reminder) that fires                                                                                                                                                  |
| Social, Campaigns, Messages | A drafted post, a campaign, a customer message answered (outside accounts: not checked)                                                                                                                         |
| Finance                     | The month's revenue and costs reconciling to the orders and invoices                                                                                                                                            |
| Your team                   | 3 staff invited with sensible roles; one signs in                                                                                                                                                               |
| Dropshipping                | One heavy part shipped direct from a supplier                                                                                                                                                                   |
| AI                          | An API key, and an MCP client answering "which fleets are past due?" from Gillett's data                                                                                                                        |

**The look.** Gillett's own brand: their colors and logo, industrial and direct.
Not a sparx template with the nouns changed.

---

## The run

### Act 1 — Find sparx and create the account

Land on sparx.works (3003), read it as Doty, find the way to start, create the
account, and walk the first-run setup with every module on.

**Done when:** he is in the workbench, signed in, tenant named "Gillett Diesel
Service", 16 modules on, and the screen says what that costs.

### Act 2 — Make it Gillett

Business details, logo, favicon, colors, locations, hours, timezone.

**Done when:** every place the business name, logo and phone appear shows
Gillett's real ones.

### Act 3 — The catalog

Categories, then the 40+ real products with part numbers, brands, images, fitment
by engine, and core charges on reman parts.

**Done when:** searching "L5P" in the workbench finds the parts that fit it, and
all 653 products came across with their prices, images and core options.

### Act 4 — Stock

Warehouses per location, opening stock, reorder points, a supplier, a purchase
order sent and received.

**Done when:** the received PO raised on-hand counts by exactly what was received.

### Act 5 — Wholesale

Tiers, the five trade accounts, a contract price, credit limits, terms, an
approval rule over $2,500, a quote that becomes an order.

**Done when:** Wasatch Front's quote converts to an order at their tier price and
the invoice reads Net 30 with their PO number.

**Promises the sparx.works/b2b page makes, each one checked on screen** (a
sentence saying what happens is a contract):

- [ ] A logged-in buyer sees their tier price in the catalog and at checkout
- [ ] The buyer builds an RFQ from the catalog; it lands separate from the cart
- [ ] Quote pricing shows margin off the cost basis; markup rules help
- [ ] The buyer gets a branded quote PDF, valid until the expiry
- [ ] An accepted quote converts straight to an order at the quoted prices
- [ ] Orders on terms invoice automatically with the buyer's PO number, and the
      PO rides onto the invoice and every statement
- [ ] An order that would run an account over its credit limit holds for approval
- [ ] Orders above a set amount hold for staff approval
- [ ] A/R aging shows what is outstanding by age
- [ ] Saved carts and one-click reorder
- [ ] Minimum and maximum quantities, case packs, and minimum order values per
      product per account
- [ ] A fleet profile on the account; "fits your fleet" badge, fitted parts first
- [ ] Service booked from the same portal, tied to the account (with Scheduling)
- [ ] Service history recorded against the vehicle, parts linked from the order
- [ ] Price: B2B $99/mo + Commerce $49/mo, Invoicing and Inventory free,
      Scheduling $29/mo; 14-day trial, no card to begin

### Act 6 — Invoicing and money in

The fleet invoice, a partial payment, a paid invoice, an overdue one.

**Done when:** the balances on screen match the hand-computed ones to the cent.

### Act 7 — Customers

Companies, contacts, retail customers (25+), a pipeline of fleet deals, tasks, a
support ticket.

**Done when:** opening Wasatch Front Utility Contractors shows its people, deals, orders and invoices
in one place.

### Act 8 — Service bookings

Bays, technicians, the service menu, hours, and a booking.

**Done when:** a pre-purchase inspection booked from the public site appears on
the service manager's day.

### Act 9 — The website

Every page in the deliverable list, in Gillett's brand, published.

**Done when:** a stranger can find a 6.7L Cummins injector by truck, buy it with
a test card (core charge accepted), and get the order email.

### Act 10 — Email, automations, social, campaigns, messages

**Done when:** an overdue-invoice reminder fires on its own and the email reads
right in the event-worker log.

### Act 11 — Team, dropshipping, finance

**Done when:** Alyssa (accounts receivable) signs in and sees invoices but not
settings she should not change; the month's finance numbers match the orders.

### Act 12 — AI over MCP

**Done when:** an MCP client using Doty's key answers "which fleets are past due?"
correctly from Gillett's data, and cannot see any other tenant.

### Act 13 — The other side, and what goes wrong

The shopper's account and order history; Renée reorders from the trade portal;
a wrong injector comes back as a return, and a core comes back for its refund; a fleet goes over its
credit limit.

**Done when:** each one ends with the right money and the right record, on both
sides.

---

## What only this persona proves

That sparx can run the whole of one real multi-location B2B parts-and-service
business, every module at once, before its first Enterprise client goes live.

---

## Standing checks

**Wrong moves.** Import the retail customer file twice. Delete the "Injectors"
category while products sit in it. Double-click "Place order" at checkout. Edit
Wasatch Front's invoice after it was sent. Refund the same injector line twice.

**Reload and deep link.** F5 on an open Wasatch Front account; open a product's
address in a new window; open an invoice link while signed out.

**Dates.** An invoice dated the 31st on Net 30; one 40 days overdue; a booking at
18:30 Mountain, with the machine's timezone recorded.

**Money at the edges.** A Fleet tier price on a part that also has a
contract price for Salt Lake County (which wins?); tax on a discounted retail line; a
core charge refunded on a partial return; O'Malley Ranch's tax-exempt order.

**The other side.** The retail shopper finds their order again; Renée reorders
from her order history; Dana opens and pays an invoice.

**Without a mouse.** Create the Høgberg trade account by keyboard alone.

**Somebody else's data.** Search the workbench for a Piggles business's product
name (e.g. "Marlow Knit"); deep-link another tenant's product id; switch site if
a second site exists.

---

## Verification

Filled in at the end, honestly, including what was skipped (RULE #4).

|                             | Result |
| --------------------------- | ------ |
| Acts completed              |        |
| Issues filed                |        |
| Issues fixed and confirmed  |        |
| Issues blocked, and on what |        |
| Panes scored                |        |
| **Not checked**             |        |

### The numbers

| Record                              | Result |
| ----------------------------------- | ------ |
| Time to live site                   |        |
| Speed at real volume                |        |
| Modules on (screen vs settings row) |        |
| Bill shown vs hand-computed         |        |

---

## Run log

| Date       | Act | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | 1   | **First door, sparx.works (:3003).** The web dev server was in a rebuild loop (2 rebuilds a second, a reload each): a `pnpm install` at 01:45 re-made the `node_modules` links under a running Turbopack, which then logged "Next.js package not found" forever. Not a product defect; Brandon restarted it with a clean `.next`. Home scrolled sideways at 1411px ([001], fixed). Read /b2b as Doty: the page makes 15 checkable promises, copied into act 5 as a checklist. **Activate B2B did nothing**: 40 CTA buttons on 19 marketing files were plain buttons, and the working ones pointed at the LIVE app ([002], fixed, now `localhost:3011/sign-up?ref=b2b-hero`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-01 | 1   | **Create account** (09:37:43Z): name, email, password, terms box. Landed in setup on a salon story with 5 modules pre-picked and "Build my salon", though he came from the B2B page (recorded; not filed, the examples are a starting point he can change, and nothing was provisioned). Pressing the fitness example by mistake showed an ACCOUNTING template as its starting point ([003], fixed, shared with Piggles). Typing "diesel parts and repair" matched nothing and "Use “…”" threw his words away ([004], fixed; Brandon: "the story should support custom words"). "A salon" stayed lit over his story after a reload ([005], fixed). The API restarted under my schema edit once and setup said "We couldn't load your setup … Nothing you've entered is lost": Try again brought the story back intact, so that sentence held.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-01 | 1   | **The plan.** Inventory menu said "+$29", the plan said Included ([006], fixed); the workbench's copy of the billing rules was missing Finance-free-with-Commerce ([006], guard `check:module-graph` added). Story and step-by-step offered 12 of 16 modules under "Every module is one toggle" ([007], fixed: Social, Campaigns, Finance, Your team). Story: "I run diesel parts and repair for people and businesses, where they can order online, have it shipped, book appointments, pick up locally, get local delivery, and message me with questions. I supply other businesses, send an invoice and get paid, always know what's in stock, have a supplier ship fuel tanks and transmissions, share what I know on a blog, stay in touch with my customers, and let an AI assistant help me run it. I also remember every customer." Address `gillettdiesel.sparx.zone`. **Plan $440/mo, hand-checked.** Still to check on the sparx rows: they name other companies (Shopify, Klarna, Avalara, FreshBooks, Intercom, …) and list integrations; each is a promise to verify when Doty reaches that module. Starting point offered: "Auto (European Specialist)".                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-01 | 1   | **Starting point.** The gallery marked "Universal Starter" while the summary named the story's match, and Continue installed the gallery's ([008], fixed both consoles); the selected card was 121st of 190, 22,000px down, under a false "Filtered to the modules you chose" ([008]). The match itself was "Auto (European Specialist)", a booking-only BMW/Mercedes template with no shop, beside "Garage" (shop + booking + wholesale for vehicle service and parts) ([013], fixed: the template using more of the owner's modules wins). "Bring its examples" and "Start blank" sat under all 190 cards ([015], fixed both consoles). Doty took **Garage, examples off** (his catalog comes by import).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-01 | 1   | **Saving.** Switches flipped in step-by-step never reached the saved story, so a reload dropped Social, Campaigns and Your team ($440 → $411) ([009], fixed both consoles; the save now retries a failure). Each switch had started its own "I also …" sentence, and the saved prose said "I'll supply" under a screen saying "I supply" ([010], fixed, shared `lineLead`). A 503 while api-rest restarted printed "Failed to fetch" ([014], fixed, 8 places) and, on reload, dropped Doty out of setup into the full workspace ([012], fixed: setup waits out a blip, "Reconnecting…"). That workspace opened on **141 tabs belonging to WizeWorks LLC**: the active-site cookie from a previous sign-in on this browser keyed the saved layout ([011], blocker, fixed both consoles: the cookie carries its tenant).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | 1   | **Workspace, domain, payments.** Name fields held the made-up "Doty's workspace" under "We pre-filled what you told us" ([016], fixed). Steps opened scrolled down ([017], fixed both). Typed **Gillett Diesel Service Inc.** / **Gillett Diesel Service**. Domain: no custom domain bought (outside service); the step said the site "is live" already and pointed at a "Settings" that does not exist, and never mentioned connecting a domain he owns ([019], fixed both; confirm "Domains, under Your business" in act 2). Payments: **Stripe not connected, outside service** (Stripe's hosted onboarding creates an account on stripe.com; Brandon to complete it in test mode). Closing the Stripe window left the button spinning forever ([018], fixed both).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | 1   | **Launch.** "6 products … installed" over a catalog of 0, and "no cut of every order" over sparx Pay's 0.5% ([020], fixed both; the payments step now states the fee). Before Publish, a stranger could already open his address and read a starter page under his name ([021], open, next). **Published 11:07:04Z**; landed in the workspace in ~3s, avatar "DB", company name truncated in the top bar with room to spare (for the rating).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-01 | 1   | **The customer side, first look.** The live homepage read "Product name $0.00" and "Post title" over empty lists ([022], fixed at the shared renderer; re-proved on Juniper Row) and carried a fabricated testimonial, "Priya Nair, Founder", with a stock photo ([023], fixed in the catalog, 22 bundles, versions bumped). The first view after publishing showed the old navy look for a minute or two before the Garage look (dark, orange); not reproduced since, recorded only. **Act 1 done:** signed in, 16 modules on, $440/mo stated and hand-checked, a live site at `gillettdiesel.sparx.zone`. Time from account to published: **1h29m wall clock**, almost all of it filing and fixing 23 issues; the owner's own time is not separable from it and is **not measured**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-01 | 2   | **Make it Gillett, part 1.** The welcome tour's Next sat under the canvas tools and opened "Tidy up" ([024], fixed). "Get set up" ticked two things he had not done and its Connect Stripe opened Business details ([025], fixed; my first fix counted every tenant's domains because `domains` has no RLS, caught on screen). Business details showed no name and suggested "WizeWorks" ([026], fixed); filled: Corporation, 14812 Heritagecrest Way, Bluffdale, UT 84065, (801) 571-7780, contact@gillettdiesel.com, registered for sales tax, USD, Mountain time (Salt Lake City found nothing: [027], fixed). Hours: not public, **assumed** Mon–Fri 7:30–17:30, Sat 8:00–12:00, not yet entered (no hours field met so far).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-01 | 2   | **Site identity.** "Site" loaded forever: 14 screens read the raw site cookie, which a one-site business never has ([028], blocker, fixed + guard). Site contact offered business details in one press ([029]). Set tagline "Diesel Done Right Since 1986!", logo, white logo for dark, favicon, four real social links; all saved; logo and favicon live ~20s later. Social links do NOT show on the live footer: his footer came from the pre-regeneration Garage copy; the platform repairs it on the designer's draft (by design, `upgrade-frame.ts`), so it shows after he publishes from the designer. The designer opened at 60% width and "fill the workspace" did nothing on a floating window ([030], fixed). The site check before publishing: 2 broken links on the product page (`/shipping-policy`, returns), because his policy pages do not exist yet; next step is adding Gillett's real shipping and refund policies as Legal pages. "shipping policy" found no screen ([031], fixed, to confirm). The first click on Search everything after a load was swallowed twice ([032], open; may be the browser tool). Then the browser extension disconnected.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-01 | 2   | **Legal pages.** The browser came back. Search everything opened on the first click this time ([032], still open). "shipping policy" now finds Legal pages ([031], confirmed). All six policy pages already existed as drafts with starter wording. Pasted his real Shipping Policy (with its delivery-times table) and pressed Publish: the toast said "is live", the database held the STARTER text ([033], blocker; the same gap in social posts, invoice templates and discounts, all fixed, both consoles). The editor said nothing about starter wording: ported the Piggles warning, made it say only what it knows, gave it a Mark reviewed button ([033]). Brandon spotted Unpublish and Save sitting mid-toolbar: one cause behind 61 toolbars ([034], fixed at the shared toolbar). Shipping Policy: his text live, marked reviewed. Refund Policy: his text, published in one press.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-01 | 2   | **Fully test, policies, banner, theme, locations.** Brandon: "yes" to the catalog refresh and "fully test". The refresh command deleted the integration shelf, and the shelf only ever listed 5 of 39 ([035], fixed). Re-proved [033] on screen: discount Switch on with an unsaved 10→15% stored 15; invoice template Publish with unsaved Net 30 terms stored them; social not checkable (needs a connected account, outside service). Search missed "new discount", "invoice template", "product page", "new social post" and "business hours" ([036], fixed with a real-catalog phrase test). Piggles checked read-only as Juniper Row (search, toolbar); its write fixes not re-proved (only another agent's persona is signed in). Privacy and Terms pasted (his Shopify-era wording, his to update: it names Shopify and forbids resale while he runs wholesale) and published. No screen could turn on the cookie banner the required Cookie Policy promises ([037], fixed: new Cookie banner section, honest starter wording v5, visitor choices list only his kinds). Lists rendered without bullets ([038]); social icons read as raw keys ([039]); owner saves waited on a 5-minute cache nothing cleared ([040], fixed by moving the purge into the event-worker); a deleted page stayed listed ([041]). The product page's link needed its address typed by heart ([042], open: silicaui). Theme: Workshop + his red and navy, published. Stock locations: Warehouse and Main Office; a new one started on "No country" ([043], fixed).                       |
| 2026-10-01 | 2   | **Restart, live proofs, his own words.** After Brandon's restart: bullets on his policy lists ([038]), icon names read aloud ([039]) and owner saves reaching the live site in 3 s, publishes in 10 s ([040]) all proved live; the visitor's cookie choices list only his two kinds ([037]). "cookie banner" found only the Cookie Policy ([044], fixed). The editor's link box: silicaui 0.57 already lists builder pages, but never his policy pages; added a host seam in silicaui and an API list of every place a link can go ([042], waits on the silicaui release). Swapping the hero photo kept the old photo's description ([045], same release). The whole homepage below the hero was the platform's pitch and lines to the owner; nothing said so. New Check rule names template words still on a page, the footer line now shows his tagline, 42 shipped designs patched ([046]). Rewrote Home, About, Contact, Shop and Journal with his real copy and photos; published. The editor showed a made-up phone number on Contact ([047], ported from Piggles). As customers: the contact form stored all messages, but a second Send stored a duplicate ([048], fixed). Invoice preview: his logo, address, phone and terms. **Act 2 done.**                                                                                                                                                                                                                                                                                                                     |
| 2026-10-01 | 3   | **Read ahead of the import** (dev was down). His Shopify file: 787 rows, 653 products, 127 with choices. 94 of those give both choices one SKU ("Accept Core Charge" $730.15 and "Defer Core Charge" $600.00 both `0986435621`); two different products share `-`. The importer matched by SKU, so each would have kept one choice at the other's price, and the gasket would have overwritten the fuel rail ([049], blocker, fixed). 523 products carry Shopify's "Title: Default Title" placeholder as a real option ([050], fixed, file and live link). sparx has no core charge; his parts keep Shopify's dearer-choice way ([051], decision).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-01 | 3   | **Core charges, built.** Brandon: "build real core deposits and refunds" (no shortcuts). The deposit rides on the part's own line everywhere (variant, cart, order, invoice), never taxed, discounted or in a subtotal; each core ends as part returned, core returned (refunded: invoice first, then card or account credit) or deposit kept; a Cores owed list and three MCP tools ([051]). On the same path: return "store credit" never reached the balance; return refunds lost the gateway refund id; the card was charged less than the page showed with a card fee on; a part refund made a paid order read as owing (rule fixed, 2 rows repaired); a quote-to-order dropped its card fee. silicaui 0.58 released (PR #105, merged by Brandon) and installed. Migrations applied by me with Brandon's go-ahead while dev was down. Not yet proved on screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-01 | 3   | **Import, photos, and a core charge faked as a choice.** Third import of his file: 653 products, 777 versions, 0 errors; 0 doubled photos ([055] confirmed), every photo copied into sparx and the site shows them ([056]: dev saved photos where the API could not serve them, 101 were left on Shopify by a 320 KB limit meant for AI messages, and a second run could never fix a link). His Bosch injector 0986435621 shows two choices at their own prices ([049] on screen). Giving it a deposit found [057]: removing the choice stops every version selling, 84 parts fake the deposit as a choice under 5 option names and 40 spellings, half are "ship when core received" (the buyer sends the old part first), one part as two versions splits its stock, and the prices do not follow the words (7 equal, 15 ship-now cheaper). Built send-the-old-part-first, one shipping rule for every way out (it also fixed [058]: a B2B order held for approval could be picked, packed and shipped), "Core charges set up as choices", and a re-import guard. A code map found [059]: 11 queries spelled "canceled" and filtered nothing (cancelled orders counted as sales; a cancelled pick list held its units forever), and the Cores owed list failed on every load (a filter on a field orders do not have); the select check now reads filters too. Migration applied with dev down, Brandon's go-ahead. Not yet proved on screen.                                                                                                                              |
| 2026-10-01 | 3   | **Core charges proved, and what proving them found.** Dev back. "Core charges set up as choices" failed every request: it selected `optionValues`, which does not exist (hand-written row type behind a cast); fixed with `satisfies Prisma.ProductSelect`, and `check:prisma-selects` now follows a select held in a `const` (both proved red). Converted the Bosch 0986435621, then all 83 others (database: 0 core options, 84 one-version parts). The live product page still showed $600.00 and no deposit: the console never surfaced `livePageGaps` ([060], built the Piggles offer for Start here and the Editor; repaired, published, the page then offered both ways). Card checkout correctly refused (Stripe is Brandon's), and sparx had no counter sale ([061], ported from Piggles with core deposits in both consoles). Three counter orders proved the deposit refund, the ship gate (screen and server), "old part arrived" and "don't wait". On the way: toasts hidden under the corner buttons and zoom never scaling pane contents ([062]), undo back to saved still "Unsaved changes" and a missing palette icon ([063]), "ships" said about pickup orders (reworded across both consoles, site, email, MCP), "If 1 this part", an amber "Part refunded" on every returned deposit (now "Paid, deposit back"), "Subtotal (1 items)", an inline style in breadcrumbs, a false silicaui plugin warning (silicaui PR #107). [045] and [052] confirmed on screen. The receipts showed every email link is a bare path on every shop ([064], in progress). |
| 2026-10-02 | 3-4 | **Fitment, categories, opening stock.** Bulk tools from [065] driven as Doty: L5P (13, one wrong, taken off again), 6.7L Cummins 47, 6.7L Powerstroke 18 then 23, LML 15, LLY 13 (Bully Dog and an LBZ injector left out by hand: "bu**lly**" and old-store addresses), LBZ 12, LB7 9, LMM 9; 18 categories, 652 of 653 products. Found and fixed on the way: [067] a Ford example under GMC; [070] title-only search, my own site-filter overwrite ("L5P" listed all 653), names cut at 16rem, "Remove" by make removed nothing; the rename box opened unfocused; Ford engines renamed "Powerstroke". Act 4: his old store's inventory export (1,368 rows) after [068] (empty column guessed, no online-store source, locations by code only, an odd item with no way to point it, the row lost its location, a five-second limit, a thrown-away file listing units) and [069] (pickers stopped at 500, "Try again" did nothing). [066] confirmed; "stock locations" now finds Locations. silicaui #106, #107 released, #108 fixed the release-notes check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-02 | 4   | **Stock, supplier, purchase order.** Opening stock from his old store's inventory export ([068], [069]). Supplier Alliant Power: an item could be added only by typing his own code from memory, nothing started an order from the supplier, "Sent to the supplier" after a dialog saying nothing is sent, the printed order said "Submitted" ([071], fixed). PO-000001 placed, printed, received 6 + 10 + 1 of 2; on-hand rose by exactly that. Reorder levels in the stock grid: the unsaved bar pushed rows under the mouse and "running low" said "Showing 1 of 3" over one row ([072], fixed). Asked of Brandon: emailing a purchase order to the supplier (new capability); automatic redirects when a product's web address changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-02 | 4   | **Emailing a purchase order (Brandon: build it).** PO-000002 placed and emailed to Alliant Power from the place dialog; resent to a second address from the order. Found: invoices, signing requests and download links went out from the platform's no-reply address, so replies were lost; a name ending "Inc." printed two full stops ([071], fixed). Clearing a supplier's email (to test no address) said "saved" and kept it: no optional supplier field, and no line of a saved customer address, could ever be emptied ([073], fixed). Web-address redirects: Brandon said warning only ([070]).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-02 | 5   | **Wholesale, quote to order to invoice.** Tiers, five accounts, contract price, sign-off rule, tax certificates ([074]-[076], [078]-[081] fixed). Quote editor rebuilt for trade prices, PO numbers and bill-to ([077]). Renée (site): Fleet price in catalog and cart; checkout let her pick her own terms ([082], fixed); O-000007 on account, INV-000001 due Nov 1. Q-000002 preview lost its $900.00 deposits and printed "Catalog item" ([083], fixed). Renée could not find, keep a session for, or accept the quote, and it ate her credit ([084], fixed: cookie prefix, Quoted on send, credit SQL, portal pages, accepted-quote task, order invoices itself and links to it). O-000008 at Fleet prices, INV-000003 Net 30 with WFUC-24-0817: **done-when holds**. Q-000004 → O-000009 → INV-000005 by itself; migrations applied and confirmed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-02 | 5   | **The /b2b promises, kept.** Five sentences on the page were not true ([085], fixed): accepting did not order, order invoices were never sent, the credit limit refused instead of holding, no buyer PDF, no statements. Now: Renée accepted Q-000006 → O-000011 → INV-000007 emailed by itself; SLCo's O-000012 held at the $2,500 limit and approved → INV-000009 emailed to Dana; O'Malley's O-000013 held over its $10,000 credit and rejected; print pages for quote and invoice; statements (helper agent). Also fixed on the way: the Invoices list called quotes Owed, the price form called a rise a saving, blank customer names in tasks, the customer search hid names, the editor rail overlapped, workflow names were jargon.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-03 | 5   | **The approver who was never asked.** Teodora was "Can approve orders" and nothing ever asked her ([087], fixed): a limit can now be signed by the account's own approvers, on the site. Doty set Wasatch's "Over $1,000.00" to Teodora; Renée's O-000014 ($1,208.00) waited for her, she approved it with a note, INV-000014 was issued with the PO. Renée's O-000015 (Holset turbo, $2,700.00) waited, Teodora turned it down with a reason, the turbo's hold was released. Also fixed on the way: held orders hold stock, card holds capture or void with the answer, a bought cart no longer takes changes, and a test suite no longer wipes the search index.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-06 | 5   | **Search and the tasks behind it.** After the WSL restart `localhost` answered again; `127.0.0.1` loads but never starts (the dev server refuses its live-reload line from any other origin), so use `localhost`. Removed contacts are a yellow badge now (Brandon). "Wasatch" found the account, its people, invoices, quotes and all five orders ([087], confirmed). "O-0000" counted 10 of Gillett's 15 orders, the engine's half-typed-word limit ([089], fixed for every search). Three sign-off tasks were still open days after their orders were answered, one titled `from  is waiting` ([088], fixed: migration 0023, the daily check closes order tasks and now announces what it closes, a canceled or edited task tells search, closed tasks read Done or Canceled). With the API restarting the box said "Nothing in your records matches" ([090], fixed both consoles, with a separate message for a search too long to send).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-06 | 5   | **Fully tested, live.** Brandon: "you have to fully test this". Dana signed up on the site and placed O-000016 and O-000017 (2 Cheetah turbos, $4,758.30, over the county's $2,500 limit): each opened its sign-off task by itself, and canceling each closed it to Canceled in search with no hand steps. A task renamed, canceled, reopened and marked done by hand: search followed each ([088], confirmed live). Product and customer list counts match the database; Piggles search checked as Devi ([089], [090]). New defects, all fixed both consoles: a held order read "$4,758.30 still owed", offered Make an invoice and a cash box, sat under "Still owed", and its cancel box said "1 item" for two ([091]); Remove took a contact away in one click, and after Restore the pointer sat on the account's only approver's Remove ([092]); "Units 31" dropped the 31 ([093]). Another session was editing `api-rest` at the same time and restarted the API every few minutes; Dana's first sign-up and one shop search failed in those gaps and worked on retry (not product defects).                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-06 | 6   | **Money in.** INV-000009 from the search box opened the whole Wholesale invoices list, which listed eight quotes as Owed, $22,389.72 nobody owed ([094], fixed: the list is bills, a hit opens its own record, the top accounts report stopped counting a quote and its invoice twice). Every invoice an order on account raised was one line, "Order O-000012", with the $400.00 of core deposits folded into the goods ([095], fixed; INV-000015 for Dana's O-000018 itemized). The pinned Summary covered Record a payment ([096], fixed); $500.00 check recorded, $820.00 left. INV-000005 marked paid ("INV-000005as received", [102]). Moving in his old receivables: Raise an invoice ignored the account's terms and scolded an untouched Amount ([097]); a typed due day listed a day early ([098]); order invoices counted terms from the moment, so INV-000014 read Nov 2 and Nov 3 on two screens ([099], migration 0026 moves all due dates to midday of the day they were printed with); 4471 could never be emailed, Send pointed at a locked Bill to ([100]); the ladder suspended O'Malley and told nobody ([101], owner notice proved on Høgberg's 4466). Totals to the cent on Owed to you, the Wholesale list, each account and Wasatch's statement. The first click after a page load was swallowed again twice ([032], still the real-mouse check). My first draft of [101] installed two task automations in 38 local businesses before I renamed them; removed (76 rows, never run).                                                                |
| 2026-10-06 | 7   | **Customers.** The Shopify customer file moved in: "Tax Exempt" was dropped without a word ([104], now listed as left behind and noted on the 3 exempt customers); Shopify's stock export read as 1,367 problems ([105]); a second import said "30 of 30 brought over" and doubled a walk-in with no email ([106], matched by phone now); imported customers were not in search until someone pressed Put them back ([107]). Duplicates said everyone was unique while phones were never compared ([108]); merging Brynn's two records needed a hand merge that did not exist ([109]). The fleet pipeline's Won step was 0% likely ([110], migration 0027); the company page counted five quotes as owed, $13,469.60 for $5,976.80 ([111]); orders and deals lived on two pages that never linked, and the company page could not add a deal, a person or a request ([112]); a new deal with no estimate was stored at 0% ([113], migration 0028); the reason a deal was lost was wiped by the save that lost it ([114]); a deal page showed no tasks, not even the follow-up an automation had made for it ([115]); a request could only name the first 100 customers ([116]). Six deals, one task, Request #1. **Done-when holds.** The browser tool drops input sent with or right after a page load (measured, [032]).                                                                                                                                                                                                                                                  |
| 2026-10-06 | 8   | **Service bookings.** A quoted job could only be priced $0, which the site showed as "Free" ([117]: "We quote the price after looking at the job"). A new person or machine had no hours and nothing said so, so nobody could book it ([118]: "No hours" with Set its hours, and the list's button now names what it adds). The place showed a blank time zone that invited a wrong pick ([119]). The invite dialog named roles without saying what each can do ([120]). The invite page crashed for every invitee ([121], blocker). Mike, once in, could not save his own settings: the analytics question came back on every load ([122]). Mike opened onto Doty's 155 tabs on her computer ([123]). Every invitee landed in an empty business of their own, asked to buy a plan, with no way between businesses ([124], blocker: fresh window on accept and sign-in, the new-session rule, a sparx business switcher, a way back from setup, invitation words in both products). Wade booked the pre-purchase inspection on the public site and it sits on Mike's calendar. Each guard proved red.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-06 | 9   | **The website, first half.** The truck finder was empty on every shop and a chosen year hid parts that fit every year ([125]); no product page said what it fits ([126]); a region could not be limited to one country ([127]); with no product group no delivery option could be added ([128]); setting up delivery took pickup away ([129]). Pages were not in search ([130]). Checkout asked for name, phone and address before saying the shop takes no card payments ([131]). Built Locations and put it in all three menus. Two Insert rows shared the key `timeline` ([132]). The page check said what to fix with no way to fix it, and a saved title stayed off the live site for five minutes ([133]). The title check graded 54 characters while the site served 79 ([134]). All eight pages now carry search titles and summaries; scores 76 to 90. Then the Journal (three articles, Doty as author), Book and Wholesale in his words, the appointment button to /book, the 404 checked. No booking had ever got a reminder ([135]); trade buyers on account were shut out by the [131] fix ([136]); a counter pickup was never taxed ([137]); one British spelling ([138]). Utah tax proved on O-000020: $73.05 on $1,007.60. Left: the card purchase (Stripe, Brandon).                                                                                                                                                                                                                                                                                      |
