# 324 — Her shop told shoppers she had nothing to sell

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8, walking the site's own page inventory
**Surface:** the published site › Shop, Home, and every listing that browses the catalog
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** reloaded Shop, Home and a collection page in the same outage — all three now say the page did not load

## What happened

Opening Devi's published site to check the page inventory, **Shop** reads:

> **Shop**
> Everything here is cut and sewn in the studio, six of each size in a run. When
> a size sells out it stays out until I make the next one.
>
> **All products** · **0 products**
>
> **Nothing in the shop yet**
> There is nothing on sale here at the moment. Do come back.

Her own sentence about how the runs work, directly above a page saying there is
nothing to buy. The **Home** page says the same thing in its own words:

> **New in**
> Nothing in the shop just yet. Check back soon.

She has **16 active products**, every one of them published, and 60 versions
under them.

At the same moment, on the same site, **a product page told the truth**:

> **This page didn't load**
> Something went wrong at our end, not yours. Trying again often works — and if
> it doesn't, the rest of the site is still here.

So the platform knows how to say this. The listings do not.

## What should have happened

"I could not load your catalog" and "you have no catalog" are two different
sentences, and the advice attached to them points in opposite directions. A
shopper who is told the shop is empty leaves and does not come back that day. A
shopper who is told the page did not load presses the button that is right
there.

This is the rule the platform already holds itself to —
[[feedback_never_present_absence_as_measurement]] — and the file where the
defect lives states it three separate times in its own comments.

## How to reproduce

Every time, on any tenant, whenever the storefront cannot reach `api-rest`.

1. Have a shop with products on it. Juniper Row has 16.
2. Make `api-rest` unreachable (here: it errored and stopped answering on 3100).
3. Open the site's **/shop**. It reads `0 products` over "Nothing in the shop
   yet", with no indication anything went wrong.
4. Open the **home page**. The New in strip reads "Nothing in the shop just yet.
   Check back soon."
5. Open a **product page**. It correctly says the page did not load.

Steps 3 and 4 disagree with step 5 about the same outage, on the same site, in
the same second.

## Why it matters

**It is her whole business, and it is the customer who sees it.** Devi left a
marketplace that owned her list; this site IS the shop now. An API restart, a
deploy, a cold start or a network blip turns her storefront into a shop that
says it has nothing, in her own voice, to every visitor who arrives during it.

**It cannot be noticed from the console.** Nothing is red, no alert fires, and
the page answers `200` with a heading, her copy, her footer and her legal links
all correct. It looks like a finished page about an empty business.

**"Do come back" is the sharpest part.** The sentence is written to be kind
about a shop that genuinely has not opened yet. Aimed at an outage it becomes an
instruction to leave, issued on behalf of a business that has 16 things for sale
right now.

**It has been fixed twice before at one layer up.** Issue 203 was Typesense down
rendering as "No products found"; issue 209 was a partly-filled index rendering
as a smaller shop. Both were repaired by adding the Postgres catalog as a second
source. Nobody asked what happens when the second source cannot answer either,
which is the case where both of them are unreachable for the same reason: they
are the same HTTP service.

## Where it lives

Three places, all in the storefront's data layer, all the same shape.

**1.** [wizeworks/apps/site/lib/commerce.ts:566](../../../../wizeworks/apps/site/lib/commerce.ts)
and **:574** — `searchProducts`. Both sources correctly return `null` for "could
not answer", and both nulls are then collapsed into a zero:

```ts
return indexed ?? EMPTY_LISTING(filters); // :566
return (await catalogFallback(tenantSlug, filters)) ?? EMPTY_LISTING(filters); // :574
```

`EMPTY_LISTING` is `{ items: [], total: 0, … }`, which is what puts `0 products`
on the screen and hands `BrowseEmpty` an empty list to apologise for.

The comments immediately above those two lines are unambiguous about it:

> `// Typesense unreachable. Not an answer, and specifically not an answer of zero.`
> `// NULL means "could not answer", never "nothing to sell". The difference is the`
> `// whole of issue 203 — a caller that cannot tell them apart prints one as the other.`

The distinction is made carefully, carried the length of both helpers, and then
dropped in the return statement.

**2.** [wizeworks/apps/site/lib/silica-data.ts:729](../../../../wizeworks/apps/site/lib/silica-data.ts),
**:746**, **:766**, **:789**, **:822** — the silica page resolver, which fills
the home page's strips. The whole treatment is one line:

```ts
.catch(() => setAtPath(root, 'commerce.product', []))
```

**3.** [wizeworks/apps/site/lib/builder-data.ts:322](../../../../wizeworks/apps/site/lib/builder-data.ts)
— the legacy builder resolver, identical line.

