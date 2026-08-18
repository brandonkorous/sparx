# P08 — Abel Mwangi · Kanto Trade Supply

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Wholesale & trade supply (`wholesale`) · **Rail groups:** sell · money · people

## Account

| Field         | Value                   |
| ------------- | ----------------------- |
| Email         | `p08.abel@piggles.test` |
| Tenant id     | —                       |
| Subdomain     | —                       |
| Published URL | —                       |

## The person

Abel Mwangi, 45, he/him. Runs a janitorial and catering supply wholesaler with
six staff and 130 trade accounts. Nobody who buys from him pays list price and
nobody pays with a card — everything is a negotiated rate on terms.

He has an ancient trade-counter system that does pricing correctly and cannot
show a customer anything. His customers keep asking for a login where they can
see **their** price and reorder last month's list.

**What made him look:** a customer moved to a competitor purely because they
could order online at 6am.

## The business

**Kanto Trade Supply** — B2B only. No consumer sales, no walk-ins.

- **Three price tiers** — Standard, Trade, Distributor — and per-account
  overrides on top of them
- **Volume breaks** on most lines: buy 12, buy 48, buy 144
- Accounts have a **credit limit** and **Net 30**; some are on stop
- Orders over **$2,500** need his approval before they leave
- Sells in **cases and pallets**, not units — a case of 24, a pallet of 40 cases
- The customer's buyer places the order; the customer's **accounts person** pays
  the invoice, and they are different people on the same account

## Why he is here today

1. "My customers log in and see their own price."
2. "Big orders stop at my desk before they ship."
3. "Statements and terms without a phone call."

## Onboarding answers

| Question       | Answer                                                   |
| -------------- | -------------------------------------------------------- |
| Business name  | `Kanto Trade Supply`                                     |
| Trade          | Wholesale & trade supply                                 |
| What do you do | I sell things · I invoice people · I deal with customers |
| Look           | first b2b-shelf option; record which                     |

## The data

### Products, with list price and unit of sale

| Product                                 | SKU            | Unit        | List price |
| --------------------------------------- | -------------- | ----------- | ---------- |
| Blue roll, 2-ply centrefeed             | `PPR-BLU-CF`   | case of 6   | $42.00     |
| Bin liners, heavy duty 90L              | `BAG-HD-90`    | case of 200 | $58.00     |
| Multi-surface sanitiser concentrate, 5L | `CHM-SAN-5L`   | each        | $34.50     |
| Floor degreaser, 5L                     | `CHM-DEG-5L`   | each        | $39.00     |
| Nitrile gloves, powder-free, box of 100 | `PPE-NIT-100`  | case of 10  | $88.00     |
| Catering foil, 450mm × 75m              | `CAT-FOIL-450` | case of 6   | $47.00     |
| Compostable takeaway box, 3-compartment | `CAT-BOX-3C`   | case of 300 | $96.00     |
| Paper cups, 12oz double wall            | `CAT-CUP-12`   | case of 500 | $112.00    |
| Mop head, kentucky 16oz                 | `EQP-MOP-16`   | each        | $14.20     |
| Janitorial cart, 3-shelf                | `EQP-CRT-3`    | each        | $289.00    |
| Hand soap, foaming refill 1L            | `CHM-SOAP-1L`  | case of 6   | $51.00     |
| Wall dispenser, foaming soap            | `EQP-DSP-FM`   | each        | $32.00     |

### Tiers

| Tier        | Off list | Who                         |
| ----------- | -------- | --------------------------- |
| Standard    | 0%       | new accounts, first 90 days |
| Trade       | 12%      | most accounts               |
| Distributor | 22%      | five accounts by volume     |

**Volume breaks**, applied after tier: 12+ = extra 3%, 48+ = extra 6%, 144+ = extra 9%.

**Overrides** that must beat both: `CHM-SAN-5L` at a flat $24.00 for Hollis
Facilities; `CAT-CUP-12` at $92.00 for Brightside Catering.

### Accounts

| Account                 | Tier        | Credit limit | Terms  | Buyer             | Accounts contact  |
| ----------------------- | ----------- | ------------ | ------ | ----------------- | ----------------- |
| Hollis Facilities Group | Distributor | $25,000      | Net 30 | Yvonne Achterberg | Peter Ng          |
| Brightside Catering Co. | Trade       | $12,000      | Net 30 | Callie Brightside | Callie Brightside |
| Northgate Hotels        | Distributor | $40,000      | Net 45 | Idris Mahmoud     | Fenella Okonjo    |
| Two Rivers Cleaning     | Trade       | $6,000       | Net 30 | Danny Two Rivers  | Danny Two Rivers  |
| Sablewood Care Homes    | Standard    | $3,000       | Net 30 | Meredith Sable    | Meredith Sable    |

