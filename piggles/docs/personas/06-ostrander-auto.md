# P06 — Wes Ostrander · Ostrander Auto & Fleet

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Car parts & repair (`auto-parts`) · **Rail groups:** sell · people · run

## Account

| Field         | Value                  |
| ------------- | ---------------------- |
| Email         | `p06.wes@piggles.test` |
| Tenant id     | —                      |
| Subdomain     | —                      |
| Published URL | —                      |

## The person

Wes Ostrander, 52, he/him. Third-generation garage and parts counter. Two
mechanics, one counter clerk, one apprentice. He knows every part number by
sight and distrusts any system that cannot tell him what is on the shelf **right
now**.

His counter clerk quit in April and took twenty years of undocumented knowledge
with him, which is why Wes is here. He does not want a nicer website. He wants
the shelf to be knowable by someone who is not him.

**What made him look:** he bought 40 of a filter he already had 60 of.

## The business

**Ostrander Auto & Fleet** — a parts counter attached to a four-bay workshop.

- Parts sold **over the counter**, **online**, and **onto workshop jobs**
- Stock lives in **bins**: front counter, back shelves, the mezzanine, the yard
- Buys from three suppliers on **purchase orders**, receives against them, and
  argues about short deliveries
- Some parts are **serial-tracked** (remanufactured units with a core charge)
- Customers search by **vehicle**, not by part name — "will it fit my truck" is
  the only question anyone actually asks
- Three **fleet accounts** buy on 30-day terms with a monthly statement

## Why he is here today

1. "Tell me what is on the shelf and where it is, without me walking out there."
2. "Order from my suppliers without a phone call and a fax."
3. "Let a customer find the part that fits their vehicle themselves."

## Onboarding answers

| Question       | Answer                                                     |
| -------------- | ---------------------------------------------------------- |
| Business name  | `Ostrander Auto & Fleet`                                   |
| Trade          | Car parts & repair                                         |
| What do you do | I sell things · I deal with customers · I work with a team |
| Look           | first shelf option offered for this trade; record which    |

## The data

### Parts

| Part                            | SKU              | Cost    | Price   | Bin     | On hand |
| ------------------------------- | ---------------- | ------- | ------- | ------- | ------- |
| Oil filter, spin-on, 3/4-16     | `FLT-OIL-3416`   | $4.10   | $11.95  | A-01-03 | 84      |
| Fuel filter assembly, inline    | `FLT-FUEL-INL`   | $18.40  | $46.00  | A-01-07 | 22      |
| Air filter, heavy duty panel    | `FLT-AIR-HDP`    | $22.00  | $58.50  | A-02-01 | 16      |
| Serpentine belt, 8-rib, 2180mm  | `BLT-SRP-8R2180` | $26.75  | $69.95  | B-03-02 | 9       |
| Alternator, remanufactured 130A | `ALT-REM-130`    | $148.00 | $395.00 | MEZZ-1  | 4       |
| Starter motor, remanufactured   | `STR-REM-STD`    | $132.00 | $349.00 | MEZZ-1  | 3       |
| Brake pad set, ceramic, front   | `BRK-PAD-CF`     | $31.20  | $84.00  | B-01-04 | 28      |
| Brake rotor, vented 320mm       | `BRK-ROT-320V`   | $44.00  | $112.00 | YARD-2  | 12      |
| Wheel bearing and hub assembly  | `HUB-BRG-ASM`    | $58.00  | $146.00 | B-02-06 | 7       |
| Coolant, 50/50 premix, 1 gallon | `FLD-COOL-1G`    | $9.80   | $24.95  | A-04-01 | 40      |
| Shop rag bundle, 25lb           | `SUP-RAG-25`     | $28.00  | $59.00  | YARD-1  | 6       |
| Wiper blade, 22 inch            | `WPR-22`         | $5.60   | $16.95  | A-03-05 | 33      |

The two remanufactured units are **serial-tracked** and carry a **$75 core
charge** returned when the old unit comes back.

### Bins

`A-01` … `A-04` front counter · `B-01` … `B-03` back shelves · `MEZZ-1`
mezzanine · `YARD-1`, `YARD-2` yard container. One location, many bins — the
plan allows one location, and this is how a real parts room works inside it.

