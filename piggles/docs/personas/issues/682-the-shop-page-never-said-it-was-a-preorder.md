# 682 — The shop page never said it was a preorder

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 241
**Surface:** the tenant site — any product page rendered through the silica template
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on her own shop; see below
**Blocked on:** —

## What happened

Having opened a preorder in the console, Devi went and looked at her own shop the
way a customer would. The Colette Tennis Bracelet, on her Journal site:

> **VÉRANE — THE MAISON**
> **Colette Tennis Bracelet**
> **$6,800.00**
> An unbroken line of hand-set white diamonds on an 18k gold rail…
> Quantity `1`
> **[ Add to cart ]**

There are none of them. Not one. She has zero in stock, she has just told the
console it ships on **1 July 2027**, and she typed a note saying it is strung to
order by the workshop in Lyon.

The page says nothing. The button is live, the price is firm, and a customer can
put $6,800 through the checkout believing a bracelet is in a drawer.

MEASURED on the page itself:

```text
hasPreorderWord: false
hasOutOfStock:   false
hasInStock:      false
hasShips:        false
```

Not one of those words appears anywhere in the document.

## Why

**There are two product-page renderers, and the preorder only ever reached the
one nobody uses.**

`<ProductDetail>` — the React component — has drawn the preorder line for
months: `Preorder: ships 14 March`, the merchant's note, the units left. But the
page a tenant actually gets renders through the silica engine's
`commerce.product` template, and `productToSilicaRecord` — the function that
decides what a product IS to that template — carried:

| ref           | what it says                    |
| ------------- | ------------------------------- |
| `soldOut`     | swaps the buy form for a notice |
| `lowStock`    | the "only a few left" badge     |
| `madeToOrder` | the wait, the deposit, the run  |

and **no preorder ref of any kind**. The template had nothing to bind even if an
author wanted to.

**The `soldOut` ref is what makes it dangerous rather than merely quiet.** It
reads `p.variants.some((v) => v.inStock)`, and `inStock` for a preorder variant
is TRUE — that is the whole point of the policy, it sells past zero. So the
product is not sold out, the buy form renders in full, and the one thing that
would have explained why is absent.

This is the twin of [680](680-take-payment-now-took-no-payment.md), found the
same afternoon: there, a field the console wrote that nothing read. Here, a
field the API sends that the page never binds.
[[feedback_fetched_but_never_rendered]]

## What should have happened

If somebody is paying for a thing that does not exist yet, the page says so
before the button, in the same breath as the price.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Preorders**, start an offer on a product with no stock.
3. Open that product on the shop. Full price, live Add to cart, no mention of a
   preorder, no ship date, no note.

## Why it matters

This is the whole capability, not a detail of it. A preorder a customer is never
told about is not a preorder, it is a late order: they buy expecting post
tomorrow and hear nothing for nine months.

It is also the point where the platform stops being merely unhelpful and starts
being a liability for the shop. The preorder screen argues carefully that a
GUESSED date becomes a promise the moment somebody reads it. Silence is worse
than a guess. A guess is a promise that might be wrong; silence is the shopper's
own default assumption, which is that the thing exists.

And it undoes the rest of the day's work. Fixing the way in
([678](678-there-was-no-way-to-start-a-preorder.md)) and the day the date reads
([679](679-the-ship-date-was-a-day-early-for-the-customer-too.md)) both matter
only if the date reaches the person it was written for.

## Where it lives

| What                              | Where                                                          |
| --------------------------------- | -------------------------------------------------------------- |
| The record with no preorder       | `wizeworks/apps/site/lib/silica-data.ts`                       |
| The template with nothing to bind | `wizeworks/packages/silica-catalog/src/commerce.ts` (`buyBox`) |
| The renderer that did have it     | `wizeworks/apps/site/components/product-detail.tsx`            |

## The fix

**A `preorder` record, shaped exactly like `madeToOrder`**: sentences, not
values, because the tree has no calendar and `"2027-07-01T00:00:00Z"` cannot
become "ships 1 July 2027" inside a bind.

