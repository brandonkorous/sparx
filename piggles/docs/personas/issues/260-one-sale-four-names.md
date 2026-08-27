# 260 — One sale, four names

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 11 — Monday morning, "what sold"
**Surface:** mypiggles › Money, Sell › How selling is going, the order itself, and three more
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi has taken exactly one order that did not come through her website: O-000001,
Ravi Naidoo, one Marlow Knit, $96.00, rung up at a market stall
(`channel = 'admin'`, `source = 'till'`).

Reading two screens on the same morning:

| screen                         | what it called that one order |
| ------------------------------ | ----------------------------- |
| Money › Where money comes from | **In person or by phone**     |
| Sell › How selling is going    | **Added by your team**        |

Same order. Same $96.00. Two names, and no way to tell from either screen that
they are the same thing.

It was worse than two. Six files each carried their own map:

| channel       | order pane               | selling report         | Money                     | price list                   | baskets              | checkouts            |
| ------------- | ------------------------ | ---------------------- | ------------------------- | ---------------------------- | -------------------- | -------------------- |
| `storefront`  | Your website             | Your website           | Your website              | **Your online store**        | Your website         | Your website         |
| `b2b_portal`  | **Trade portal**         | Wholesale portal       | Wholesale portal          | **Your wholesale portal**    | **Trade portal**     | **Trade portal**     |
| `admin`       | **Entered by your team** | **Added by your team** | **In person or by phone** | **Orders you enter by hand** | Entered by your team | Entered by your team |
| `marketplace` | Marketplace              | **Marketplaces**       | (the marketplace's name)  | —                            | —                    | —                    |

**Four names for `admin`. Three for `b2b_portal`. Two for `storefront`.**

## What should have happened

A fact about an order has one name.

## Why it matters

- **She cannot reconcile her own numbers.** "Added by your team, 1 order, $96" on
  one screen and "In person or by phone, 1 order, $96" on another either are the
  same sale or are two sales that happen to match exactly. Nothing on either
  screen settles it.
- **Two of the four names are false for her.** She has no team. "Entered by your
  team" and "Added by your team" describe a business she does not run — and it
  is her own market-stall sale.
- It compounds with every channel she adds. A shop that starts selling wholesale
  meets "Trade portal", "Wholesale portal" and "Your wholesale portal" on three
  screens for one thing.

## Where it lives

Six `channelLabel`s, in six files, none aware of the others:

```
surfaces/commerce/order-words.ts        channelLabel(order)
surfaces/commerce/reports-data.ts       channelLabel(channel)
surfaces/commerce/price-list-detail.tsx channelLabel(channel)     (file-local)
surfaces/commerce/carts-data.ts         cartChannelLabel(channel)
surfaces/commerce/checkout-data.ts      checkoutChannelLabel(channel)
surfaces/finance/format.ts              channelLabel(channel, source)
```

Each was written deliberately. Three carry a comment explaining why the words are
local — _"Kept local — these are the words an owner uses, not the stored slugs"_ —
and every one of those comments is right about the words and wrong about the
copy: the reason to write them in plain language is not a reason to write them
six times.

**The console had already learned this, one function away.** Directly below the
Money pane's `channelLabel` sits:

> `methodLabel` — "How the money was taken, in plain words. **One vocabulary for
> the whole console** — this pane used to spell a cheque 'Check' and call a cash
> sale 'Recorded by hand', both of which disagreed with the order pane."

Payment method was consolidated for exactly this failure. Channel, the field
right beside it, was left with six copies.

## The fix

One `channelLabel` in
[lib/console/channels.ts](../../../apps/workbench/lib/console/channels.ts), and
all six call sites read it. `cartChannelLabel` / `checkoutChannelLabel` keep
their names and delegate, because their callers are asking a genuinely narrower
question and the shared answer is the same one.

Where the six disagreed, the word that says what HAPPENED won:

- `storefront` → **Your website**. It is a website whether or not she sells from
  it — and "store" is the term this platform renamed away from.
- `b2b_portal` → **Wholesale portal**, matching the nav, which says Wholesale.
- `admin` → **Added by hand**. All four old names were wrong in some business:
  two invent a team a sole trader does not have, and "In person or by phone"
  claims to know how the order arrived when the channel only knows it did not
  come through the website. "Added by hand" is true of a till sale, a phoned
  order and an emailed one alike.
- `pos` kept its own **At the till**, so a real till integration stays distinct
  from an order typed in afterwards.

A marketplace order still names the marketplace — "Marketplace" alone tells a
seller nothing they can act on — and `sparx_market` keeps the written Piggles
string (_"Another marketplace"_) rather than a hardcoded word, so the boundary in
piggles/CLAUDE.md holds through the consolidation: no Piggles surface may print
another company's product name, and the fallback would have printed the slug.

## Confirmed

Re-read all three screens as Devi:

```
Money › Where money comes from     Added by hand   1   $30.00   11%
Sell › How selling is going        Added by hand   14.4%   1 order   $96.00
Order O-000001                     Placed Aug 24, 2026 · Added by hand · Juniper Row
```

One sale, one name.

## Left alone deliberately

The two "share" figures still differ — 11% on Money, 14.4% on the selling report
— because Money divides what was RECEIVED ($30 of $96 has come in) and the report
divides what was SOLD. Both are labelled, both are correct, and they answer two
different questions that happen to share a word. That is a real reading hazard
and a bigger change than a label: it needs the column headings rethought, not a
rename. Not folded into this fix.

`wizeworks/services/api-rest/src/lib/analytics/metrics/*` carries its own
`admin: 'Added by your team'` for the analytics API. Left untouched — it serves
both brands, and changing sparx's dashboard wording is not this issue's business.
Nothing in the Piggles console renders it.

## Related

[[feedback_storefront_terminology]] — "Your online store" was the last live use
of the retired word in this area.

Same family as [257]: two screens, one record, two answers about it.

## Rating effect

Where money comes from and How selling is going, in [rating.md](../rating.md).
Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
