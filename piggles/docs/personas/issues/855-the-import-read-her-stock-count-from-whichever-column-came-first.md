# 855 — The import read her stock count from whichever column came first

**Status:** fixed
**Severity:** **major** — the same file, imported twice, gives two different
stock counts, and the one it drops is the real one
**Found by:** P03 · act 299, by a property test written for something else
**Surface:** mypiggles › Import › match your columns
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** running the original matcher against both column orders and
printing what it returned

## Measured, both ways round

A stock list with three columns. Nothing changed but their order.

```
SKU · On hand · Available     →  {SKU: sku, On hand: quantity, Available: available}
SKU · Available · On hand     →  {SKU: sku, Available: quantity}
```

The second one is wrong twice over. Her **available** count is imported as her
**stock** count, and her real stock column is matched to nothing at all and
silently dropped.

Those are different numbers. Available is what is on the shelf minus what is
already promised to somebody. On a shop with open orders it is always the
smaller one, so the import quietly understates her stock and gives her no reason
to look.

## Why the order decided it

`guessMapping` matched each header against three things, in one pass, first come
first served:

```ts
if (normalize(field.key) === wanted) return true;
if (normalize(field.label) === wanted) return true;
return (ALIASES[field.key] ?? []).some((alias) => normalize(alias) === wanted);
```

The stock entity has two count fields:

```ts
{ key: 'quantity',  label: 'On hand'   },
{ key: 'available', label: 'Available' },
```

and `available` is one of the aliases listed for `quantity`:

```ts
quantity: ['qty', 'stock', 'on hand', 'in stock', 'inventory', 'available'],
```

So the header "Available" could be claimed by `quantity` as an **alias** or by
`available` as its **own name**, and which one got it came down to which header
the loop reached first. Whichever field was claimed was then marked taken, and
the other header fell through with nothing left to match.

The alias list is not wrong. On products there is only one count, so a column
headed "Available" meaning quantity is the right guess and has to keep working.
The bug is that a guess about somebody else's spelling was allowed to beat a
field's own name.

## The fix is an order, not a list

Two rounds. Every field first claims a header that is its **own key or its own
label**. Only once that is settled does anything claim a header by alias.

```ts
claimBy('own name');
claimBy('alias');
```

The label is the word printed beside that column on the screen the owner is
looking at, so it has the strongest possible claim to a header saying exactly
that word. Nothing else about the matcher changed, and the alias round still
runs for everything the first round left alone.

## How it was found

It was not spotted by looking. It fell out of a property written while fixing
something else (issue 854, which moved two labels that turn out to be lookup
keys):

> every canonical field maps back to its own field, for every entity

That looks tautological until it is run. It came back with exactly one entry:

```
inventory_levels.available labelled "Available"
```

One line, out of 17 entities and every field on each of them. A property test
worth writing is one that looks too obvious to bother with.
[[feedback_a_test_that_cannot_go_red]]

## Proved

**8 tests** in `column-guess.test.ts`, three of them about this. **Proved red**
by running the alias round first, which reddens exactly 2 of 8 — the
"Available first" case and the property.

The before-and-after numbers at the top of this page are a **measurement**: the
original matcher was re-implemented byte for byte in a throwaway test, run
against the real field list under both column orders, and made to print what it
returned. Not reasoned about from the code.
[[feedback_verify_capability_in_code_not_docs]]

**Checks:** typecheck 0 on both workbenches and `@wizeworks/migration`. The two
consoles' `guessMapping` are byte-identical. `check:console-parity` green.
ESLint and prettier clean.

## Files

- `piggles/apps/workbench/surfaces/migration/column-guess.ts`
- `sparx/apps/workbench/surfaces/migration/column-mapper.tsx`
- `piggles/apps/workbench/surfaces/migration/column-guess.test.ts` (new)

## The thing to remember

**A "best guess" screen is still a write path.** This one is presented as a
draft the tenant corrects, which is exactly why it was never guarded: getting it
a bit wrong sometimes is the accepted cost. But an owner who sees SKU, On hand
and Available all recognised does not re-read three rows she already checked, and
the one column that was silently dropped is invisible on a screen showing what it
DID match.

And the shape underneath: **first come, first served is a rule only when the
order means something.** Here the order was the order of columns in somebody
else's spreadsheet, which carries no information about anything. Any matcher that
consumes an unordered list one item at a time and marks things taken has this bug
available to it.
