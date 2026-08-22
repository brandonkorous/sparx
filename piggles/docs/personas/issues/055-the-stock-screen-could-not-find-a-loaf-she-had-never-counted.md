# 055 — The Stock screen could not find a loaf she had never counted

**Status:** fixed
**Severity:** high (the one screen for saying "we are out of this" could not find the thing)
**Found by:** P01 · Thistle & Rye · act 11 — mark the seeded rye out of stock
**Surface:** mypiggles › Stock › Stock, and the product's "How many you have" panel
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 11 — searched `rye`, landed on the count form, saved

## What happened

Today's rye had gone. She opened **Stock**, which listed two things out of her
ten — the two an order had happened to push negative — and typed `rye` into the
box that says _Product name or code_.

> **Nothing matches that**
> Try part of a product code or a product name.

She had typed part of a product name. It is the name on her own shop page, on the
product she was looking at a minute earlier, spelled correctly. The advice was to
go and do the thing she had just done.

## Why it matters

Two failures wearing one sentence.

**The advice is for the wrong cause.** One outcome — no rows — covers "you
mistyped" and "this product has never been counted", and those have completely
different remedies. The screen printed the remedy for the first and sent her
round a loop.

**And it is a dead end, not a detour.** Nothing else on that screen leads
anywhere either: the sidebar's other door is **Set up your stock**, a five-step,
thirty-minute onboarding about locations and spreadsheet imports and opening
balances. For "no rye today". The capability she needed existed the whole time —
`Record a count` on the product's own stock panel, which handles a variant with
no level row perfectly well — and the only route to it was a panel she had to
already know the name of.

A list that can only find what has already been counted cannot be where counting
starts.

## Why it happened

The Stock list reads `inventory_levels`, and a level row appears only when
somebody counts something. Eight of her ten products had no row, so eight of her
ten products were invisible to the screen whose job is stock. The two that DID
appear were there because an order decremented them past zero — the system had
written level rows on her behalf, for the two things she happened to sell, and
for nothing else.

## The fix

**A fourth empty state**, for the fourth problem. When the search is the ONLY
thing narrowing the list — no location filter, no "running low" — and it returns
nothing, the screen asks the catalogue whether the search matches a product, and
offers what it finds:

> **Nothing counted for "rye" yet**
> This is in your catalog and has never been counted, so your website sells it
> without limit. Open it to say how many you have.
> **[ Seeded rye ]**

The button opens that product's stock panel pinned, where **Record a count** is
already waiting. The probe is `enabled` only on that dead end, so the ordinary
path costs nothing, and the screen shows _Checking your catalog…_ while it runs
rather than answering "Nothing matches that" and correcting itself a beat later.

Scoped honestly: with a location filter on, an empty result means "not here", and
the product could be sitting counted at the place next door — so the question is
not asked.

### And four sentences that had the rule exactly backwards

Every screen that explains an uncounted item said the opposite of what the
platform does, in both consoles:

> ~~Your website treats an uncounted product as out of stock. Record a count and
> it becomes sellable straight away.~~

An uncounted variant takes the **untracked** path and is **always** sellable —
that is `computeAvailability`'s stated rule, and `20270401000000_uncounted_products_are_sellable`
exists because the opposite once shipped. So the advice inverted the consequence:
counting something makes it LESS available, not more. A business reading that
would count everything in to "make it sellable" and switch on denial it never
asked for.

Now:

> Until you count it, your website sells this one without limit — nobody has told
> it there is a number. Record a count and it starts keeping track: it comes off
> sale at zero, and back on when you bring more in.

A fifth described the [053](053-sold-out-was-a-thing-her-website-could-not-say.md)
bug as intended behaviour — _"the product stays on your website looking available
until it is restocked"_ — which was true when it was written and is not any more.
It now says what the site actually does.

All five fixed in `piggles` and `sparx`.

## Confirmed

Searched `rye` → the new empty state named **Seeded rye** → opened it → **Record
a count** → Main Warehouse, 0, _"Sold out for today"_ → saved. The panel flipped
to **Nothing left to sell**, and her website said so.

## Noticed on the way, not fixed

**Her three stock locations are somebody else's.** The count form's _Where you
counted it_ offers **East Coast Fulfillment**, **Main Warehouse** and **Roastery
& Pantry**, and defaults to the first. She has one shop, on Mercer Lane, and
never typed any of those. They are the starter's. For a bakery, "East Coast
Fulfillment" is not a place — and it is the DEFAULT, so the count lands there
unless she notices. A seeded location should either be named for the business or
not exist.