Load at least ten more accounts so the list pages and search is worth using.

### The approval rule

Any order over **$2,500** waits for Abel. Nothing over that ships without him.

## The run

### Act 1 — Sign up and onboard

Spine at speed. Report what the `wholesale` starter installs — this is the one
trade whose starter is expected to bring B2B configuration with it.

**Done when:** in the console, `industry = 'wholesale'` confirmed.

### Act 2 — Products in cases

Load all twelve with their real unit of sale. A case of 200 liners is one
sellable thing, not 200 — check that the unit is expressible and shows on the
customer's side.

**Done when:** twelve products priced, with units that read correctly.

### Act 3 — The pricing ladder

Build all three tiers, the three volume breaks, and the two account overrides.
Then check the resolved price for these four cases **by hand** before believing
any screen:

| Case                                               | Expected     |
| -------------------------------------------------- | ------------ |
| Two Rivers (Trade), 4 × `CAT-FOIL-450`             | $41.36 each  |
| Northgate (Distributor), 60 × `PPE-NIT-100`        | $64.42 each  |
| Hollis (Distributor + override), 20 × `CHM-SAN-5L` | $24.00 each  |
| Sablewood (Standard), 2 × `EQP-CRT-3`              | $289.00 each |

Recompute these from the rules above during the run; if the screen disagrees with
the arithmetic, the screen is wrong and it is a **blocker**.

**Done when:** all four match, or the mismatch is filed with both numbers.

### Act 4 — Accounts, limits and terms

Create the five accounts with their tiers, limits, terms and **both contacts**.
Confirm a buyer and an accounts person can exist on one account without
overwriting each other.

**Done when:** five accounts exist with two named people each where the data says so.

### Act 5 — The trade site

Publish a site that is **not a consumer shop**: no prices to the public, a "trade
accounts only" front, an application form for new accounts, and a login for
existing ones.

**Done when:** a signed-out stranger sees no prices, and the application form
works.

### Act 6 — Be the customer's buyer

From a clean browser, as **Yvonne Achterberg** of Hollis Facilities:

1. Log in to the trade side of the published site.
2. Confirm the prices shown are Hollis's — including the $24.00 override.
3. Order 20 sanitiser, 10 cases of blue roll, 6 cases of nitrile gloves.
4. Put it on account rather than paying by card.

**Done when:** the order is placed on terms at the right prices, by the right
person.

### Act 7 — Approval

Place a second order as Northgate that exceeds **$2,500**.

- It must **not** ship
- It must appear in Abel's approvals queue with the reason
- Reject it, then have the buyer amend and resubmit
- Approve the amended one

**Done when:** the rule held in both directions, and the buyer was told what
happened.

### Act 8 — Quote, order, invoice

Sablewood asks for a price on 40 janitorial carts. Build a quote with a special
rate, send it, have it accepted, and convert it to an order without retyping.
Invoice it on Net 30.

**Done when:** quote → order → invoice, with the special rate surviving all three
hops.

### Act 9 — Credit

- Push **Two Rivers** past its $6,000 limit and confirm what stops
- Put **Sablewood** on stop and try to order as them
- Take a $4,000 payment against Hollis and watch the available credit move

**Done when:** each produces a visible, correct consequence.

### Act 10 — Month end

Produce statements for all five accounts. One must show an opening balance,
invoices, a payment and a closing balance that adds up. Chase the overdue one.

**Done when:** at least one statement is verified line by line to the cent.

### Act 11 — Reorder

As Yvonne again: reorder last month's list in one action from the trade site.
That is the feature the competitor won on.

**Done when:** the repeat order is placed without rebuilding the basket, or the
absence is filed.

## What only this persona proves

**B2B pricing that resolves**: three tiers, volume breaks and per-account
overrides stacking in the right order and agreeing with hand arithmetic. Plus a
signed-in trade site with per-account prices, an approval threshold that holds,
credit limits and an account on stop, quote → order → invoice with a negotiated
rate, statements that balance, and two different people on one account.

## Verification

| Check                                                      | Result |
| ---------------------------------------------------------- | ------ |
| All four resolved prices match hand arithmetic             | —      |
| Public site shows no prices to a signed-out visitor        | —      |
| Trade login shows THAT account's prices, override included | —      |
| Order over $2,500 stops for approval and cannot escape it  | —      |
| Reject → amend → approve round-trips and tells the buyer   | —      |
| Negotiated quote rate survives into the order and invoice  | —      |
| Credit limit and account-on-stop both stop something       | —      |
| Statement balances line by line                            | —      |
| Reorder-last-month works in one action                     | —      |
| Buyer and accounts contact coexist on one account          | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Issues found

| #   | Severity | What |
| --- | -------- | ---- |
| —   | —        | —    |
