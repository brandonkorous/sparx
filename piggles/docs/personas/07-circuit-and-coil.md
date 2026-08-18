# P07 — Lena Fischer · Circuit & Coil

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Electronics & tech (`electronics`) · **Rail groups:** sell · run · web

## Account

| Field         | Value                   |
| ------------- | ----------------------- |
| Email         | `p07.lena@piggles.test` |
| Tenant id     | —                       |
| Subdomain     | —                       |
| Published URL | —                       |

## The person

Lena Fischer, 33, she/her. Built a hobby into a business selling repair kits and
refurbished audio gear. Works alone with a packing bench in a garage and a
part-time packer on Fridays.

She is here for the **after** — the sale is easy, the warranty claim three months
later is what eats her week. She also wants the boring repetitive things to stop
needing her: the low-stock email, the tag on a repeat buyer, the review request
after delivery.

**What made her look:** she spent a Saturday reconciling which serial numbers
were still inside their warranty window.

## The business

**Circuit & Coil** — repair parts, tools and refurbished units, sold online.

- **Serial-tracked refurbs** with a 12-month warranty; everything else is 30-day
- Sells **repair kits she assembles** from components she stocks
- One product line is **dropshipped** direct from a supplier — she never touches it
- **RMAs are constant**: about one in fifteen units comes back
- Wants an **AI assistant** to draft product descriptions — with her own key

## Why she is here today

1. "Know which serial is in warranty without a spreadsheet."
2. "A return that does not need four emails."
3. "Stop doing the same five things by hand every week."

## Onboarding answers

| Question       | Answer                                                |
| -------------- | ----------------------------------------------------- |
| Business name  | `Circuit & Coil`                                      |
| Trade          | Electronics & tech                                    |
| What do you do | I sell things · I work with a team · I need a website |
| Look           | first retail-shelf option; record which               |

## The data

### Stock

| Product                                       | SKU              | Price   | Tracking     | On hand |
| --------------------------------------------- | ---------------- | ------- | ------------ | ------- |
| Refurbished stereo amplifier, 40W             | `RFB-AMP-40`     | $289.00 | serial, 12mo | 6       |
| Refurbished cassette deck, serviced           | `RFB-DECK-SVC`   | $215.00 | serial, 12mo | 4       |
| Recap kit — 1980s Japanese amplifier          | `KIT-RECAP-JP80` | $64.00  | assembled    | 12      |
| Recap kit — vintage receiver, large           | `KIT-RECAP-LRG`  | $98.00  | assembled    | 8       |
| Electrolytic capacitor set, 40 pieces         | `CMP-CAP-40`     | $28.00  | component    | 60      |
| Precision screwdriver set, 24 bit             | `TL-SCR-24`      | $34.50  | component    | 25      |
| Temperature-controlled soldering station, 60W | `TL-SOLD-60`     | $119.00 | component    | 10      |
| Desoldering braid, 3-pack                     | `CMP-BRD-3`      | $11.00  | component    | 45      |
| Anti-static mat, 600×400mm                    | `SUP-MAT-64`     | $39.00  | **dropship** | n/a     |
| Bench power supply, 30V 5A                    | `SUP-PSU-305`    | $164.00 | **dropship** | n/a     |

### The kits she assembles

`KIT-RECAP-JP80` = 1 × `CMP-CAP-40` + 1 × `CMP-BRD-3` + packaging.
Building one must consume the components; she must be able to ask **how many can
I build right now**.

### Suppliers

| Supplier             | Role                      | Terms     |
| -------------------- | ------------------------- | --------- |
| Halvorsen Components | capacitors, braid, tools  | Net 30    |
| Ridgeway Direct      | **dropship** — mats, PSUs | per order |

### Customers

At least 20, including:

- **Ingrid Sørensen** — `ingrid.s@example.test` — buys a refurb amp, claims warranty at month 4
- **Cody Whitfield** — `cody.w@example.test` — four orders in six weeks, should become a repeat buyer automatically
- **Ahmed El-Sayed** — `ahmed.elsayed@example.test` — buys a dropshipped PSU
- **Rae Nakamura** — `rae@example.test` — returns a kit unopened, wants a refund

### Automations she wants

1. Stock of any component below 10 → email Lena
2. An order paid → tag the customer, and after the fourth order tag them "repeat"
3. Order marked delivered → wait 7 days → ask for a review
4. A refurb sold → start its 12-month warranty clock

