# 685 — The plural helper stopped at the noun

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 242
**Surface:** mypiggles — the search box, and twelve more sentences behind it
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi typed into the search box at the top of the console. Under the results:

> 4 records matched. The rest are screens. **1 customer are not in this box yet,
> so it cannot look at them.**

Beside it, a button reading **Put them back** about the one customer.

## Why

`blindSpot()` has named a single record in the singular since the day it was
written — it calls `plural(1, 'customer', 'customers')` and gets "1 customer".
The sentence built around it did not:

```ts
const cannotSee = blind
  ? ` ${blind.label} are not in this box yet, so it cannot look at them.`
  : '';
```

The noun agreed. The verb and the pronoun were both written for a crowd, and
nothing was watching the rest of the sentence.

`check-counted-in-words.mjs` exists for exactly this family and its own header
says the rule out loud — "Count in words. Both branches, **and the verb with
them**" — but it only catches `thing(s)`. The verb half of its own rule had no
enforcement.

The button had the same shape one file away. `products-list-notices.tsx` has
agreed with its count since issue 318:

```tsx
{
  unfindableCount === 1 ? 'Put it back' : 'Put them back';
}
```

The launcher, doing the same job on the screen somebody is actually standing on
when the box says it has never heard of their best seller, did not.

## The sweep

A parser pass over both consoles and every package `src` found every template
that calls `plural()` and then uses a plural-only word, skipping any sitting in
the else-arm of a `=== 1` guard. 36 hits, 18 distinct. Reading each in full:

**Thirteen were real** and are fixed:

| Sentence                          | Said at a count of one                                                      |
| --------------------------------- | --------------------------------------------------------------------------- |
| stock count, two screens          | "We currently think there **are** 1 unit here"                              |
| taking something apart            | "1 unit of X **stop** being sellable"                                       |
| removing a shelf                  | "Move **them** … **they** stay counted … nobody can find **them**"          |
| writing off expired stock         | "5 units **comes** off the shelf" (wrong the other way)                     |
| a short pick                      | "**Those shelves are** on a count now"                                      |
| closing a preorder                | "1 order already committed **stay** owed"                                   |
| printing labels                   | "**The labels are** below"                                                  |
| a damaged delivery                | "the order stays open for **them**"                                         |
| stock value                       | "short by whatever **those** cost"                                          |
| a stock import                    | "Create **them** as new items"                                              |
| a transfer                        | "marks **them** in transit … can sell **them** until **they are** received" |
| removing a service, two sentences | "**They** keep **their** time and **their** price"                          |
| re-checking backorder dates       | "1 commitment still **have** no date … **Those** need"                      |

**Five were false alarms** and were left alone, because the plural word belongs
to a different noun in the same sentence: "The rest are screens", "Your on-hand
numbers are corrected", "Those figures are from the last good run", "expired
goods are a buying problem", "whoever you are signed in as".

## Why there is no new check for this

A mechanical rule cannot tell those two groups apart. The plural word has to be
read against the noun it belongs to, and a third of the hits were correct code.
A guard that cries wolf on a third of its findings is a guard somebody switches
off, so this one is a sweep plus a habit rather than a check.

The habit already exists in the codebase and is the thing to copy: put the verb
INSIDE the plural call, where it cannot be forgotten.

```ts
plural(total, 'booking was', 'bookings were');
plural(n, 'unit has', 'units have');
plural(n, 'row carries a code', 'rows carry codes');
```

## Confirmed

Typed into the search box again. The line reads:

> 4 records matched. The rest are screens. **1 customer is not in this box yet,
> so it cannot look at that one.**

and the button reads **Put it back**.

## Files

- `piggles|sparx/apps/workbench/components/launcher-search-words.ts`
- `piggles|sparx/apps/workbench/components/launcher-rows.tsx`
- thirteen sentences across `surfaces/inventory`, `surfaces/commerce`,
  `surfaces/scheduling`
- `launcher-search-words.test.ts` — two new tests, the first proved red against
  the old sentence (1 failed, 12 passed) before it was believed
