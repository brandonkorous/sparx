# 878 — A sale could belong to no shop at all

**Status:** fixed
**Severity:** **major** — a sale that lands with no site is in no site's takings,
does not count towards the page that earned it, and is withheld from every team
member whose access is limited to named sites. Nothing anywhere says a sale went
missing; the totals are simply smaller than the truth
**Found by:** P03 · act 312, sweeping Site by data weight
**Surface:** mypiggles › Invoices › a quote › Turn it into an order; and every
per-site figure downstream of it, in both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 7 tests, every rule proved red on a plausible wrong version;
the same action driven twice on her own screen, before and after; and a real
renewal run end to end against the database

## Measured

```
Juniper Row's orders                                          27
carrying no site                                               2
  · O-000020  $504.00  fulfilled   made from quote Q-000017
  · O-000017   $58.00  placed      a subscription renewal

billing documents on the platform                            106
carrying a site                                              106      (NOT NULL)

orders on the platform                                       123
carrying no site                                              12      across 5 tenants
subscriptions on the platform                                  1      (hers)
```

Every quote knows which shop it was written for. The order made from one knew
nothing.

## What she sees

Her **How your pages do** panel opens with this, in a coloured box:

> **None of your 11 sales could be tied to a page**

She made **13** in that window. Two of them are not in the sentence, not in the
denominator, and not anywhere else on the screen that might explain their
absence. The number is not marked as partial, because nothing in the chain knows
it is.

And on the order itself, the line under the customer's name:

```
O-000020    Placed Sep 22, 2026 · Added by hand
O-000028    Placed Sep 30, 2026 · Added by hand · Juniper Row
```

Two identical actions — accept a quote, turn it into an order — one before this
fix and one after. The shop's name is simply not there on the first.

## The chain

`Order.propertyId` is nullable and `BillingDocument.propertyId` is NOT NULL, so
the conversion always had a site in its hand:

```ts
const order = await tx.order.create({
  data: {
    tenantId: ctx.tenantId,
    customerId,
    orderNumber,
    status: 'placed',
    // ...twenty more fields, and no propertyId
  },
});
```

The same hole, one layer up, in `POST /v1/orders`: the route passed
`request.body` straight to `orderService.create`, which does
`propertyId: input.propertyId ?? null`. So a sale rung up through that route
belonged to a site only if the caller remembered to name one, while the request
carried the active site in `x-sparx-property-id` the whole time.

## Why a null there is not "all sites"

This is the part worth writing down, because it is where the two kinds of record
part company.

A **catalog item** with no site is SHARED — visible on every one of them. That is
a real and useful state, and it is why `defaultPropertyIdsToActiveSite`
deliberately leaves a single-site tenant alone.

A **sale** with no site is in nobody's takings. Every per-site read selects
`property_id IN (…)`, which no null row satisfies. And `order-service.ts` is
explicit about what it takes a null to mean:

```ts
// Member access ceiling (docs/131 §3.3): a restricted member sees only
// orders on their granted sites — NOT null-property (orphaned) orders,
// which belong to a deleted business they have no claim to.
```

So the missing field did not merely lose a label. It filed a live $504 sale
under "a business that no longer exists", and an assistant given the keys to the
shop that made it could not see it.

## This was found once already

`checkout-service.ts` carries the scar:

> _"The order used to take `cart.propertyId` raw, so every primary-site order
> was site-less and vanished from every site-scoped money view (Finance →
> Payments read 'No payments yet' on a paid order — BUG-004)"_

The fix landed in checkout and nowhere else. Three of the four ways an order
comes into existence on this platform were still doing it.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

1. **The quote conversion** carries `doc.propertyId` onto the order. One line,
   and there was never a case to admit: the column it reads is NOT NULL.
2. **`POST /v1/orders`** defaults the site to the one the person is standing in,
   using the same `x-sparx-property-id` the site switcher already sets. An
   explicit id is honored verbatim, and so is an explicit `null` — a caller that
   goes to the trouble of sending null is saying the sale belongs to no site,
   which is a different statement from saying nothing at all.
3. **A subscription now records the site it was signed on**, so its renewals can
   inherit it. That half needs a column; see below.

The rule lives in `defaultOwningSiteToActiveSite`, named "owning site" rather
than "scope" so it cannot be misread as the plural catalog helper sitting six
lines above it: a catalog item is VISIBLE on sites, these records BELONG to one.

## The half that needed a column

A renewal order is minted by a worker months after the signup, with nothing in
hand but the subscription row, and `commerce_subscriptions` carried no site.
There was nothing to inherit, so every renewal on this platform landed site-less
by construction.