```text
Preorder — ships 1 July 2027
Strung to order by the workshop in Lyon.
6 left on this run
```

**A `preorderNote()` block in the catalog**, placed beside `madeToOrderNote()`
and above the button for the same reason: it changes what is being agreed to.
`warning`, where the made-to-order note is neutral, because this is not extra
detail about something in the box, it is the reason the box is empty.

**Every key always, even when there is nothing to say.** An ABSENT key is an
unknown ref to the engine, which keeps the node as authored — that is how the
made-to-order panel once rendered as an empty bordered box on every product in
the catalog. Empty strings are found, and the engine drops those.

**Deliberately only for a product sold in ONE version.** A preorder window
belongs to a VARIANT and this record is the PRODUCT, so on a shirtdress where
only the large chalk is on preorder and eight other sizes are on the shelf, a
product-level sentence would promise a March date to somebody buying a size that
ships today. Saying nothing is the honest answer until the version picker can
carry it per version.

**And the SENTENCES moved into `lib/format`, not just the date.** The first
attempt moved `formatArrival` and left each renderer to write its own wording,
and within the hour they disagreed: the template said `Preorder — ships 1 July
2027` and the component said `Preorder: ships 1 July 2027`. One fact, two
voices, written the same afternoon by the same hand. `preorderShipsLine` now has
one home and two callers, so the day the rule holds in one and not the other is
the day [679](679-the-ship-date-was-a-day-early-for-the-customer-too.md) comes
back, and the wording cannot drift on its own.

**The panel is the solid `bg-warning` / `text-warning-content` pair.** It was
first written `bg-warning/10` over `text-base-content`, which was the only
hand-mixed alpha anywhere in the catalog: a theme restating `--color-warning`
would not have carried it, and `base-content` has no promised contrast against a
tinted fill on a dark theme. The token pair is contrast-safe by construction and
is what the low-stock badge in the same file already uses.

**The fifth supply state was missing too.** Checking the rest of the table found
that "Back in stock on …" had never reached this template either. That is
[683](683-the-shop-never-said-when-a-sold-out-thing-comes-back.md), fixed in the
same pass.

## Confirmed by

> **On the shop, as a customer.** The Colette Tennis Bracelet on Juniper Row's
> Journal site, between the description and the button:
>
> > **Preorder: ships July 1, 2027**
> > Strung to order by the workshop in Lyon.
>
> An amber panel with near-black ink, above the Quantity box and the Add-to-cart
> button. **July 1**, which is the day she typed and not June 30 — the whole of
> [679](679-the-ship-date-was-a-day-early-for-the-customer-too.md) holding on the
> page it was written for. Her own sentence about Lyon, verbatim. No scarcity
> line, because that run is uncapped and there is no honest number for "no
> limit".

**And the rule that keeps it honest holds on real pages too.** Her other two live
preorders are on products sold in more than one version, and both say nothing:

```text
colette-tennis-bracelet     1 version     preorder panel: yes
linen-shirtdress           10 versions    preorder panel: no
the-everyday-tee           20 versions    preorder panel: no
```

Both still sell, and neither picked up a spurious sold-out notice. A
product-level sentence on a ten-size dress would promise a March date to somebody
buying a size that ships today, so silence is the correct answer until the
version picker can carry it per version.

**It needed all of it.** The record on this page, the node in the template, the
shared sentence, and the repair that brings an ALREADY STAMPED page up to date
([684](684-a-catalog-fix-reaches-nobody-who-already-has-a-shop.md)). Fixing the
factory changed nothing here: the page was loaded again the moment port 3100 was
free and it still said nothing at all, which is how 684 was found.

## Gap to 10

A multi-version product says nothing, as above. The honest fix is a per-version
preorder line on the picker, which needs the version list to carry it.

Nothing tells the SHOPPER at the checkout or in the confirmation email either.
The page is where the decision is made, so it is the right first place, but a
confirmation that does not repeat the date is the next thing to go wrong.

## Rating effect

Recorded in [rating.md](../rating.md) against `inventory.preorders`, whose Ease
score already carries the cost of the capability not reaching a customer.
