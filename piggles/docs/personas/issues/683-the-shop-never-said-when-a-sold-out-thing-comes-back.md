# 683 — The shop never said when a sold-out thing comes back

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 241
**Surface:** the tenant site — any product page rendered through the silica template
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on her own shop; the dated half is unexercised, see below
**Blocked on:** —

## What happened

Found while fixing [682](682-the-shop-page-never-said-it-was-a-preorder.md), by
reading the list of things the product page is able to say about supply and
checking each one against the page that actually renders.

The legacy `<ProductDetail>` has five answers. The silica record, which is what
the page every tenant gets is built from, had three:

| What the shop can say | Legacy component | The real page |
| --------------------- | ---------------- | ------------- |
| Sold out              | yes              | `soldOut`     |
| Low stock             | yes              | `lowStock`    |
| Made to order         | yes              | `madeToOrder` |
| Preorder, ships on …  | yes              | **nothing**   |
| Back in stock on …    | yes              | **nothing**   |

Issue 682 is the fourth row. This is the fifth.

A shop owner puts a purchase order in for something she has sold out of, the
supplier gives her a date, the console records it, and the sold-out notice on
her own site still says only:

> **Sold out**
> This one has gone for now. We will put it back as soon as we have more.

She knows the day. The page does not say it.

## Why

`expectedBackAt` is a real field with a real writer. `api-rest` has sent it on
every public variant since backorders shipped:

```text
wizeworks/services/api-rest/src/routes/v1/public/commerce.ts:1601
  expectedBackAt: v.backorders[0]?.promisedAt?.toISOString() ?? null,
```

and `promisedAt` is written by `createBackorder` from `derivePromise` — a
purchase order's expected arrival when one exists, otherwise a measured lead
time. The same column [679](679-the-ship-date-was-a-day-early-for-the-customer-too.md)
made a whole calendar day.

So the value travels the whole way to the page and then falls off the end.
`productToSilicaRecord` never put it on the record and `soldOutNotice()` never
bound it. This is the same shape as 682, two rows apart in the same table,
[[feedback_fetched_but_never_rendered]] and
[[feedback_a_fix_leaves_its_neighbour_behind]] at once.

MEASURED 2026-09-18, platform-wide:

```text
inventory_backorders            3
  … with a promised day         0
inventory_preorder_windows      3   (all three opened by hand this act)
```

Nobody has been promised a day yet, so nothing was mis-sold. That is why this is
major and 682 is a blocker: there, an enabled Add-to-cart took real money for a
thing that did not exist. Here the `soldOut` ref had already swapped the buy form
for a notice, so the page is unhelpful rather than untrue.

## What should have happened

When the business knows the day, the page says the day. When it does not, the
page says so and does not guess.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. Take a product to zero, raise a purchase order for it with an expected
   arrival, and let a backorder be raised against it.
3. Open that product on the shop. "Sold out. We will put it back as soon as we
   have more." No date, on a page whose owner has one.

## Why it matters

A sold-out page is the end of a visit. A date is the only thing that turns it
into a reason to come back, and it is the difference between a shop that looks
out of stock and a shop that looks closed.

It also matters because of what it says about the pattern rather than the field.
682 was not a single missed ref. The two renderers had been drifting for as long
as both existed, and nothing anywhere compares them, so the gap grows every time
somebody adds a supply state to the component they can see on their own machine.

## Where it lives

| What                             | Where                                                                 |
| -------------------------------- | --------------------------------------------------------------------- |
| The record with no back-in-stock | `wizeworks/apps/site/lib/silica-data.ts`                              |
| The notice with nothing to bind  | `wizeworks/packages/silica-catalog/src/commerce.ts` (`soldOutNotice`) |
| The sentence, now shared         | `wizeworks/apps/site/lib/format.ts`                                   |

## The fix

**A `backInStock` sentence on the record**, and a line inside `soldOutNotice()`
that binds it. The general sentence stays for the far commoner case where nobody
has promised anything; the dated line sharpens it when there is a date.

