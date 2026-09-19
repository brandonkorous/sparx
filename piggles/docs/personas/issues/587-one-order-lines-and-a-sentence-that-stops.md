# 587 — "1 order lines", "3 lines", and a sentence that stops

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on Stock → Stock versus your books
**Surface:** `wizeworks/packages/inventory/src/services/gl-reconciliation.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_non_technical_audience]] · [[feedback_a_promise_in_copy_is_a_contract]]

## What she saw

The reconciliation is one of the best screens in the console. Every ordinary
reason her stock figure and her books differ is named and priced. Three things on
it were wrong at once, and all three are in the same eight lines of copy.

| Line                                 | Said              | Should say   |
| ------------------------------------ | ----------------- | ------------ |
| Invoiced, not yet on your shelves    | **1 order lines** | 1 order line |
| In your building, but not yours      | **0 lines**       | 0 items      |
| Priced by you, not bought through us | **3 lines**       | 3 items      |

And under **Units with no cost behind them**:

> 375 units counted with no purchase behind them. They are valued at nothing
> here; **an opening balance in your books may not have**

## Why, one at a time

### The plural

Seven counts, seven hard-coded plurals:

```ts
reference: `${valuation.totalUnits} units on hand`,
reference: `${Number(timing?.inr_lines ?? 0)} order lines`,
```

Devi has exactly one late supplier bill, so she is the business that reads it.
Every one of the seven says the same thing the day a number lands on 1.

### The noun

Two of them do not count lines at all:

```sql
SELECT ..., COUNT(*)::bigint AS levels
FROM inventory_levels l
```

A row in `inventory_levels` is **an item at a location**. The screen called three
of them "3 lines", which is the word for something on an order. A count named
after the wrong thing is worse than no count: it sends her to the wrong screen to
go and look.

### The sentence

```
They are valued at nothing here; an opening balance in your books may not have
```

It is grammatical. "May not have" elides "valued them at nothing" from the clause
before it, and the file's own header uses the same construction. But this is a
sentence written **for a business owner**, and the first thing she does with it
is check whether the page finished loading. A reader who cannot tell a deliberate
ellipsis from a bug has been given a bug.

## The fix

The words moved into their own module,
**`gl-reconciliation-lines.ts`**: a pure function from the seven measured numbers
to the rows a person reads. The measurement half stays where it was.

That split is the point. Three defects sat in that copy and **not one of them was
reachable from a test**, because reaching them meant standing up a database and
contriving a tenant with exactly one late bill. As a pure function each sentence
and each count has a test that runs in four milliseconds.

```ts
export function count(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}
```

and the sentence now carries its own object:

> 375 units counted onto the shelf with nothing recorded about what they cost.
> They are worth nothing in this figure, because nothing was ever paid for them
> that we can see. If your books carry an opening balance for them, that is the
> difference

**Now**, verified in the browser: `491 units on hand` · `0 order lines` · **`1
order line`** · `0 items` · **`3 items`** · `375 units` · `0 transfer lines`.

## Proven

**`gl-reconciliation-lines.test.ts`** — 24 tests. The plural one is a property
over a table of all seven counts, stated so it fails on the **bug** rather than
on a noun:

```ts
// A hard-coded plural reads IDENTICALLY at one and at two, whatever the
// word happens to be.
expect(noun(at(field, 1, kind), 1), kind).not.toBe(noun(at(field, 2, kind), 2));
```

That matters. My first draft asserted `not.toMatch(/^1 \S*s\b/)` — which passes
on "1 order lines", because the word right after the number is "order". The
assertion was checking a shape I had guessed at instead of the thing that is
wrong. Comparing the singular against the plural cannot be fooled that way, and
a count added later with no plural rule fails the same test.

The zero case is asserted too, because zero takes the plural in English, with one
named exception: the uncosted line drops its count entirely at zero and says the
opposite in words.

Putting the original copy back:

```
× 'sparx_value' reads differently at one than at two
    expected 'units on hand' not to be 'units on hand'
× 'goods_received_not_invoiced' …    expected 'order lines' not to be 'order lines'
× 'invoiced_not_received' …          expected 'order lines' not to be 'order lines'
× 'non_owned_stock' …                expected 'lines' not to be 'lines'
× 'priced_not_purchased' …           expected 'lines' not to be 'lines'
× 'uncosted_units' …                 expected 'units' not to be 'units'
× 'in_transit' …                     expected 'transfer lines' not to be 'transfer lines'
× calls consigned stock items …      expected '3 lines' to be '3 items'
× says what the units are worth here, and why
× never ends on a dangling verb      expected … not to match /\bmay not have$/
```

**10 of 24 red**, one per defect.

|                 |                         |
| --------------- | ----------------------- |
| inventory       | **395 pass** (33 files) |
| typecheck       | exit 0                  |
| lint / prettier | clean                   |
