# 454 — A code on one screen, a shelf nobody stocked

**Status:** fixed
**Severity:** major
**Found by:** driving [453] on screen as P03 · Juniper Row
**Surface:** Selling › Returns › a return › Send the replacement
**Filed:** 2026-09-09

Two defects, found in the first two minutes of walking the flow [453] built. Both
were invisible to every check that passed on it.

## 1. Her own screen said "usps"

Devi settled a swap, chose USPS from the list, and typed the tracking number.
The Parcels card came back reading:

```
The replacement going out          On its way to them
usps
9405 5118 9922 3197 4284 90
```

Not "USPS". The stored code, unchanged, on a card built for a business owner.
The same value rode the event and reached the customer:

```json
"replacementCarrier": "usps"
```

**This exact defect was found and fixed on this platform already**, for the
ordinary shipping confirmation. The fix is a map in
`commerce-schemas/src/shipping.ts` whose comment says so in as many words:

> `carrier` is stored as a lowercase code … and must never be shown to anybody in
> that form. It was: the shipping-confirmation email bound `{{shipping.carrier}}`
> straight to the column, so a customer was told their parcel went by "usps".

[453] added a SECOND place holding the same fact and did not read that map. That
is not a new bug, it is the old one in a new place, a day later — the shape
[[feedback_a_fix_leaves_its_neighbour_behind]] is about.

Three display points now go through `carrierLabel`: both consoles'
`shipmentCarrierName`, and `replacementCarrier` in the customer's email. A
courier somebody TYPED is not a code, is not in the map, and comes back exactly
as they typed it — which is what lets one call cover both kinds of answer.

The picker was a fourth copy of the words. `carriers.ts` held its own labels, so
it said "Someone else" where the same map said "Another courier" — a drift
already live on the ORDER handover screen before this. It now takes its names
from the map and only says which codes may be picked.

The schema comment was wrong too. It read "The carrier as a PERSON names it",
which is what a reader would build against and is not what the column holds.

## 2. "One came back on the shelf" — nothing did

The toast after settling a swap read:

> One came back on the shelf, one went out with its tracking number, and no money
> moved.

Asking the database what physically moved:

```
delta | reason | note
   -1 | sale   | Replacement sent for return ecb0f558…
```

**One movement.** Nothing came back on any shelf. There were zero inspections on
that return — and goods go back on a shelf only once an inspection says they are
fit to sell.

The sentence was unconditional. It was true for a shop that checks the goods
first and false for one that does not, and the console could not tell the
difference because `settleExchange` returned `{ returnId }` and nothing else. A
screen that cannot know guesses, and a guess printed as fact is what a shop then
plans around.

Worse, it contradicted the pane behind it in the same second. Directly below the
toast, [452]'s card said:

> This return is finished, but nothing was written down about the goods
> themselves.

`settleExchange` now returns `unitsRestocked` — the name a disposition already
uses for this fact, rather than a second name for it — counted past the guard
that skips a line with nowhere to go. `swapSettledMessage` builds the sentence
from it: with a count it leads with the shelf, and with zero it says the
replacement went out and **nothing has been written down yet about what came
back**, which is both true and the next thing to do.

While typing the result type, `SettleExchangeBody` turned out never to have
declared the `shipment` field the modal had been sending since [453]. It worked —
TypeScript does not excess-check a spread — so the type was simply wrong about
what the screen sends.

## Where the code changed

- `wizeworks/packages/commerce/src/services/return-service.ts` — `unitsRestocked`
- `wizeworks/services/api-rest/src/lib/email-data.ts` — `carrierLabel` on the
  replacement carrier
- `wizeworks/packages/db/prisma/schema/43-commerce-returns.prisma` — the comment
  now says what the column holds
- `{piggles,sparx}/apps/workbench/surfaces/commerce/carriers.ts` — names from the
  shared map
- `{piggles,sparx}/apps/workbench/surfaces/commerce/return-shipment.ts` —
  `shipmentCarrierName` through the map, plus `swapSettledMessage`
- `{piggles,sparx}/apps/workbench/surfaces/commerce/returns-data.ts` —
  `SettleExchangeResult`, and the `shipment` the body was already sending
- the two swap modals — the measured sentence

## Verification

Driven on screen as Devi, twice, and both halves confirmed against the database.

**A swap with no check recorded** (return `ecb0f558`): one movement, `-1 sale`.
The toast now says the replacement went out and nothing has been written down yet
about what came back.

**A swap checked fit to resell first** (return `526b92cc`, opened from order
O-000015 through the ordinary form, approved, received, checked, settled): two
movements, `+1 return` and `-1 sale`. The toast says "One came back on the shelf."

The Parcels card reads **USPS** on the same row that read "usps" before.

Every new guard proved red on its own:

| removing                                   | reddens                                             |
| ------------------------------------------ | --------------------------------------------------- |
| `carrierLabel` from `shipmentCarrierName`  | 1 — "never shows a shop the code it stored"         |
| the zero branch of `swapSettledMessage`    | 1 — "does not claim a shelf nobody put anything on" |
| `carrierLabel` in `email-data`             | 1 — `expected 'usps' to be 'USPS'`                  |
| the inbound/outbound split in `email-data` | 1 — the post-it-back page becomes the replacement's |

That last one was written wrong first. Its first version asserted the outbound
tracking number, which the naive "take the newest label" reader also returns —
so it passed with the bug installed. **A test that cannot go red is not a test**,
and the only reason this was caught is that every guard here is proved red
separately.

## Rating effect

`Selling › Returns › a return` — recorded in [rating.md](../rating.md).
