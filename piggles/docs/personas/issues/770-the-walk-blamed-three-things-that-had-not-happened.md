# 770 — The walk blamed three things that had not happened

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 272
**Surface:** platform — `generatePickList`, reached from every order pane
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** P03, pressing the button and reading the new refusal
**Blocked on:** —

## What happened

Order O-000020, an hour old, 12 knits outstanding, on no walk at all. She
pressed **Send to the warehouse**, which is the one commit action in that pane's
header:

> **Could not create a walk**
> Every line on these orders is already **picked**, already on **another walk**,
> or has **nothing left to fulfill**.

Three things. None of them true. There was no walk to find, nothing had been
picked, and every one of the 12 was still owed. So she goes looking for a walk
that does not exist, and the thing she actually had to do is not on the list.
[[feedback_one_outcome_two_causes]]

## Why

There is a **fourth** cause the sentence never mentions, and it is the common one:

```ts
if (!line.variantId) {
  // A free-text order line has no stock record to walk to.
  if (!input.includeUnstocked) continue;
  ...
}
```

A line that names no product has no stock record, no shelf and nothing to walk
to. It was skipped, `staged` came out empty, and the one message fired.

Every order converted from a quote is this shape, because a quote is priced as
lines of description and a price. MEASURED 2026-09-22: **4 orders on the
platform are entirely free-text lines**, and all 4 answer that button this way.

## The flag that was meant to cover it could only ever crash

`includeUnstocked` put such a line on the walk unallocated. It had never been
called — not from either console, not from anywhere — so nobody found out that
it builds a row like this:

```ts
variantId: s.line.variantId!,   // null, for a free-text line
```

against a column that is not nullable. Proved, in a transaction that was rolled
back:

```
ERROR: null value in column "variant_id" of relation
       "inventory_pick_list_lines" violates not-null constraint
```

So the only thing setting the flag ever did was trade a plain refusal for a
database error. And the MCP tool `generate_pick_list` hands its whole input
schema to whoever is driving the server, so an agent could reach it today.

The comment in the row builder said the opposite of what the code did:

> A staged line reaches here only with a variant: the `includeUnstocked` branch
> above pushes free-text lines and this map is not reached for them.

It pushes them into the same `staged` array that map reads.
[[feedback_verify_capability_in_code_not_docs]]

## What was done

**The refusal names the cause it has**, and the remedies that cause actually has:

> Nothing on this order is a product you stock, so there is no shelf to walk to.
> Put the product on the line, or send it by hand from the order itself.

**A mixed order refuses too, rather than walking half of it.** The function's own
header has always said so:

> A pick list that quietly leaves something out is worse than one that will not
> generate: the picker completes it, the order ships short, and nobody finds out
> until the customer does.

It was doing exactly that — staging the stocked lines and dropping the rest.
Now the lines that cannot go are collected before anything is written, and the
whole generation refuses, counting them in words rather than as `1 line(s)`.

**The flag is gone**, from the service and from the input schema, so nothing
offers a switch that can only fail. Supporting free-text lines on a directed
walk would need `inventory_pick_list_lines.variant_id` to become nullable, which
is a migration; the schema's own comment argued against it anyway ("a line with
no shelf on a directed pick list is a line people learn to skip").

## Files

- `wizeworks/packages/inventory/src/services/pick-lists.ts`
- `wizeworks/packages/commerce-schemas/src/picking.ts`
- `wizeworks/packages/inventory/src/services/pick-unstocked-lines.test.ts` — NEW

## Proof

Read on screen 2026-09-22:

```
Could not create a walk
Nothing on this order is a product you stock, so there is no shelf to walk to.
Put the product on the line, or send it by hand from the order itself.
```

**And the remedy it names works.** Devi did the second one: Deliveries → USPS →
tracking number → Mark it as sent. The order moved to **On the way**, and
**Shipping confirmation: email** ran and completed against it.

Generating a walk needs a transaction, so a behavioral test is in the DB suites
CI skips — which is how a flag that cannot work survived a green run. The guard
reads the source the way `pick-expiry-gate.test.ts` does. Proved red by putting
the old branch and the old flag back:

```
× collects a free-text line instead of staging it
× offers no flag for putting one on the walk anyway
× refuses rather than building a walk that leaves a line out
× names the remedy this cause actually has
Tests  4 failed | 1 passed (5)
```

[[feedback_a_test_that_cannot_go_red]]

## One caught in the act

The first draft of the new refusal said `1 line(s) on this order`.
`scripts/check-counted-in-words.mjs` failed the build on it and printed the
remedy. Both branches are written out now.
