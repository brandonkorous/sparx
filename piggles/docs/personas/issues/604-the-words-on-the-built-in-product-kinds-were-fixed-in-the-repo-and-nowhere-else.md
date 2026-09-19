# 604 — The words on the built-in product kinds were refreshed in the repo and nowhere else

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 205
**Surface:** mypiggles › Sell › Kinds of product
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 205 (seen on screen, 0 of 7)

## What happened

Reading the same screen as [603](603-the-list-of-product-kinds-ran-off-the-side-of-my-phone.md),
every built-in kind described itself with an em-dash:

> Clothing and worn goods — fabric, fit, care, and material composition.

Piggles does not write em-dashes. So I went to fix the sentence, and found it
already fixed:

```ts
// commerce-schemas/src/product-types/builtins/apparel.ts
description: 'Clothing and worn goods: fabric, fit, care, and material composition.',
```

The repo had been right for some time. Every database was still wrong.

## Why it matters

Not for the punctuation. For the mechanism.

`BUILT_IN_PRODUCT_TYPES` is the starter vocabulary every business on the
platform is given, written as an array and described in its own file as the
source of truth. It reached a database exactly once, through migration
`20270206000000` — whose own comment says the array and the rows are
"byte-for-byte" and asks the next person to **"keep the two in lockstep when
either changes."**

Nobody could. A migration runs once. After it has been applied, editing the
array changes nothing on that database, and since no runtime code imports the
array either, **editing it changes nothing anywhere at all.** There is no error,
no failing test, no warning. The repo and the product simply disagree, quietly,
forever.

It had already happened once before and was not recognised as a class:

- **the icons.** The array holds a symbol (`👕`); the migration wrote the _name_
  of one (`'shirt'`), which rendered as a stray word beside the type
  ([167](167-every-kind-of-product-has-a-stray-word-in-front-of-its-name.md)). Patched with a
  **second migration**, `20270406000000`, to catch the databases up.
- **the words.** This one. Eight strings.

Patching the first with another migration is what made the second inevitable.

## What was actually adrift

Every field of all seven types was compared against the rows:

```
7 built-ins, 7 rows, 8 differences
```

All eight the same edit, none of it shipped:

| where                        | repo                             | every database                    |
| ---------------------------- | -------------------------------- | --------------------------------- |
| 7 × `description`            | `… worn goods: fabric, …`        | `… worn goods — fabric, …`        |
| `apparel.fields[0].helpText` | `… product-specific. Write it …` | `… product-specific — write it …` |

The eighth is the one that bothers me most. That help text sits under **Fabric &
construction** on the apparel type, which is _my_ type. It is the sentence a
coat maker reads while filling the box in.

Names, plural names, icons and every attribute key matched. Only the copy edit
was stranded, which is exactly what you would expect: copy is the thing people
go back and improve.

## Where it lives

`wizeworks/packages/db/prisma/platform-seed.ts` — the release pipeline's **data**
stage, which runs on every push to main and is written for precisely this
failure. Its own header records the first time it happened: `marketplace_themes`
held zero rows in production while twenty theme bundles sat committed, and
/market/themes served its empty state to every visitor for a month.

Built-in product types were never added to it.

**Fixed:** `seedBuiltInProductTypes` upserts the array under the platform tenant
on every deploy. The array is now the source of truth in fact and not only in a
comment, so the next copy edit ships with the code that makes it and no third
patch migration is needed.

Proven end to end against a real database:

```
[seed] built-in product types: 7 applied, 7 refreshed (apparel, cosmetics, …)
[seed] built-in product types: 7 applied, all already in step     ← run twice
7 built-ins, 7 rows, 0 differences
```

and then read back off the screen: seven descriptions, **zero** em-dashes.

Two details worth keeping:

- **It touches only the platform tenant.** A business that edits a built-in gets
  its own row under its own tenant id, so nobody's edits are overwritten.
- **It prints the denominator.** "7 applied, 3 refreshed" and "7 applied, all
  already in step" are different facts, and a deploy log that only says "done"
  cannot tell you which one happened.

## Guard

**`scripts/check-platform-seed.mjs`**, wired as `pnpm check:platform-seed` and
into the pre-push guard.

It holds a table of platform content authored as code and asserts that the
deploy's data stage applies each one. An entry that is deliberately applied
somewhere else must say where, and why, in the table — the marketplace catalogs
are published by api-rest at boot, and that is now written down as an exception
rather than carried as folklore.

Proven red twice.

By putting the bug back — the array present, nothing applying it, which is the
exact state the platform was in this morning:

```
✗ check:platform-seed — 1 platform data set(s) no deploy stage applies:
  BUILT_IN_PRODUCT_TYPES  (the starter product-type vocabulary every tenant sees)
```

and **blind**, by pointing one declared source at a directory that does not
exist:

```
✗ check:platform-seed — path is missing: …/product-types/builtins-MOVED
  A check that scans nothing prints green. Fix the path, do not delete the entry.
```

That second one caught a real mistake while the check was being written: the
table's fourth entry named `MARKETPLACE_THEMES`, an array I had invented from
memory. The real one is `FIRST_PARTY_THEMES`. A check that only looked for
_absence_ would have passed over it.

## Still open

The two migrations cannot be corrected and should not be. Their SQL is the key
in `_prisma_migrations` on every deployed database, and editing an applied
migration changes its checksum and stops the next release. The seed step
supersedes them; the comment in `builtins/index.ts` now says so, and points the
next reader at the seeder rather than at a lockstep promise nothing could keep.

Nothing else. The other direction was the obvious gap and it is closed rather
than recorded: `check-platform-seed` proves platform content HAS a deploy stage,
which says nothing about whether the stage writes what the array says. A field
left out of the seeder's own `data` object would leave the old value in the row
and every check would still be green.

So the step now READS BACK every row it writes and compares it to the array,
field by field, down to each attribute — and throws, which fails the Job, which
fails the deploy. Comparing by flattened path rather than by `JSON.stringify`,
because jsonb does not preserve object key order and a stringify comparison
reports every row as changed.

Proven red by installing exactly that bug: `pluralName` removed from the write
while the array changed underneath it.

```
Error: built-in product type "apparel" did not land as written: pluralName
```

The transaction rolls back, so a half-applied vocabulary is not a state the
platform can reach.
