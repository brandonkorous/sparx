# Piggles — the persona test roster

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

Ten businesses, ten owners, ten full runs from "never heard of it" to a published
site a stranger can buy from. How to run one is in [CLAUDE.md](CLAUDE.md); the
defects they find are one file each in [issues/](issues/).

## Why ten, and why these ten

The count is not the point — the **allocation** is. Ten variations on "a shop
that sells things" would re-walk the same signup spine nine times and stop
finding anything after the third.

So nine personas are **one per trade the onboarding picker offers**. That answer
is not cosmetic: it selects an industry starter (`industry-starters.ts`) and a
sample-data pack (`db/src/sample-data/packs/*`), and each pair is real code that
nothing else opens. One persona per trade means every pack gets seen by a person
exactly once.

The tenth is not a trade at all. It is the **conditions** run — capacity limits,
seat expansion, a custom domain, trial to card, password reset, a phone-only
owner — and it needs a mature business underneath it, so it goes last.

## The roster

| #   | Persona                                  | Business               | Trade          | Rail groups           | Status      |
| --- | ---------------------------------------- | ---------------------- | -------------- | --------------------- | ----------- |
| P01 | [Marisol Vega](01-thistle-and-rye.md)    | Thistle & Rye          | Food & drink   | web · sell · money    | not started |
| P02 | [Nia Okafor](02-halo-and-hem.md)         | Halo & Hem             | Beauty & salon | people · web · money  | not started |
| P03 | [Devi Raman](03-juniper-row.md)          | Juniper Row            | Clothing       | sell · web · people   | not started |
| P04 | [Tomás Herrera](04-herrera-and-co.md)    | Herrera & Co.          | Professional   | money · people · web  | not started |
| P05 | [Priya Anand](05-wildwater-climbing.md)  | Wildwater Climbing     | Fitness        | people · sell · money | not started |
| P06 | [Wes Ostrander](06-ostrander-auto.md)    | Ostrander Auto & Fleet | Car parts      | sell · people · run   | not started |
| P07 | [Lena Fischer](07-circuit-and-coil.md)   | Circuit & Coil         | Electronics    | sell · run · web      | not started |
| P08 | [Abel Mwangi](08-kanto-trade-supply.md)  | Kanto Trade Supply     | Wholesale      | sell · money · people | not started |
| P09 | [Rosalind Pike](09-the-marrow-review.md) | The Marrow Review      | Something else | web · people          | not started |
| P10 | [Ida Brandt](10-brandt-and-sons.md)      | Brandt & Sons Joinery  | Something else | web · money · run     | not started |

Keep this table current — it is the only place the ten are visible at once.

## What each one is the only proof of

| #   | Nothing else in the roster covers this                                                        |
| --- | --------------------------------------------------------------------------------------------- |
| P01 | **The spine, deeply.** Signup → furnish → handoff → first run, verified row by row in the DB  |
| P02 | A **service** business with almost no products: resources, hours, deposits, no-shows          |
| P03 | A **variant matrix**, collections, discounts, a return and a refund, a broadcast to a segment |
| P04 | A business that **sells nothing** — quotes, retainers, terms, a lead from a contact form      |
| P05 | **Recurring money** — memberships, class capacity, waitlists, pause, cancel                   |
| P06 | **Inventory depth** — suppliers, POs, receiving, bins, serials, fitment search on the site    |
| P07 | **After the sale** — warranty, RMA, a dropship line, automations, a BYOK AI connection        |
| P08 | **B2B** — price tiers, credit limits, approval rules, net terms, a trade login on the site    |
| P09 | **Content only.** No commerce module used at all. The `generic` fallback pack                 |
| P10 | **The commercial edges** — every capacity meter, seat expansion, custom domain, trial to card |

## Run order

**P01 first, P10 last.** In between, order is free, but this sequence front-loads
the structurally different spines:

`P01 → P09 → P04 → P02 → P03 → P05 → P08 → P06 → P07 → P10`

P09 and P04 come early on purpose: a content-only business and a service-only
business are where "everything assumes you sell products" surfaces, and it is
cheaper to learn that before six catalogues have been typed in.

## Coverage this roster deliberately does not have

Say these out loud rather than discovering them as gaps later:

- **`florist` is unreachable.** A florist starter and a florist sample pack both
  ship, and meetpiggles.com advertises florists by name — but the onboarding
  picker offers nine trades and florist is not one of them. Filed as
  [issues/001](issues/001-florist-trade-unreachable.md).
- **`generic` has a pack but no starter.** P09 and P10 both take "Something
  else", so whatever the fallback does gets seen twice, by two different
  businesses.
- **A second brand's tenant.** Nothing here checks that a sparx tenant is
  unaffected; `check:deletability` and `check:boundaries` are that guarantee.
- **Load.** Ten businesses is a correctness exercise, not a performance one.
- **Real payment capture.** Stripe is in test mode; a card is entered in P10 and
  nothing here proves a payout.