The rendering side is already correct and needs no change:
[browse-empty.tsx](../../../../wizeworks/apps/site/components/products/browse-empty.tsx)
already splits "you narrowed it" from "this part of the shop is empty" and says
a different sentence for each. It is simply never told about the third case.

## The fix

**One question, asked in one place: did the call fail because the thing is not
there, or because we could not ask?** `publicGet` already throws with the error
envelope's `code`, so a deleted collection arrives as `NOT_FOUND` and an
unreachable service arrives as a bare fetch `TypeError` with no code at all. The
file already made exactly this distinction in `getCollection` and nowhere else;
it is now a named export the whole storefront reads from:

```ts
export function isNotFound(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'NOT_FOUND';
}
```

**1. The listings stop fabricating a zero.**
[commerce.ts](../../../../wizeworks/apps/site/lib/commerce.ts) — `searchProducts`
throws `CatalogUnavailableError` when neither the index nor the catalog could
answer, instead of returning `EMPTY_LISTING`. `EMPTY_LISTING` is **deleted**
rather than left unused: the only way to reach a zero on this path is now for a
source to have actually said zero, and keeping the constructor around is keeping
the loaded gun.

**2. The composed pages stop swallowing.**
[silica-data.ts](../../../../wizeworks/apps/site/lib/silica-data.ts) and
[builder-data.ts](../../../../wizeworks/apps/site/lib/builder-data.ts) — every
`.catch(() => setAtPath(root, key, []))` becomes `.catch(emptyOnlyIfGone(root, key))`,
which resolves to `[]` for a 404 and rethrows everything else. Five sites in the
silica resolver (catalog, page-two catalog, the New/Related rails, the category
rails, the CMS lists) and two in the legacy one.

**3. The one that was hiding.**
`getProductsFull` — with no `collection`/`category`/`ids` it IS the whole
catalog, and it swallowed everything into `[]` behind a docstring saying that
was deliberate. Same discrimination applied.

**Why throwing, and not a "we could not load this" panel in the strip.** The
panel is the nicer answer and it was the first design: mark the source
unavailable, and have the products block render a third sentence instead of the
apology. It was rejected because **it would not have reached a single published
site.** Those blocks are stored trees — Devi's home page is a row in
`builder_pages` — so a new node in the block factory appears only on pages
authored after it ships. That is issue [296] exactly: a repair with eight
passing tests and zero tenants repaired. Behaviour at render time reaches every
existing site the moment it deploys, which is the difference between fixing this
and describing it.

The cost is real and worth naming: a home page whose product strip cannot load
now fails whole, taking the hero and the contact prompt with it. That is the
right trade here because the strip failing means **api-rest is unreachable** —
at which point the cart, the prices and the account link on that page are not
trustworthy either. It is not one section failing; it is the back end being gone.

**What was deliberately left alone.** The genuinely supplementary readers still
degrade to `[]`, because an absent garnish renders as nothing rather than as a
false sentence: `searchEverything` (the strip beside the grid),
`listRelatedProducts`, `listProductQuestions`, and the record-pin hydrators. Each
already carries a comment saying the choice was made on purpose, and none of them
can put "this business has nothing to sell" on a page.

**No test was added, and that is a gap.** `wizeworks/apps/site` has no test
script and no test files at all, so locking this in would mean standing up a
vitest harness for the app — larger than the repair and not what was under test.
The behaviour was proved on the screen instead, in the real outage, which is what
[CLAUDE.md](../CLAUDE.md) RULE #3 asks for anyway.

## Confirmed by

Driven as a shopper on 2026-08-29, **while api-rest was still unreachable** —
the same outage that produced the defect, so the before and after are the same
condition and not two different days.

| Page                          | Before                                   | After                   |
| ----------------------------- | ---------------------------------------- | ----------------------- |
| `/shop`                       | `0 products` · "Nothing in the shop yet" | "This page didn't load" |
| `/` (home)                    | "New in · Nothing in the shop just yet." | "This page didn't load" |
| `/collections/the-core-range` | rendered without its products            | "This page didn't load" |

All three keep her header, her nav and her footer, and each offers **Try again**
and **Go to the front page**. Nothing on the site now claims Juniper Row has
nothing to sell.

**Still to confirm: the healthy path.** api-rest has not come back up in this
session, so "products appear again once the service answers" has **not been
re-checked on the screen** and is recorded here as outstanding rather than
assumed. The change cannot affect it by construction — a 200 with `[]` is still
an answer and still renders the empty state, and only a rejection reaches the new
code — but that is reasoning, not looking.

## Rating effect

To be recorded against the published site once the healthy path is re-checked.