## The run

### Act 1 — Sign up and onboard

Spine at speed. Report what the `electronics` starter and pack install.

**Done when:** in the console, `industry = 'electronics'` confirmed.

### Act 2 — The catalogue, three kinds of thing

Load all ten. Three different behaviours must be expressible:

- Serial-tracked with a warranty period
- Assembled from components, with a buildable quantity
- Dropshipped, with no stock of her own

**Done when:** all three kinds exist and behave differently where they should.

### Act 3 — Build a kit

Define the recipe for `KIT-RECAP-JP80`, then build five. Component stock must
fall; the kit's stock must rise. Ask the software how many more she could build
and check the answer by hand.

**Done when:** the arithmetic is right in both directions.

### Act 4 — The dropship line

Set up **Ridgeway Direct** as the dropship supplier for the mat and the PSU.
Confirm those two products can be sold without her holding stock, and that a sale
produces something the supplier would act on.

**Done when:** a dropshipped order routes to the supplier and its margin is
visible.

### Act 5 — The shop

Publish a site that sells all ten, with the refurbs shown as one-of-a-kind
serial-numbered units, warranty terms stated where a customer will read them, and
a real returns policy page.

**Done when:** published and buyable.

### Act 6 — Be four customers

Clean browser, published site:

1. **Ingrid** buys a refurbished amplifier — note the serial she receives.
2. **Ahmed** buys a bench power supply (the dropshipped one).
3. **Rae** buys a recap kit.
4. **Cody** places four small orders in a row.

**Done when:** four orders exist, and Cody's fourth has done whatever act 9's
automation says it should.

### Act 7 — Pack and ship

Pick, pack and ship all four. The amplifier's shipment must carry its serial.
Mark one delivered.

**Done when:** every order is shipped with tracking and the serial is attached to
the right one.

### Act 8 — The RMA, which is the point of this persona

Two returns, deliberately different:

- **Rae** returns an unopened kit at day 6 — a straight refund, stock back on the
  shelf, money back to the card
- **Ingrid** claims warranty at month 4 on the amplifier — the system must know
  the unit is in warranty **from its serial**, accept it back, record the fault,
  and either replace or refund

Then attempt a third: a warranty claim on a component bought 60 days ago, which
should be refused because the 30-day window has passed.

**Done when:** all three outcomes are correct, and the refusal explains itself in
words a customer could read.

### Act 9 — Automations

Build all four automations from her list. Then make each one fire for real:

- Drop `CMP-BRD-3` below 10 by selling some
- Watch Cody's fourth order tag him
- Move a delivered order's clock forward, or verify the schedule exists
- Confirm the warranty clock started at the sale, not at the listing

**Done when:** each automation has a run you can point at, or the failure is
filed. An automation that exists and never ran is not verified.

### Act 10 — Her own AI key

Set up an AI connection using her own provider key and use it to draft a product
description for the cassette deck.

**Check hard:** the credential must be hers and stored encrypted; nothing on this
screen may imply Piggles supplies the intelligence. If any path uses a
platform-level key, that is a blocker (see the BYOK rule).

**Done when:** a description was drafted with her key, or the gap is filed.

### Act 11 — Monday

What sold, what is nearly out, what is still open as an RMA, and which serials
are in warranty this month.

**Done when:** four answers, each correct.

## What only this persona proves

The **after-sale**: serial-bound warranty windows, a warranty claim that the
system knows is valid, a refusal that explains itself, and an RMA that returns
both stock and money. Plus kit assembly with a buildable quantity, a dropship
supplier line, four automations that actually fired, and **BYOK AI** — the one
persona that proves Piggles never pays for the model.

## Verification

| Check                                                        | Result |
| ------------------------------------------------------------ | ------ |
| Serial, assembled and dropship products behave differently   | —      |
| Building a kit consumes components; buildable count is right | —      |
| Dropshipped sale reaches the supplier and shows its margin   | —      |
| Serial travels onto the shipment                             | —      |
| Warranty validity determined from the serial, not by hand    | —      |
| Out-of-window claim refused with a readable reason           | —      |
| Refund returns stock and money correctly                     | —      |
| All four automations have a real run recorded                | —      |
| AI uses HER key; nothing suggests a platform model           | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Issues found

| #   | Severity | What |
| --- | -------- | ---- |
| —   | —        | —    |
