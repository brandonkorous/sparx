# 626 — A group said five products over a page holding none of mine

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 210
**Surface:** mypiggles › Sell › Groups of products (list + pane); sparx › Categories
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 210 (seen on screen, before and after)

## What happened

Sell › Groups of products, standing on Juniper Row. Eight groups, correctly
mine. Top row:

```
Name           How it fills   State       Products   Updated
New arrivals   Automatic      Featured           5   Sep 1
```

Five products, and it is the one group I have marked **Featured**, so it is the
one my home page leads with. Opening it:

> 5 products matched when membership was last worked out.

There are no clothes in it. All five are from my other websites:

```sql
select p.title from commerce_collection_products cp … where c.name = 'New arrivals';
-- Astrid Signet Ring
-- Colette Tennis Bracelet
-- Lune Pendant Necklace
-- Nº3 Black Rose & Oud
-- The Four Eaux — Discovery Set
```

Jewelry and fragrance. On my clothing site.

## Why it happened

`collectionService` reported `productCount` as `_count.products` — a count of
rows in the `commerce_collection_products` join table. A membership row outlives
everything that takes its product off a website: archiving it, saving it back to
draft, or scoping it to one of the business's other sites.

**The aisle list one screen over has been right about this since issue 382.**
Categories, same app, same screen width:

```
Apparel        Featured    7   [2 not shown]
Goods          Featured    0   [6 not shown]
```

with a tooltip that already says the words: "archived, still a draft, **or kept
for one of your other sites**."

The fix existed, the wording existed, the reason was written down in
`category-service.ts` — and four files away the sibling service counted filing
rows ([[feedback_a_fix_leaves_its_neighbour_behind]]). The shared module they
both import even says this in its own header:

> …three readers, one of them implementing the rule, and nothing making them
> agree.

Measured on her primary site, 2026-09-17:

| group          | filed | a shopper finds |
| :------------- | ----: | --------------: |
| New arrivals   | **5** |           **0** |
| The essentials |     4 |               4 |
| Winter layers  |     3 |               3 |
| the other five |   1-3 |        the same |

One row in eight. The one she features.

## The fix

**`shopperVisibleProduct` moved out of `category-service` into the shared
`site-visibility` module**, so the aisle count and the group count are now the
same predicate rather than two copies. That is the part that stops this
recurring: a change to what "on the website" means reaches both.

- **The Products column** is what a shopper would find in the group **on this
  site**, with the aisle list's badge and tooltip beside it when that is not the
  whole story.
- **The pane's sentence** had to be split in two. Under the new count the old
  code would have said _"No products match these conditions yet"_ about
  conditions that plainly matched five things, and she would have gone and
  rewritten a working rule ([[feedback_one_outcome_two_causes]]). It now says:

  > 5 products match these conditions, but none of them is on this website:
  > archived, still a draft, or kept for one of your other sites.

- **The delete dialog counts every site**, because deleting the group removes it
  everywhere. Offering "the products in it are kept" over the count visible here
  would have named a number that is not the number kept, and on this group would
  have read as though it were empty.

- **The detail route resolves the site**, which it did not, so the pane and the
  row it opened now answer the same question.

On screen, standing on Juniper Row:

|                     |               before |                                                                    after |
| :------------------ | -------------------: | -----------------------------------------------------------------------: |
| New arrivals column |                **5** |                                                      **0 · 5 not shown** |
| the pane's sentence | "5 products matched" | "5 products match these conditions, but none of them is on this website" |

## Also fixed: sparx never got issue 382 at all

Its aisle list printed the server's `productCount` raw with no footnote, and its
type still described the field as "how many products are **filed** in this
category" — a label the server stopped meaning in 382. Both lists in that console
now carry the badge.

## Guard

New `test/integration/collection-product-counts.test.ts`, **6 tests**, the twin
of `category-product-counts.test.ts`.

Three of them are rules rather than examples:

```ts
it('does not count a soft-deleted product as filed either', …)
it('gives the PANE the same two numbers as the row', …)
it('answers for the whole business when no site is named', …)
```

The first matters because a deleted product belongs in **neither** number — a
"not shown" footnote about it would promise something is there to recover.

Plus `collection-members-words.test.ts`, **8 tests** per console, on the sentence.
One pins the word the whole thing turns on:

```ts
it('reads as one thing when it is one thing, and still says NOT', …)
```

Proven red by reinstating the raw count: **3 of 6** integration tests fail, and
they are the three that can tell the two numbers apart. The other three guard
site symmetry, deletion, and the unscoped read, where both counts coincide.

## Still open

**The storefront could not be checked.** Her site is suspended ("Your site is
offline. It comes back as soon as a payment goes through"), so the group page it
serves was not read back. The count now mirrors the storefront's own product
filter by construction — the same predicate, one module — but it was not seen
rendering.
