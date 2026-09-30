# 861 — One size ran out and the bell said the product was gone

**Status:** fixed
**Severity:** **moderate** — the only notification on the platform, and it told a
shop owner her best-selling tee was out of stock when one size in one color had
run out and she had 75 tees on the shelf
**Found by:** P03 · act 303, opening the bell because it had a 1 on it
**Surface:** mypiggles › the notifications bell, and the low-stock email
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the notification row joined to its own variant, and a database
integration test that fails on the old wording

## What the bell said

```
Notifications                                   Mark all read
The Everyday Tee is out of stock        3d ago
Customers cannot buy this until it is back in stock.
```

## What was true

```sql
SELECT count(*) AS versions, count(l.variant_id) AS counted,
       sum(l.on_hand) AS on_hand, count(*) FILTER (WHERE l.on_hand = 0) AS at_zero
  FROM commerce_products p … WHERE p.title = 'The Everyday Tee';
```

```
 versions | counted | on_hand | at_zero
       35 |      15 |      75 |       1
```

**Thirty-five versions. One at zero. Seventy-five tees on the shelf.** The one at
zero is `THE-EVERYDAY-M-BLACK` — medium, black. Every other size and color she
stocks is there, four to six deep.

So the sentence is false about the product, and the body makes it worse:
"Customers cannot buy this until it is back in stock." They can buy 34 other
versions of it right now.

## The row knew exactly which one

```sql
SELECT n.title, n.entity_type, v.sku, l.on_hand
  FROM notifications n JOIN commerce_product_variants v ON v.id = n.entity_id …
```

```
 The Everyday Tee is out of stock | variant | THE-EVERYDAY-M-BLACK | 0
```

`entity_type = 'variant'`. The notification points at the exact version. The
title names the product. [[feedback_fetched_but_never_rendered]]

## And the argument was four lines below the wrong line

The seed, in full, from `seeds/notifications.ts`:

```ts
title: '{{product.title}} is out of stock',
body: 'Customers cannot buy this until it is back in stock.',
// The VARIANT, not the product: one size being gone is what happened,
// and its stock screen is where she puts it right. The product page
// would open a page on which most sizes are fine.
entityType: 'variant',
entityId: '{{variant.id}}',
```

Somebody worked out that the event is about **one size**, wrote down that a
product-level answer would show "a page on which most sizes are fine", and applied
it to the LINK. The SENTENCE four lines above says the product.
[[feedback_a_fix_leaves_its_neighbour_behind]]

This is the fourth time this pass that the right reasoning was already in the file
and stopped one line short.

## The naming module already existed, for exactly this

`wizeworks/packages/inventory/src/services/variant-label.ts` opens in capitals:

> **HOW AN ITEM IS NAMED ON A SCREEN, in one place.**

It was written for issue 681 because **six** inventory services each built their
own answer and five got it wrong. It returns two fields and insists on both:

> `productTitle` is what the thing IS and `variantName` is which one of them — a
> row needs both, because the product alone cannot tell two sizes apart.

The automation resolver was the seventh, and it built its answer from
`product.title` alone. It now calls that module.

## Why ONE field and not a second placeholder

The obvious fix is `'{{product.title}} ({{variant.name}}) is out of stock'`. It
would have been a worse bug, and the reason is in `notify.ts`:

> A title is not decoration — it IS the notification… So: write nothing, and say
> in the run ledger which path came back empty.

**A `platform.notify` title with any empty placeholder is not sent at all.** A
product with one unnamed version has no option label, so `variant.name` comes back
empty and the notice would have been silently dropped — for exactly the simplest
shops, the ones with one version of everything.

So the resolver returns **`item.name`**, which always resolves:

```
many versions   The Everyday Tee (Medium / Black)
one version     Trail Runner 40L Pack
```

The existing integration test covers the second case and passed unchanged, which
is what proves the fallback rather than assuming it.

## The email had it too, and it is worse there

```ts
subject: 'Low inventory: {{product.title}} · {{inventory.quantity}} remaining';
```

Same mistake, in her **inbox** rather than a bell she can ignore. Now
`'Running low: {{item.name}} · {{inventory.quantity}} left'` — and "Low inventory"
went with it, because the console calls this **Stock** and an owner is not a stock
controller. [[feedback_non_technical_audience]]

## How far it reaches

```
depleted notices on the platform          1   ← hers, and about one version of many
products with more than one version     224 of 619   (36.2%, largest has 96)
"Notify: out of stock"  active on         23 tenants   (15 + 8 under its former name)
"Low inventory alert"   active on         56 tenants
```

The sample is one notice and it is wrong. The exposure is **36% of every product
on the platform**, on automations live for 23 and 56 tenants.

**A caveat worth stating:** 8 of those 23 rows still carry the automation's former
name, `Notify — out of stock`, so they have not been reconciled since that rename
shipped. `upsertSystemAutomation` writes `actions` in place, so the fix lands on a
tenant the next time their seeds reconcile, and not before. That is the reconcile's
normal behavior on a dormant tenant, not a second defect, but it does mean "fixed
for 23 tenants" would be the wrong claim.

## Proved

**1 new integration test against the real database**, and **proved red** by putting
`{{product.title}}` back. The failure message is the bug verbatim:

```
AssertionError: expected 'The Everyday Tee is out of stock'
                to be   'The Everyday Tee (Medium / Black) is out of stock'
```

It builds a product with Size and Color declared **out of alphabetical order** on
purpose, because the label has to come out in the order the shop set up. And it
asserts the link still points at the variant, which the seed already had right.

**Checks:** typecheck 0 on `inventory` and `automation-actions`. Tests:
automation-actions 6 / 6 against the live database (was 5), full suite 3 files /
25, inventory 12 / 153. Guards `boundaries`, `american-spelling`, `em-dashes`,
`plain-words` green. ESLint and prettier clean. No new package dependency —
`@wizeworks/inventory` was already a dependency of `automation-actions`.

## Files

- `wizeworks/packages/inventory/src/index.ts` (re-exports the naming module)
- `wizeworks/packages/automation-actions/src/resolvers.ts` (`item.name`, `variant.name`)
- `wizeworks/packages/automation-actions/src/seeds/notifications.ts` (the bell)
- `wizeworks/packages/automation-actions/src/seeds/commerce.ts` (the email subject)
- `wizeworks/packages/automation-actions/test/integration/notify.test.ts`

## The thing to remember

**A template is a sentence somebody wrote once and nobody ever reads again.** Six
words in a seed decided what every out-of-stock alert on the platform says, and
the person who wrote the line below it had already worked out why those six words
were wrong. Nothing compares a title to the thing it is about, so no check could
have caught it and none did.

And the one that keeps repeating: **the fix for this existed, as a module, with
its purpose in capital letters at the top.** `variant-label.ts` was extracted
because five services got this wrong. A sixth arriving later does not read the
module it has never heard of, so "one place for this" only holds if the next
caller finds it — which is an argument for exporting it from the package root,
which is the other half of this change.