**Only when the whole product agrees on the day.** Every version carries its own
`expectedBackAt`, and the notice renders only when nothing is in stock — so the
one open question is WHICH day. A product whose small returns in March and whose
large returns in June has no single back-in-stock day, and printing the earlier
one tells somebody waiting on a large a date that is not theirs. One distinct
day, or silence.

**Both sentences moved into `lib/format.ts`.** They had drifted already: the new
silica line read `Preorder — ships 1 July 2027` and the component read
`Preorder: ships 1 July 2027`. Two shops' worth of voice for one fact, written
the same afternoon by the same hand, which is exactly how the wording ends up
with only one proofread copy. `preorderShipsLine` and `backInStockLine` now have
one home each and two callers each, the same reasoning that moved `formatArrival`
in 679. `formatArrival` is no longer called outside that file at all.

**And the preorder panel dropped a hand-mixed color.** It was authored
`bg-warning/10` over `text-base-content`: the only alpha background anywhere in
the catalog, so a theme restating `--color-warning` would not carry it, and
`base-content` has no promised contrast against a tinted fill on a dark theme.
It is now the solid `bg-warning` / `text-warning-content` pair, which is what the
low-stock badge in the same file already uses.

## Proved red

Fifteen new tests, and each was watched failing before it was believed.

`wizeworks/apps/site/lib/silica-data.test.ts` — 11 tests over the sentences
themselves. Removing `timeZone: 'UTC'` from `formatArrival` reddens exactly the
four that carry a date; relaxing the one-distinct-day rule reddens exactly the
one about two versions returning on different days.

`wizeworks/packages/silica-catalog/src/record-templates-render.test.ts` — 4 tests
that bind a record to the real template and read the HTML. Removing
`preorderNote()` and the back-in-stock line reddens exactly those two, and the
two "says nothing" tests stay green, which is the pair that matters: this file is
full of ways to print an empty panel.

[[feedback_a_test_that_cannot_go_red]]

## Confirmed by

**The node reaches the page; the SENTENCE has never had data to say.**

Those are two different claims and only the first is settled, so both are written
down separately.

**Settled.** The sold-out notice and its new date line are in the tree the shop
actually serves. The bracelet's page was read on screen once port 3100 was free
and the preorder half of this work is visibly on it
([682](682-the-shop-page-never-said-it-was-a-preorder.md)); the same publish
carried the back-in-stock line, and the healed tree was measured node by node:
the page grid has exactly two cells, the sold-out gate wraps exactly the form,
and `backInStock` is present and gated.

**Not settled, and it cannot be yet.** No backorder anywhere on the platform has
a promised day:

```text
inventory_backorders          3
  … with a promised day       0
```

So the line correctly renders NOTHING, and a screenshot of it saying nothing
proves only that the gate works. What would exercise it is a purchase order with
an expected arrival raised against a sold-out product, which is a different act
and is recorded as the next step rather than claimed here.

That gap is the finding, not an oversight in the test: a field written by
`derivePromise`, carried by the public API on every variant since backorders
shipped, drawn by the legacy product page, and **never once populated in this
database**. A disclosure nobody has ever seen fire is exactly the kind that is
wrong the first time it does.

What IS established beyond the page: **1,366** catalog tests and **69** site
tests pass, both packages typecheck, and four template tests bind a record to the
real `commerce.product` template through the real engine and read the words out
of the rendered HTML.

## Gap to 10

A multi-version product still says nothing about either state, for the same
reason in both cases: the sentence belongs to a version and the record is the
product. The honest fix is a per-version line on the picker.

Nothing compares the two renderers. Both now read their sentences from one file,
which stops the WORDING drifting, but nothing stops somebody adding a sixth
supply state to the component and not to the record. That is what let this sit.

## Rating effect

Recorded in [rating.md](../rating.md) against `inventory.preorders`, alongside
682 — the same surface, found in the same pass.