### Suppliers

| Supplier             | Contact      | Terms  | Lead time |
| -------------------- | ------------ | ------ | --------- |
| Kessler Parts Group  | Ana Kessler  | Net 30 | 3 days    |
| Redline Distribution | Sam Oyelaran | Net 30 | 7 days    |
| Cortez Reman Supply  | Beto Cortez  | Net 15 | 10 days   |

### Fleet accounts

| Account                    | Contact         | Terms  | Credit limit |
| -------------------------- | --------------- | ------ | ------------ |
| Halloran Excavating        | Dot Halloran    | Net 30 | $8,000       |
| Cedar Ridge Landscaping    | Miguel Sabatini | Net 30 | $4,000       |
| Tri-County School District | Barb Nyquist    | Net 30 | $15,000      |

### Fitment

At least three vehicles with real part mappings, so a customer can search by
vehicle: **2019 Ford F-250 6.7L**, **2016 Chevrolet Silverado 2500 6.6L**,
**2021 Ram 3500 6.7L**.

## The website

**This list is the definition of done for the site** (CLAUDE.md RULE #8). Every
page real, in Wes's voice, with real photographs — no template sentence left
anywhere, and the whole thing working from the public side.

One question decides everything on this site: **will it fit my truck?** If the
site cannot answer that in two clicks it has failed, however good the rest is.

| Page                        | What is really on it                                                        |
| --------------------------- | --------------------------------------------------------------------------- |
| Home                        | The vehicle selector, above everything else                                 |
| Find parts for your vehicle | Pick year/make/model/engine, see only what fits                             |
| Catalogue                   | By category — filters, brakes, belts, fluids — for people who know the part |
| Product pages               | What it fits, specs, what is on the shelf, core charge explained            |
| The workshop                | Four bays, what they do, book a slot                                        |
| Fleet accounts              | What terms mean, apply, and sign in                                         |
| About                       | Third generation, since when                                                |
| Find us                     | Counter hours, workshop hours, address, phone                               |
| Shipping & returns          | Including the core-charge return, which is not a normal return              |
| Privacy · Terms             | Real, published, linked                                                     |
| 404                         | Offers the vehicle selector                                                 |

**Working end to end:** the vehicle selector genuinely narrowing the catalogue,
buying a filter for a 2019 F-250, a fleet account seeing its own terms once
signed in, stock visible, and a workshop booking.

**Legal.** Run `get_legal_checklist` and close it out. Privacy is always
required, and returns/shipping/refund because parts ship. Scaffolding drafts them; **publishing is the owner's act**
in Content → Legal pages, and the footer links have to actually resolve.

**The look.** Utilitarian and legible — big type, high contrast, greasy-thumb tap targets. Not delicate.

**Also required, as on every site:** a real header and mobile drawer, a footer
carrying hours, address, socials and legal links, per-page title and description
in plain words, a social card that renders, the sitemap, a favicon, a real 404,
and the same name/address/phone everywhere it appears.

## The run

### Act 1 — Sign up and onboard

Spine at speed. The `auto-parts` pack is the largest in the platform — say what
it installed and whether it helped or buried him.

**Done when:** in the console, `industry = 'auto-parts'` confirmed.

### Act 2 — Set the room up

Create the bins before the parts. Then load all twelve parts with cost, price,
SKU and bin. Set the two reman units as serial-tracked with a core charge.

Watch for: whether a bin structure exists at all, whether cost and price are both
first-class, and whether a SKU with hyphens survives search.

**Done when:** twelve parts on hand, each in a known bin.

### Act 3 — Reorder points

Set reorder points that make sense — the belt at 5, the alternators at 2, the oil
filters at 30 — and confirm the software can then tell him what to buy without
him asking each part individually.

**Done when:** a low-stock view exists and is correct against the numbers above.

### Act 4 — Buy from a supplier

Add the three suppliers. Raise a purchase order to **Kessler Parts Group**: 100
oil filters, 24 wiper blades, 12 air filters. Send it.

Then receive it **short**: 100 filters, 24 wipers, and only 8 air filters.

- Stock must move by what arrived, not what was ordered
- The PO must stay open for the 4 missing
- The cost must land on the parts

**Done when:** on-hand is right for all three lines and the short line is visibly
outstanding.

### Act 5 — Serials and cores

Receive two remanufactured alternators from **Cortez Reman Supply**, each with a
real serial number. Sell one over the counter with its core charge. Take the old
core back and refund the $75.

**Done when:** the sold unit's serial is attached to that sale and the core
charge is right in both directions.

### Act 6 — The counter

Three counter sales in a row, as fast as a clerk would:

1. Brake pads and two rotors, cash, walk-in.
2. A serpentine belt on **Halloran Excavating**'s account, on terms.
3. Coolant and rags, card.

**Done when:** all three complete, stock moves, and the account sale sits on
Halloran's balance rather than being taken as cash.

### Act 7 — Fitment on the site

Publish a site where a customer can pick their vehicle and see only parts that
fit it. Map the twelve parts across the three vehicles.

Then, as a stranger on the published site: select the **2019 Ford F-250 6.7L**,
find an oil filter, and buy it.

**Done when:** the vehicle filter narrows the catalogue correctly and the order
completes.

### Act 8 — Fleet terms and the statement

Put three more sales onto fleet accounts across the month. Then:

- Produce a month-end statement for **Halloran Excavating**
- Push **Cedar Ridge** over its $4,000 credit limit and see what happens — a
  refusal, a warning, or nothing at all
- Take a payment against Halloran's balance

**Done when:** the statement is right to the cent and the credit limit does
something.

### Act 9 — The team

Add the counter clerk and the apprentice as users. The apprentice may sell and
look up stock but must not see cost prices or raise purchase orders. Verify by
signing in as the apprentice.

**Done when:** the boundary is verified from the apprentice's own session.

### Act 10 — Monday morning

The three things Wes actually opens the software for:

- What is below its reorder point right now
- What did we sell last week, by value
- Where is `HUB-BRG-ASM` — answered without walking out there

**Done when:** all three answered from the console in under a minute each, or the
friction is filed.

### Act 11 — The count

Count bin `A-01` and find one discrepancy: 79 oil filters on the shelf against 84
in the system. Post the count and confirm the adjustment is recorded with a
reason and a person against it.

**Done when:** the on-hand is 79 and the history explains why.

## What only this persona proves

**Inventory depth**: bins, reorder points, a purchase order received short,
landed cost, serial tracking with a core charge, a physical count with a
discrepancy — plus **fitment search** on the public site, fleet accounts on terms
with a credit limit and a statement, and a restricted team member who cannot see
cost.

## Verification

| Check                                                       | Result |
| ----------------------------------------------------------- | ------ |
| Bins exist and a part's location is answerable from a desk  | —      |
| Short receipt moves stock by what arrived; PO stays open    | —      |
| Cost lands on the part and margin is visible                | —      |
| Serial follows the unit into the sale; core refunds cleanly | —      |
| Account sale sits on the balance, not in the till           | —      |
| Vehicle search narrows the public catalogue correctly       | —      |
| Credit limit produces a visible consequence                 | —      |
| Statement is correct to the cent                            | —      |
| Apprentice cannot see cost prices — verified as her         | —      |
| Count posts an adjustment with a reason and an author       | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Standing checks

The run-wide list is in [CLAUDE.md](CLAUDE.md). These are Wes's instances of
it, and they are worked into the acts rather than saved for the end.

**Wrong moves.** Receive the Kessler PO a second time. Post the `A-01` count
twice. Sell a serial that has already been sold. Delete a part that has stock on
hand.

**Dates.** The Net 30 statement period boundary. A purchase order past its stated
lead time.

**Money edge.** The $75 core charge out and back. Landed cost spread across a
receipt that arrived short. Margin after the cost price moved.

**Buyer's side.** The fitment shopper — order a filter for their F-250, then find
that order's status a week later.

**Someone else's business.** Deep-link a Kanto Trade Supply price list id. Two
trade businesses in one database is the most tempting leak in the roster.
Nothing must come back.

**Without a mouse.** Look a part up and sell it over the counter, keyboard
only — this is a till, and a till is keyboard-first.

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
