# 259 — A notification that would not say what, and would not take her there

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 11 — Monday morning, opening "What has been happening"
**Surface:** mypiggles › Home › What has been happening (and the bell)
**Filed:** 2026-08-26

## What happened

One unread notification was waiting for Devi:

```
▸  is out of stock                                          17m ago
   Customers cannot buy this until it is back in stock.
```

The title begins with a blank. The body says customers cannot buy **this**, and
"this" has no antecedent anywhere on the row. Clicking it leads nowhere.

The stored row:

```
kind        | inventory.depleted
title       | is out of stock
body        | Customers cannot buy this until it is back in stock.
entity_type | ProductVariant
entity_id   |
```

She is told something in her shop cannot be bought, and denied both the name of
it and a way to reach it.

## What should have happened

"The Ash Overshirt is out of stock", opening that size's stock screen.

## Why it matters

- **A notification is nothing but its subject.** Every other field is context.
  This one kept the context and dropped the subject.
- She had no other way to find out. Home said everything was fine ([258]), and
  the Stock list is 62 rows.
- The row consumes the thing notifications spend — attention — and returns
  nothing for it. A few of these and the bell is furniture.

## Where it lives — three separate faults, all silent

### 1. `entityType` names a Prisma model, not a link key

[format.tsx](../../../apps/workbench/components/notifications/format.tsx) is
emphatic about what a notification owes its reader:

> "A notification that only marks itself read is a dead end: it announces
> something and then makes you go find it."

It resolves the destination through `@wizeworks/links` —
`routeForEntity(entityType)` — which is a plain, case-sensitive `Map.get` over
the `entity:` keys in
[routes.ts](../../../../wizeworks/packages/links/src/routes.ts). Those keys are
lowercase: `order`, `subscription`, `customer`, `product`.

All three notification seeds were written with **Prisma model names**:

| seed                 | wrote            | table has      |
| -------------------- | ---------------- | -------------- |
| Payment failed       | `Order`          | `order`        |
| Out of stock         | `ProductVariant` | _nothing_      |
| Subscription payment | `Subscription`   | `subscription` |

`byEntity.get('Order')` is `undefined`, so `destinationFor` returns null at its
first branch. **Every notification this platform writes has been a dead end**,
not just the inventory one.

### 2. No seed sets `entityId` at all

Not one of the three. `destinationFor` needs it for any route with a `:param`,
and returns null without it — so even the correctly-named ones would still lead
nowhere.

`notify.ts` guards that field: _"Only a real uuid — a templated miss must not
write a broken link."_ The guard is right and has never had anything to guard:
the config key it reads was never present.

### 3. No route claimed the variant

`/inventory/stock/:variantId` had no `entity:` key, so no `entityType` could
ever reach the one screen that shows a single size's stock.

## And the empty title

`fill()` in
[notify.ts](../../../../wizeworks/packages/automation/src/actions/notify.ts)
collapses an unresolved `{{…}}` to empty, deliberately: rendering a raw
`{{product.title}}` at a person reads as a broken product. That is right as far
as it goes, and it means a missing field silently produces a headless sentence
instead.

**This exact failure has happened before on this exact template family.** From
the builtins resolver:

> `order.payment_failed` — "The failure side of payment, not just the success
> side: without it the payment-failed notification seed renders 'Payment failed
> on order ' with `{{order.number}}` resolved to nothing — the one detail that
> makes the notification actionable."

It was fixed by remembering to add one more event to one more list. Nothing
stops the next omission, because a resolver you forgot to register produces a
notification that looks exactly like a working one.

## The fix

**The seeds name link keys and carry ids.** `order` + `{{order.id}}`,
`subscription` + `{{subscription.id}}`, `variant` + `{{variant.id}}` — the
variant rather than the product, because one size being gone is what happened
and its stock screen is where she puts it right; the product page would open on
a product whose other sizes are fine. `hydrateInventory` already exposes
`variant.id`.

**`/inventory/stock/:variantId` claims `entity: 'variant'`**, so that type has a
home.

**`platform.notify` will not write a headless title.** `fill` now reports which
paths came back empty, and a title with an unresolved placeholder writes no row
and records the reason in the run ledger instead — the same shape as the
existing "no recipients in audience" outcome, so the rest of the run continues.
Body is deliberately not guarded: it is supporting prose, the title carries the
fact, and a notification is worth sending with a thin second line.

Guarding the TITLE rather than each resolver is the point. Registering the right
resolver is a per-event thing somebody has to remember; this catches every one
they don't.

**And a check that goes red.**
[check-notification-entities.mjs](../../../../scripts/check-notification-entities.mjs)
reads the `entityType`/`entityId` literals out of the seeds and the `entity:`
keys out of the route table, and fails if a notification could not lead
anywhere. Wired into `pnpm check:notify-entities` and the pre-push guard beside
`check:routes`.

Proven red three ways before being trusted, each reproducing a real fault:

```
entityType 'Order' is not an entity in …/routes.ts. It must be the route
  table's key (lowercase, e.g. 'order'), not a Prisma model name.

entityType 'variant' lives at /inventory/stock/:variantId, which takes a
  record id, but this notify config sets no entityId.

…/seeds/moved-away.ts does not exist. This check scans a fixed list of
  paths, so a moved file makes it pass over nothing.
```

The third matters as much as the first two: this check names its scan roots, so
without that guard a file move would leave it scanning nothing and printing a
tick ([[feedback_structural_checks_go_blind]]).

## What is confirmed, and what is not

**Confirmed:** the check catches both original faults and passes on the fix;
`links`, `automation`, `automation-actions` and `inventory` typecheck and their
suites pass (55 + 37 + 21 + 63); `check-surface-routes` still reports 340
surfaces all addressed.

**Not yet seen on screen.** A tenant's system automations are COPIED into
`automations` at seed time, and Juniper Row's row still holds
`"entityType": "ProductVariant"` with no `entityId` — so her existing
notification stays broken until the rule is re-seeded. That happens on its own:
`reconcileSystemSeeds` re-upserts every system rule for every module-active
tenant daily, and `upsertSystemAutomation` refreshes the live document in place.
So this needs no migration and no backfill, but it also means the corrected
notification cannot be produced on demand today. The already-written row keeps
its blank title; it is history, not a live defect.

## Related

[[feedback_absent_behaves_like_fine]] — three faults here, and all three render
identically to correct behavior until somebody clicks. A missing route key, a
missing config field and an unregistered entity are each invisible to
typecheck, lint and every test.

[[feedback_never_present_absence_as_measurement]] — the sibling of [258], found
in the same ten minutes on the same subject: one screen would not say a size was
gone, and the other would not say which one.

[[feedback_one_outcome_two_causes]] — "Customers cannot buy this" is advice that
cannot be followed, because the sentence does not carry the fact it needs.

## Rating effect

What has been happening, in [rating.md](../rating.md). Recorded in the run log
of [03-juniper-row.md](../03-juniper-row.md).
