# 007 — She said "Food & drink" and was offered skincare, gym kit and a stationery shop

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 2
**Surface:** getpiggles › Set up your business › How should it look?
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran P01 act 2 — picked "Food & drink" and the shelf came back Vegan · Bistro · Pizzeria · **Café** · Sushi, and all nine trades now produce eight distinct shelves instead of three
**Blocked on:** —

## What happened

Marisol answers the second question honestly — **Food & drink** — and scrolls to
"How should it look?". Underneath it sits her shelf of five:

| Offered to a bakery    | What it actually is                                       |
| ---------------------- | --------------------------------------------------------- |
| Editorial Grid         | "a magazine that publishes and sells"                     |
| Luxe Minimal           | "premium skincare, beauty and wellness brands"            |
| Bold Athletic          | "performance and athletic apparel brands"                 |
| Stationery & Gifts     | "a playful stationery & gifts shop"                       |
| Coffee Roaster (Craft) | a craft coffee roaster — the only one within a mile of it |

She just told it she runs a bakery and café. Four of the five answers are other
people's businesses, and none of them is hers.

Two things underneath that, both worse than the first look suggests:

**Nine trades were only three shelves.** Cycling every option in the picker:

| Trade                                               | Shelf it got                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Food & drink · Clothing                             | editorial-grid · luxe-minimal · bold-athletic · stationery · coffee-craft            |
| Beauty & salon · Professional · Fitness · Car parts | salon-editorial · salon-modern · barber-heritage · barber-modern · restaurant-bistro |
| Wholesale                                           | the b2b five                                                                         |

A garage, a gym, a salon and an accountant were shown the same four hairdressers
and a bistro. Answering the question changed almost nothing, which makes the
question a formality — and a person who notices that stops trusting the next one.

**The right template was unreachable.** The catalog holds **169** templates, and
**sixteen** of them are food: `restaurant-cafe`, `restaurant-bistro`,
`restaurant-pizzeria`, `retail-coffee-modern`, `retail-chocolate` and more.
`restaurant-cafe` is described as a bakery and counter café — it is _literally
Thistle & Rye_. A food business could never be shown it, because it is filed
under the `services` vertical and `food` was pinned to `retail`.

## What should have happened

The question "what kind of business is it?" changes what she is offered, in a way
she can see. She does not need the perfect template — she needs the shelf to
look like it heard her.

## How to reproduce

Every time:

1. `localhost:3021/signup`, create an account, land on onboarding.
2. Pick **Food & drink**.
3. Scroll to "How should it look?" — five templates, four for other trades.
4. Change the trade to Fitness, then to Car parts & repair. The five do not move.

## Why it matters

This is the last screen before the product builds her whole site, and the
template decides what she walks into. Picking "Luxe Minimal" because it was the
least wrong of five leaves a bakery wearing a skincare brand's site, and the
recovery from that is rebuilding the site by hand — the exact job she came here
to avoid.

It is also the screen that has to prove the first question mattered. Piggles'
whole onboarding promise is "you answer two questions, it arrives set up".

## Where it lives

`piggles/apps/account/components/onboarding.tsx`, the `looks` memo, via a
`TRADE_SHELF` map of trade → one of four verticals.

The mechanism: filter the catalog to the trade's vertical, then `.slice(0, 6)` in
**catalog order**. Two consequences follow directly. Trades sharing a vertical
share a shelf byte for byte — and `retail`/`services`/`content`/`b2b` is four
buckets for nine trades, so collapse was guaranteed. And because the filter is a
hard gate, a template in the "wrong" bucket is not merely ranked low, it is
invisible.

The code named the risk and did not measure it: _"Coarse ON PURPOSE… ~138
specific trades that are NOT stored anywhere queryable — so this is the honest
join, not a lossy one. It orders the shelf; it never hides the rest."_ On the
screen it was not ordering anything — the vertical was the only signal — and it
was hiding the rest, because the filter ran before the slice.

## The fix

New `piggles/apps/account/lib/looks.ts`, holding a `rankLooks()` that scores each
template instead of gating it:

- **Relevance decides.** Each trade carries the words its templates would use
  about themselves (`food` → bakery, cafe, coffee, restaurant, bistro,
  patisserie, deli, …), matched against the template's key, name and summary. A
  hit in the key or the name scores 3, in the summary 1 — `sparx-restaurant-cafe`
  is a café by identity, whereas a template that merely mentions coffee is not.
- **The vertical becomes a tiebreaker, not a gate.** Equal relevance still
  prefers the trade's own shelf, but a template off it is no longer unreachable.
  That single change is what lets a food business see `restaurant-cafe`.
- **Catalog order breaks remaining ties**, so the list is stable and does not
  reshuffle between renders.

The trade keywords mirror the `tags` already on each starter in api-rest's
`industry-starters.ts`, deliberately, so the two answers to "what is a food
business" cannot drift. They are duplicated rather than imported because that
file ships in another service's image and this list has to reach the browser; a
third caller would move them into `@piggles/config`.

**RULE #0.5 applied while here** (the file was touched, so the rule binds it).
`onboarding.tsx` was 346 lines and is now 163: the two question blocks moved to
`components/onboarding/choices.tsx` and `components/onboarding/look-picker.tsx`,
the ranking to `lib/looks.ts`, and the trade list to `lib/trade-options.ts` —
client-safe, because the existing `lib/trades.ts` is `server-only` and pulls in
the db package.

## Confirmed by

> Re-ran P01 act 2 on `localhost:3021/onboarding`. Picked **Food & drink**: the
> shelf came back **Universal Starter · Vegan · Bistro · Pizzeria · Café ·
> Sushi** — `restaurant-cafe`, the bakery-and-counter-café template, now offered
> to a bakery for the first time. Then cycled every trade in the picker:
>
> | Trade          | Now offered                                           |
> | -------------- | ----------------------------------------------------- |
> | Beauty & salon | salon-editorial · salon-modern · barber ×2 · nail     |
> | Clothing       | apparel-minimal · apparel-street · athletic · couture |
> | Professional   | accounting-advisory · portfolio-studio · law ×2       |
> | Fitness        | yoga-studio · chiro-wellness · fitness-bold           |
> | Car parts      | auto-neighborhood · auto-euro                         |
> | Electronics    | tech-cinematic · electrician-modern · hvac-efficiency |
>
> Nine trades, eight distinct shelves — it was three.

**Honest about what is still imperfect:** keyword matching is not classification.
"Tattoo (dark)" ranks into Professional and Fitness off the word _studio_, and
"Pool repair" into Electronics off _repair_. Both are one card down a list of
six, and both are a far smaller error than offering a bakery a skincare brand —
but they are wrong, and the real fix is the catalog carrying trade tags of its
own rather than this inferring them from prose. Not attempted here: that is a
catalog change across 169 bundles, not a change to this screen.

## Rating effect

getpiggles › Set up your business — Ease 5 → 8, Design unchanged at 8
(recorded in [rating.md](../rating.md)).
