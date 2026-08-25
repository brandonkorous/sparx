# 184 — The page that sells the knit never said it has to be made

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · [026] website half
**Surface:** Juniper Row's own website — the product page
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Devi put five days' notice and a $30 deposit on the Marlow Knit, saved it, and
put it on sale. Her own product page then read, in full:

> **Marlow Knit**
> $96.00
> A heavyweight lambswool crew, knitted to order in our Portland studio…
> Quantity `1`
> **Add to cart**

Not a word about the five days. Not a word about the deposit. A shopper reads
that page, presses Add to cart, and only in the BASKET — after they have
committed — does anything mention "Ready from Saturday, August 29" or the money
split.

## What should have happened

[026]'s own record says it already does:

> **Her website** — the buy box says how long the wait is, what the card will
> actually be charged today, and (only when it is genuinely running out) how many
> are left.

It says the wait. It says the deposit. It was written, it was reviewed, and it
never rendered.

## Why it matters

The wait and the deposit change what somebody is agreeing to, so they belong
before the button and not after it. Somebody buying a birthday present on the
27th needs to know on the product page that the earliest it exists is the 29th —
not two screens later, and not after they have handed over a card.

And a person who does read the basket and backs out has been told the wrong thing
twice: the page implied an ordinary purchase, and the basket revealed a
commitment. That is the shape of a business losing a sale it would have made if
it had simply said so up front.

## Where it lives

The words were written. Nothing rendered them.

[made-to-order-note.tsx](../../../../wizeworks/apps/site/components/made-to-order-note.tsx)
is a real component that says all three things correctly. Its only caller is
[product-detail.tsx](../../../../wizeworks/apps/site/components/product-detail.tsx),
which is the LEGACY section path — and the product route reaches that path only
for a sample-data preview
([app/products/[handle]/page.tsx](../../../../wizeworks/apps/site/app/products/[handle]/page.tsx)).

A live product page takes the branch above it: `getPublishedSilicaCollection`
resolves the `commerce.product` record template and renders it through the silica
walker. That template is
[`buyBox()`](../../../../wizeworks/packages/silica-catalog/src/commerce.ts), a
node tree — image, title, price, low-stock badge, description, add-to-cart form,
typed attributes, policy links — and it had no made-to-order node in it.

So the component was built against the path that was being replaced, and the path
that shipped never learned about it. The data was there the whole time:
`PublicProduct.madeToOrder` is fetched by the route, on the same object the
template binds. **Fetched and never rendered**, which is the commonest defect
shape in this codebase.

## The fix

**The words move out of the component; both paths read them from one place.**

New [made-to-order-copy.ts](../../../../wizeworks/apps/site/lib/made-to-order-copy.ts)
builds the three sentences — the ready day, what happens to the money, and
today's allowance when it is genuinely running out. `MadeToOrderNote` now draws
them instead of writing them, and the silica record carries them as strings.

**Why strings and not values.** The tree has no arithmetic and no calendar: `5`
and `3000` cannot become "we need 5 days to make it" and "Pay $30.00 today"
inside a bind, and a template that tried would need a formatting language. So
`productToSilicaRecord` composes the sentences server-side and the buy box binds
them, the same way `soldOut` and `lowStock` already work.

**Why it self-hides.** The panel hangs on `madeToOrder.shown`, which is ABSENT
rather than false on an ordinary product — the silica engine drops a node whose
ref does not resolve. Each line carries its own condition too, because a deposit
with no notice period and a notice period with no deposit are both ordinary. A
product with none of the three rules renders exactly what it rendered before,
which is every product that existed until this week.

**Where it sits.** Between the description and the Quantity field, above the
button. Not below it.

**It reaches every tenant, not just this one.** The change is in the catalog's
code-authored `commerce.product` template, which is what api-rest falls back to
for any tenant who has not published a custom product page. A tenant who HAS
customized theirs keeps theirs — that is what a builder is for — but nobody has
to do anything to get this.

## Confirmed on screen

As a shopper on `juniper-row`, on the Marlow Knit page, in light and dark and at
360px.

Between the description and the Quantity field:

> **Made to order. Ready from Saturday, August 29 — we need 5 days to make it.**
> This shop takes payment in person, so nothing is charged on this website.

The second line is the honest one for THIS shop, which settles in person — see
[185](185-it-told-her-customer-they-had-paid-at-a-shop-that-takes-no-money.md).

**Dark**: the panel resolves from `bg-base-200` / `border-base-300` /
`text-base-content` and reads correctly inverted; nothing in it is painted.
**360px** (checked in an iframe, not by resizing): the panel fills the column and
both sentences wrap with no horizontal overflow.

Typecheck, lint and prettier clean across the site app, `@wizeworks/silica-catalog`,
`@wizeworks/commerce` and api-rest.

## What is not proven

**The card wording has not been seen on a screen.** "Pay $30.00 today, the rest
when you collect" is the sentence a shop with a working card gateway gets, and no
tenant on this machine has one — Juniper Row's Stripe is chosen but has no keys,
and every other tenant's gateway is inactive or manual. Both sentences travel
through the same two bind nodes, and both of those nodes have now been seen
rendering real text, so what is unproven is which sentence the copy function
returns, not whether the tree draws it.

Proving it needs a tenant with live gateway credentials. Entering an API key is
not something I will do, so this waits for Brandon.

## How to reproduce

1. Put a notice period or a deposit on a product (Sell › Products › Overview ›
   Made to order) and put the product on sale.
2. Open the product on the tenant's own website.
3. Before: nothing between the description and the button.

## Rating effect

None recorded. The tenant's own website has no row in [rating.md](../rating.md) —
the ratings score console panes, and this is the storefront.
