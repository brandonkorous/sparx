# 074 — The screen told her "Request validation failed."

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Thistle & Rye · standing checks — by breaking the product on purpose
**Surface:** mypiggles › Sell › Orders › Money in, and ~81 other panes
**Filed:** 2026-08-21
**Fixed:** 2026-08-21 (commerce only)
**Confirmed by:** P01 · Marisol · order O-000003, on screen 2026-08-21

## What happened

While confirming [066](066-a-cheque-was-spelled-two-ways-and-a-transfer-was-called-ach.md)
I shipped a broken value and recorded a payment with it. The API rejected it, and
the toast Marisol would have read said:

> **Could not write that down**
> Request validation failed.

That is the zod schema layer describing itself. The part that mattered —
_`processor`: expected one of stripe | paypal | manual | check | wire | net_terms_ —
was in the response's `details`, which the screen never looks at.

A shopkeeper reading "Request validation failed" learns nothing, cannot act, and
is left with the impression they typed something wrong. They didn't.

## What should have happened

`orderErrorMessage(error, fallback)` exists precisely to prefer the server's
sentence, and it is usually right to: these routes say things like _"Cannot
cancel an order in status 'delivered'"_, which is better than anything the client
could infer. `VALIDATION_ERROR` is the one code where that is false — the message
is a fixed string about the schema, not about the business — and the caller's own
plain fallback ("Nothing changed on this order. Try again in a moment.") is
strictly better.

## How to reproduce

Send any order-payment write a `processor` outside the enum. Every time.

## Why it matters

It is the error path, which is where a product either keeps somebody's trust or
loses it. And this class of failure only appears when something is already wrong —
so it is exactly the text least likely to be read during normal building, and most
likely to be read by a person having a bad afternoon.

## Where it lives

- [surfaces/commerce/data.ts](../../../apps/workbench/surfaces/commerce/data.ts) `orderErrorMessage` — fixed
- **81 more copies of the same helper**, one per data module:
  `grep -rn "status >= 400 && error.status < 500" piggles/apps/workbench/surfaces` returns 82.

## The fix

**One helper, and all eighty go through it.**
[lib/api-error.ts](../../../apps/workbench/lib/api-error.ts) owns the decision:
server's sentence for a 4xx, caller's fallback for a 5xx, and the caller's
fallback for `VALIDATION_ERROR` or an empty message.

The census made it safe to do in one pass rather than by hand. Eighty-two places
matched, and reading them showed only **five distinct bodies**:

| shape | copies | what it did                                                            |
| ----- | -----: | ---------------------------------------------------------------------- |
| 1     |     74 | `if 4xx return error.message; return fallback`                         |
| 2     |      2 | the same, without braces                                               |
| 3     |      2 | the same, plus a guard on `error.message` being non-empty              |
| 4     |      1 | the order pane, already carrying the `VALIDATION_ERROR` branch         |
| 5     |      1 | `productErrorMessage`, which first unwraps a `VariantAfterCreateError` |

All eighty had the identical signature `(error: unknown, fallback: string):
string`, so **every exported name was kept** and not one call site changed — each
body simply became `return apiErrorMessage(error, fallback);`. Shape 5 keeps its
unwrap and then delegates. The empty-message guard that only two of them had is
now what all eighty do.

Two files were deliberately **not** touched, and the migration refused them rather
than guessing: `email/sequences-data.ts` and `scheduling/reports-data.ts` use the
same `4xx` condition in a **retry predicate** ("a 4xx is an answer, not a blip"),
which is a different decision that happens to look alike.

### The second leak, which only the screen found

Fixing the pane was not enough. `WriteFailureReporter` — the global floor under
every failed write — had its own copy of the same reasoning, and it renders
**beside** the pane's toast. So the first re-test showed both at once:

> Could not write that down · Nothing changed on this order. Try again in a moment.
> That didn't save · **Request validation failed.**

[lib/api/write-failure.ts](../../../apps/workbench/lib/api/write-failure.ts) now
makes the same exception. Nothing in a static check could have caught this: both
messages were individually plausible, and only seeing them stacked showed that
one of them was still the schema talking.

## Confirmed by

Re-run as Marisol on 2026-08-21. Both orders were paid by then, so a fresh one was
placed through her own shop the way a customer would — **O-000003, $8.00, collect
in person, unpaid** — and the payment form on it was given a value the enum
rejects.

Before the fix, on the same form:

> Could not write that down · **Request validation failed.**

After:

> **Could not write that down** — Nothing changed on this order. Try again in a moment.
> **That didn't save** — That didn't save. Check what you entered and try again.

Both paths, both in her words. The deliberate break was reverted immediately and
`grep` confirms no test value remains in the tree.

Two things confirmed on the way through, for free:

- **The cart still merges** — two Butter croissants showed as one row of two at
  checkout, which is [063](063-two-of-the-same-bun-made-two-rows.md) holding.
- **[064](064-a-customer-collecting-a-bun-had-to-type-a-postal-address.md) is
  unchanged and still open** — seven address fields, then "See your options"
  reveals **Collect in person** as the only one. O-000003's order record now
  carries `14 Mercer Lane, Ashfield, OR, 97401` for a loaf being picked up off a
  counter, which is exactly the shape Brandon has to decide about.
