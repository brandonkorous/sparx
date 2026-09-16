# 528 — The British-spelling sweep, carried out

**Status:** done, 353 applied, 48 held back on purpose
**Severity:** minor each, a standing rule across the whole product
**Surface:** both consoles, both marketing sites, the shared packages
**Filed:** 2026-09-15
**Closes:** [515](515-the-copy-is-written-in-british-english.md)

## What this is

515 measured 436 readable strings written in British English and fixed four.
This is the rest of it, run with a parser rather than a find-and-replace,
because 515 said why that mattered and it turned out to be righter than it knew.

## What was changed

**353 occurrences in 215 files.**

| spelling   | → American | n   |
| ---------- | ---------- | --- |
| cancelled  | canceled   | 141 |
| catalogue  | catalog    | 46  |
| cancelling | canceling  | 32  |
| grey       | gray       | 26  |
| labour     | labor      | 19  |
| recognise  | recognize  | 16  |
| licence    | license    | 14  |
| programme  | program    | 13  |
| per cent   | percent    | 10  |
| ageing     | aging      | 8   |
| the rest   |            | 28  |

Only STRING LITERALS and JSX text, only where the text reads as prose (it
contains a space), never a comment and never an identifier. `status: 'cancelled'`
is a stored value and a grep cannot tell it from the word in a sentence; a
TypeScript parse can.

## What was held back, and why each one is not a copy edit

**48 occurrences, in four groups.**

### 42 that are how something FINDS A ROW IT MADE BEFORE

- `builder-schemas/default-emails*.ts` — the `name` on a default email. The
  blueprint installer looks emails up by name: `emailIdByName.get(st.emailName)`.
- `automation-actions/src/seeds/*.ts` — the `name` on a seeded automation.
  `upsertSystemAutomation` finds by `(origin='system', name)`.
- `recipes-catalog.ts` — the same shape, one level out.
- `marketplace-catalog/**` — ships rows, keyed in the install ledger.

Renaming one of these does not rename a row. It fails to find the row and makes
a **second** one, which for a welcome sequence means the customer is emailed
twice. This is not a guess: migration `20270506000000` exists because the em-dash
sweep reworded `'Welcome — day 3'` in 22 bundles, and `20270508000000` exists
because two copies of one seeded rule already reached a tenant.

There is a right way to do these, and the code already has it:
`previousNames: ['Order cancelled — email']` sits in the commerce seed right now,
read by `upsertSystemAutomation`. So each of these is one line plus an alias,
one at a time, with the ledger checked. That is a piece of work, not a sweep.

### 4 that are a name

"Loose-Leaf Earl Grey Supreme", and Earl Grey is a person before it is a tea.

### 2 that are a VOCABULARY, not copy

This is the one the parser would not have caught on its own, and it is the reason
the script prints before it writes.

```ts
// commerce-schemas/src/onboarding.ts
warehouse: ['fulfillment center', 'fulfilment centre', 'fc'],
```

Both spellings, side by side, **on purpose**: it is the list of column headings
the importer matches a merchant's spreadsheet against. Rewriting the British half
deletes the reason it is there and leaves a duplicate of the American one, and a
British merchant's file silently stops mapping.

The launcher does the same thing for search: the staff entry lists `'labour cost'`
AND `'labor cost'`. The script now holds any literal inside an array named
`keywords` / `aliases` / `synonyms` / `headers` / `terms` / `match` / `patterns` /
`previousNames`, and holds `onboarding.ts` whole.

## Read back, not assumed

The last sweep in this repo deleted JSX from seven lists because a regex was
trusted over its own diff. So this one was checked against a real baseline.

The tree already carried ~3,500 files of unrelated uncommitted work, which makes
`git diff` useless as evidence. **36 of the 215 files were clean before the
sweep**, so on those the entire diff is this change:

```
files clean before the sweep      36
lines added == lines removed      36   (a sweep must never create or destroy a line)
changed line pairs                42
pairs that are NOT purely a spelling swap    0
```

Re-scanning afterwards: **0 remaining** in scope, 48 still held.

Six files needed reformatting — the shorter American words changed where Prettier
wraps — and were formatted.

## Verified

- typecheck: both workbenches, both marketing sites, and eleven packages — all pass
- tests: piggles console 266, sparx console 181 — all pass
- lint and prettier: clean
