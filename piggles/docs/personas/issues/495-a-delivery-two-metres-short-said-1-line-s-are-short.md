# 495 — A delivery two metres short said "1 line(s) are short"

**Status:** fixed
**Severity:** minor
**Found by:** Devi booking in 38 of 40 metres of linen
**Surface:** `inventory.receiving.detail` · `inventory.supplier-bill.new` (both consoles)
**Filed:** 2026-09-09

## What was wrong

The dialog that asks her to confirm a delivery, the last thing she reads before
her stock numbers move:

> **1 line(s)** are short of what was outstanding; **1 line(s)** had some damaged
> units — recorded and written off, not added to sellable stock or counted
> against the order.

`line(s)` is a programmer writing a plural they could not be bothered to work
out. "1 line(s) **are**" is not English either.

Five places, in both consoles:

| file                          | string                                             |
| ----------------------------- | -------------------------------------------------- |
| `inventory/receipt-detail`    | `N line(s) are short of what was outstanding`      |
| `inventory/receipt-detail`    | `N line(s) have more than was expected`            |
| `inventory/receipt-detail`    | `N unit(s) across N line(s) arrived fully damaged` |
| `inventory/receipt-detail`    | `N line(s) had some damaged units`                 |
| `inventory/supplier-bill-new` | `N line(s) do not agree with the delivery`         |

## Why it matters here

This is the console for people who are not in software. The house rule is
`assume zero technical vocab in ALL user-facing copy`. `(s)` is a shape only
somebody who has read code recognises as "one or many"; to everybody else it is
a typo in the sentence that appears at the moment their stock numbers change.

## And the part that stings

`plural(count, one, many)` is exported from `./data`, is **already imported at
the top of `receipt-detail.tsx`**, and is used **twenty lines below** the four
strings that say `line(s)`:

```tsx
import { formatCents, plural } from './data';
// …
will be spread across {plural(toBook.length, 'line', 'lines')} on this
```

The helper was right there, in the same file, in the same component. Same shape
as [478](issues/478-she-added-a-supplier-and-was-told-it-was-not-saved.md)
clearing panes whose fix sat in the `else`: the answer was present and the code
in front of it never asked.

## The fix

`plural()` at all five, plus the verb, which `plural` cannot know:

```ts
notes.push(
  `${plural(shorts.length, 'line', 'lines')} ${shorts.length === 1 ? 'is' : 'are'} short of what was outstanding`
);
```

`plural` was added to `supplier-bill-new`'s import; it was the one of the five
that did not already have it.

## Proven

Booking 38 of 40 with 2 damaged now reads:

> **1 line is** short of what was outstanding; **1 line** had some damaged units
> — recorded and written off, not added to sellable stock or counted against the
> order.
