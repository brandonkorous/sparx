# 318 — Four of her sixteen products could not be found by name

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · the keyboard-only standing check
**Surface:** mypiggles › the ⌘K search box, and Sell › Products
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** driven as Devi on 2026-08-29 — the notice named 4, the button put them back, and searching found them

## What happened

Driving the keyboard-only check, Devi opened the search box with ⌘K and typed the name of
a jumper she sells:

> **Marlow**
>
> Nothing matches that. Try a different word.
>
> **Nothing in your orders, customers or products matches "Marlow".**

Marlow Knit is her product. It is active, it has ten versions on sale, and it is four rows
down her own Products list. Typing **Sunday** got the same answer about Sunday Trouser,
wide leg.

Not all of them, which is what makes it hard to notice. **Linen** found Linen Shirtdress.
**Knit** found The Fisherman Knit and The Merino Crew — and did not find Marlow Knit,
which has the word in its name.

## What should have happened

Typing the name of a product she sells finds it. And where the software cannot find
something it holds, it must not answer as though the thing does not exist.

## How to reproduce

Every time, on Juniper Row as it stands.

1. Press ⌘K anywhere in the console.
2. Type `Marlow`, or `Sunday`.
3. "Nothing in your orders, customers or products matches …".
4. Type `Linen`. Found. Type `Knit`. Two hits, neither of them Marlow Knit.

## Why it matters

**It is a false statement about her own business, in the place she goes when she is in a
hurry.** The box does not say "we could not find that" — it names orders, customers and
products as places it looked and reports that the thing is not in any of them. This is
[[feedback_never_present_absence_as_measurement]] on the most-used control in the console.

**A customer gets the same answer.** The shop's own search box and filters read the same
index, so a shopper searching Devi's site for "Marlow" is told she does not sell it. She
does.

**Being partly right is what hid it.** Twelve of sixteen worked. Nobody types every
product name, so the four that were missing had been missing for six days
([[feedback_absent_behaves_like_fine]]).

## Where it lives

Two places, and the second is why nobody was told.

**The index was short.** Indexing rides on events, so a product written while the indexer
was not subscribed to the right topic — the state issue [281] found and fixed on
2026-08-27 — never entered the index and never would on its own. [281] repaired the
pipeline; nothing put back the records already lost. Measured directly against Typesense:

```
indexed, tenant=Juniper Row, status=active          12
on sale in the catalog, settled (updated > 5m ago)  16
missing                                              4   Marlow Knit · Sunday Trouser ·
                                                         Silk twill scarf · Leather-covered belt
```

**The screen that was supposed to warn her could not see it.**
[products-list.tsx](../../../../piggles/apps/workbench/surfaces/commerce/products-list.tsx)
read:

```tsx
invisibleShop={indexed === 0 && sellableCount > 0}
```

with a comment giving the reason:

> Only "none at all" is reported. A count that merely disagrees could be a worker a few
> seconds behind, and crying wolf on that would train people to ignore the one message
> that matters.

**That reasoning is right and its discriminator is wrong.** It makes "the indexer is two
seconds late" and "four products have been missing since Tuesday" the same signal, and so
reports neither. The difference between them is not the size of the gap, it is **how long
it has been there** — and nothing was measuring that.

The consequence is worse than silence, because the remedy already existed: the notice this
guard suppresses carries a **Put them back** button that reindexes the catalog. Devi had
the cure on a screen she visits daily, with nothing to tell her she needed it.

`sellableCount` is also the count of the rows in the current WINDOW of a filtered,
paginated list, so comparing it against a whole-tenant index count could never have been
sound even had the comparison been attempted.

## The fix

The count of documents is not an answer to "can she find her products", so the gap is
measured instead of inferred.

**1. `findableProductCount`** in
[wizeworks/packages/search/src/admin.ts](../../../../wizeworks/packages/search/src/admin.ts)
counts what is indexed AND on sale for one tenant. Kept separate from `collectionStats`,
which counts every product document including drafts and archived ones — subtracting that
from a catalog of on-sale products would report a gap that is only a difference of
definition.

**2. `/v1/search/status` returns `productsMissing`.** It is the only place that can hold
the catalog and the index at the same time, so it does the subtraction:
on-sale-and-settled minus findable, clamped at zero. `null` when the collection is not
there, meaning "could not look" — never zero, never a gap of everything.

**3. Settled rows only.** Anything changed inside a five-minute grace window is left out
of the comparison entirely, which is what keeps the original reasoning intact: a save is
never counted against the indexer, so the warning cannot appear and clear on its own. Five
minutes because the cost of waiting is nothing and the cost of a flickering warning is
that she stops reading them.

**4. The notice names the number.** It fires on a shortfall rather than on an empty index,
and says "Searching your shop won't find 4 of your products" — checkable against a catalog
she knows, where "some of your products" is a shrug. Its **Put them back** button is
unchanged and is now reachable in the case that needs it.

## What this does NOT fix

**Other tenants are still short until somebody presses the button on their screen.** That
is deliberate: reindexing is the owner's action, on the owner's data, and the point of this
fix is that the screen now asks for it. A backfill run behind everyone's back would repair
the tenants somebody happened to think of and leave the rest in the same silence, with
nothing on screen either way.

**The sentence in the search box is unchanged.** "Nothing in your orders, customers or
products matches" is still stated positively when a search finds nothing, and it is still
capable of being false. Hedging every empty result would cost more than it buys now that
the shortfall is visible and fixable from the Products list; if it recurs after this, the
sentence is the next thing to change.

**Only products are measured.** Customers and orders can drift the same way and are not
compared against anything. The mechanism is now in place for them.

## Confirmed by

Driven as Devi on 2026-08-29, end to end, on Juniper Row.

**The screen said the number.** Opening **Sell › Products** now leads with:

> **Searching your shop won't find 4 of your products**
> They are on your site and people can buy them. What isn't working is the search box and
> the filters beside your shop — those look things up in a separate list, and these are
> not in it, so a customer searching for one by name is told you don't have it.
> **[ Put them back ]**

Four, against a list reading "Showing 1–16 of 16". Before this fix that panel did not
appear at all.

**The button worked.** Pressed **Put them back**; the tenant's active product documents in
Typesense went **12 → 16**.

**She can find her jumper.** ⌘K, typed **Marlow** — "Marlow Knit" under Products, with
its two photos beside it, "3 records matched". Typed **Sunday** — "Sunday Trouser, wide
leg". Both were "Nothing in your orders, customers or products matches" an hour earlier.

**And the notice cleared itself**, which is the promise its own code makes ("The message
above IS the status: it disappears when the products are findable again"). Reopened the
Products list: gone, with all sixteen rows still there.

## Rating effect

`Sell › Products — Ease 7 → 8`. The list was never hard to use; what it could not do was
tell her that a quarter of her catalog was invisible to the search box on her own shop,
while carrying the one button that fixes it.