`commerce_subscriptions.property_id` is `SetNull` like `Order`, with an index on
`(tenant_id, property_id)`. Applied to the dev database and recorded through
`prisma migrate resolve`; it reaches production the ordinary way, in the release
pipeline's data stage. [[feedback_data_is_a_deploy_stage]]

**Nullable, and deliberately not backfilled.** A row written before the column
existed cannot be told apart from a subscription that genuinely has no site, and
picking the tenant's primary for the old ones would file real money against a
shop that never took it. Old subscriptions keep renewing site-less, which is
what they have always done and is at least honest.
[[feedback_never_present_absence_as_measurement]]

## Proved

**5 tests**, every rule proved red by breaking the thing it guards:

```
drop `propertyId: doc.propertyId`      →  "expected null to be <second site>"
                                       →  "expected [] to include <order id>"
copy the catalog rule (skip 1 site)    →  "defaults to the active site even for a SINGLE-site tenant"
guard on truthiness, not undefined     →  "honors an explicit null"
resolve unconditionally                →  2 fail: the explicit id, and the explicit null
fall back to the primary on create     →  "stores no site when none is given, rather than guessing one"
ignore the caller's id on create       →  "stores the site it is given, rather than the tenant primary"
```

The last two lock the contract the renewal leans on, at both ends. The plausible
wrong version there is not "forgets the field" but "helpfully falls back to the
tenant's primary", and that one files a renewal against a shop that never took
it.

The conversion fixture puts the quote on a **second** site on purpose. A
conversion that forgot the field and a conversion that quietly reached for the
tenant's primary are both wrong, and against a single-site fixture they both look
right. [[feedback_a_test_that_cannot_go_red]]

**Checks:** api-rest 109 files / 663 (the full suite, database tests included),
crm 66 files / 597, commerce 25 files / 246. Typecheck 0 on `@wizeworks/crm`,
`@wizeworks/commerce`, `@wizeworks/commerce-schemas` and api-rest.
`prisma validate` clean.
Guards green: `check:migration-order`, `check:migration-drops`,
`check:prisma-selects`, `check:nullable-inputs`, `check:boundaries`,
`check:routes`, `check:events`, `check:em-dashes`, `check:american-spelling`,
`check:field-names`, `check:inventory-api`, `check:copy-key-sentences`,
`check:piggles-plain-words`. ESLint and prettier clean on every changed file
except the one line above.

**Driven end to end on her own screen.** Q-000016 (Tamsin Vale, 40 × The Everyday
Tee, $1,008.00) moved to **Accepted** — _"they said yes · Will freeze a permanent
record of it"_ — then **Turn it into an order**. It reported **"Order O-000028
created"** and the order opened reading **"Placed Sep 30, 2026 · Added by hand ·
Juniper Row"**. Her previous conversion, by the identical path eight days
earlier, still reads **"Placed Sep 22, 2026 · Added by hand"** and nothing more.

**The renewal was run for real**, against the database, on a throwaway tenant
with two sites: a subscription signed on the second one, made due, then put
through `subscriptionService.processOccurrence`. The order it minted
(`source: subscription_renewal`) landed on the second shop, not the primary.
Removing the one line that carries it put the same order back on `null`. That
check is not a committed test file — `@wizeworks/commerce` has no
database-backed harness and CI runs without a database, so a `.test.ts` there
would go red in CI. The contract it exercises is pinned by the two
`orderService.create` tests above, which do run.

## Files

- `wizeworks/packages/crm/src/services/billing-document-conversion-service.ts`
- `wizeworks/packages/crm/test/integration/order-keeps-its-site.test.ts` (new)
- `wizeworks/services/api-rest/src/lib/property.ts`
- `wizeworks/services/api-rest/src/lib/commerce-context.ts`
- `wizeworks/services/api-rest/src/lib/property-scope.test.ts`
- `wizeworks/services/api-rest/src/routes/v1/orders.ts`
- `wizeworks/services/api-rest/src/routes/v1/commerce/providers.ts`
- `wizeworks/packages/commerce/src/services/subscription-service.ts`
- `wizeworks/packages/commerce-schemas/src/subscriptions.ts`
- `wizeworks/packages/db/prisma/schema/41-commerce-subscriptions.prisma`
- `wizeworks/packages/db/prisma/schema/08-property.prisma`
- `wizeworks/packages/db/prisma/migrations/20270524000000_a_standing_order_remembers_which_shop_it_was_signed_on/migration.sql` (new)

## The thing to remember

**A field that four writers must each remember is a field three of them will
forget, and the screens will not say so.** There is no error, no empty state, no
badge — the totals are just smaller. The one that got it right had already been
burned once and carried the comment to prove it.

The measurement that finds this shape is not "does this column have a writer"
(it had four), it is **"which of the writers disagree with each other"**. Count
the rows that are null and group them by how they were made; the ones that
cluster are the callers that forgot.
