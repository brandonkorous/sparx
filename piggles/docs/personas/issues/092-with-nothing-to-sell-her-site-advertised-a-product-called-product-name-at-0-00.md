# 092 — With nothing to sell, her site advertised "Product name", $0.00, Sold out

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** the published site — the product grid on any page that carries one
**Filed:** 2026-08-21
**Fixed:** 2026-08-24
**Confirmed by:** read off two live tenant homepages — see below
**Blocked on:** —

## What happened

Nia deleted the six products she never asked for
([091](091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md)) —
she runs a salon and does not sell mugs. Her catalogue is now empty, which the
console says plainly and well:

> **Nothing to sell yet**
> A product is one thing you sell. Add your first one and it can be on your
> website within a minute.

Her live homepage says something else:

> **Shop our products**
> _(a grey placeholder square)_
> **Product name**
> **$0.00**
> **Sold out**
>
> **Featured**
> _(the same card again)_

A product called "Product name", priced at nothing, marked as out of stock. On
her website, under her salon's name, where her clients are.

## What should have happened

**A section with nothing in it shows nothing.** An empty product grid is not a
grid with one empty product in it; the honest render is for the section to be
absent, exactly as the console's own empty state is honest about it.

## Why it matters

This is a **price** and a **stock claim**, both invented. Nobody set $0.00 and
nothing is sold out — there is no product to be sold out of. A value nobody
measured must never render as one ([[feedback_never_present_absence_as_measurement]]),
and this renders two.

It reads to a visitor as a broken shop rather than as no shop, which is worse
than either. Nia's actual answer to "do you sell things" is "not online" — and
the page turns that into "yes, and it is out of stock and free".

It is also **not a loading state**, which is the charitable reading and the wrong
one. The markup is fully rendered and served:

```text
<h3 class="font-semibold text-base-content">Product name</h3>
<p class="text-lg font-bold text-base-content">$0.00</p>
<span class="inline-flex w-fit items-center rounded-field border …">Sold out</span>
```

No skeleton class, no `aria-busy`, no data attribute marking it provisional. It
is the repeating block's own template, published with nothing bound to it.

## How to reproduce

Every time, on any site whose product grid has no products to show.

1. Delete every product (or start from a business that has none).
2. Open the published site with a fresh URL — `?cb=1` or a hard reload, because
   the client router will otherwise serve the render from before the delete.

The grid draws one card with placeholder values.

## A second thing this turned up

The delete's confirm dialog promises:

> …and **it disappears from your website immediately**.

It does, from the server: a fresh request for the homepage no longer contains the
six products. But the page already open in a browser keeps showing them until
something busts the client's cached render. "Immediately" is true of the origin
and not of the tab the owner is looking at, which is the tab she checks. Filed
here rather than separately because both are the same page telling her something
that is not so; if the fix for one does not cover the other, this becomes its own
issue.

## Where it lives

The published grid is a repeating block in the site renderer — a `<div
class="grid …">` whose single `<a class="card …">` child is the row template, and
which renders that template once when its collection resolves empty. The `data-sui-id`
attributes on every node put it in the silica node-tree render path rather than in a
React component with an empty branch to add.

Not traced further than that, because the fix is a product decision first: whether
an empty collection hides its whole section (heading included) or renders a real
empty state in the site's own voice. Both are defensible; "one fake product" is not
either of them.

## The fix

Not made — `Blocked on: decision`, and the decision is one line:

- **Hide the section.** An empty grid takes its heading with it, so a salon's
  homepage simply has no shop on it. Cheapest, and right for the common case,
  which is a business that does not sell anything.
- **A real empty state.** "Nothing in the shop just yet" in the site's own type,
  for a business that DOES sell and is briefly out of everything — where a
  vanished section would read as a broken page.

The two are not exclusive: hide by default, and let a block that opts in show a
message. What must go either way is the card with invented values in it.

## Decision — 2026-08-24, Brandon

**Give it a real empty state**, not a hidden section.

A section that vanishes teaches nothing, and the owner cannot tell the difference
between "I have not added products yet" and "this part of my site is broken". The
placeholder was wrong because it was FAKE, not because it was present.

## Rating effect

The published homepage is scored in [rating.md](../rating.md) with this and
[091](091-her-salons-homepage-is-selling-sparx-branded-mugs-and-t-shirts.md) as
its gap.

## The fix — 2026-08-24

**`omitWhenEmpty`, which silica already had.** `repeat` renders its template ONCE
against an empty collection — the engine's documented "one-placeholder-item
convention" — and the storefront was publishing that scaffolding as copy. The
collection binding takes `omitWhenEmpty: true`, which drops the node instead.

New `repeatOrEmpty(container, ref, emptyText)` in
[conditional.ts](../../../../wizeworks/packages/silica-catalog/src/conditional.ts)
pairs that with the message, and is applied to every block whose collection can
legitimately be empty: the product grid, the product rail, both carousels, and
the blog index. `productAttributes` and `buyBox` were checked and left alone —
the first is already wrapped in `visibleWhen`, the second repeats over a
route-provided record.

### The wrong version of this fix, and why the test asserts both directions

The first attempt hung the whole thing on `visible`, which reads
`resolveBinding`. The repeat reads `resolveCollection`. They are different host
methods, so a collection ref means nothing to the first — and the grid vanished
even when products existed. Every shop on the platform, emptied.

The suite caught it, and
[empty-collection.test.ts](../../../../wizeworks/packages/silica-catalog/src/empty-collection.test.ts)
now asserts BOTH directions on purpose: a test that only checked the empty case
would have passed on that fix.

The grid therefore uses `omitWhenEmpty` (same call the repeat makes, so the two
can never disagree) and only the MESSAGE uses `visible`.

## Confirmed by

> Read off two live tenant homepages, 2026-08-24.
>
> **Juniper Row** (Devi's shop — seven products, every one "Not on sale", so both
> product sections resolve empty):
>
> ```
> Shop our products
>   Nothing in the shop just yet. Check back soon.
> Featured
>   Nothing in the shop just yet. Check back soon.
> ```
>
> Grepped for all three invented values in the served HTML: **zero** occurrences
> of `Product name`, `$0.00`, and `Sold out`. Before this, each appeared twice.
>
> **The other direction**, in the render tests: a host with two products renders
> both cards and NO empty message.

## Still open from this issue

The second finding — the delete's "it disappears from your website immediately"
being true of the origin but not of the tab the owner is looking at — is NOT
addressed here. That is a client-cache question, not a render one. It stays on
this issue.
