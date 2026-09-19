# 659 — Typing "shelf" did not find Shelves

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 232
**Surface:** both consoles — the launcher, and every app's navigation panel
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 232

## What she saw

Devi typed **shelf** into the box that says _"What do you want to do?"_.

| what came back |
| :------------- |
| Shelf labels   |
| Expiring stock |

Not **Shelves** — the screen actually called shelves, one row away in the same
app, which she had opened an hour earlier.

The same word in the Stock app's own panel search returned the same two, and
"Nothing here matches that." for several other ordinary words.

## Why

Both boxes compare literal text. The launcher walks a careful ladder — exact
name, name starting with it, name containing it as a word, then the words we
tagged it with — and the panel does a plain substring. Neither knows that one
spelling of a word is the other, so:

```
"shelves".startsWith("shelf")   false
"shelves".includes("shelf")     false
```

"Shelf labels" matched because its title contains the letters. "Expiring stock"
matched on a keyword. The screen named for the thing did not, and a person is
told the screen does not exist — which is indistinguishable from the feature not
being there.

## How much of it there was

Measured over every screen name in both consoles, asking the real matchers:

| plural words in screen names | that the singular could not find |
| ---------------------------: | -------------------------------: |
|                      **287** |                           **15** |

Most plurals are fine by accident, because "orders" contains "order". The ones
that are not are the two English endings that change the stem:

```
category  → Categories, Spending categories
shelf     → Shelves
company   → Companies
reply     → Quick replies
```

## What it does now

`components/word-forms.ts` returns the word plus its other grammatical number,
both directions, and both boxes ask for every spelling: the launcher takes the
best rung any of them earns, the panel matches if any of them do. A plural and
its singular are the same word, so neither is demoted for being the one that was
not typed, and typing "shelf" now puts **Shelves** first.

After it: **2** of the 287 still miss, and both are the probe's own crude
stemmer chopping a hyphen ("Sign-offs" → "signoff"). Typing either "sign-off" or
"sign off" finds it.

## Why the extra spellings are safe

Every form is an ADDITIONAL string to look for, so most wrong guesses are not
words at all ("analysis" → "analysi") and match nothing. A guess can only do harm
by being a real word inside something unrelated, and the short ones are where
that bites — "bus" → "bu" would reach "budget" — so nothing under three letters
is ever produced and the singular rules refuse endings that are not plurals
("status", "press" and "address" keep their last letter).

Records are left out on purpose. A customer is not a word with a number, and
pluralising somebody's name would match strangers.

## Proved red

Eight tests, then `wordForms` was cut down to return only what was typed: four of
them fail, naming Shelves, Categories, Companies and Quick replies.
[[feedback_a_test_that_cannot_go_red]]

## Files

- `piggles|sparx/apps/workbench/components/word-forms.ts` (new)
- `piggles|sparx/apps/workbench/components/word-forms.test.ts` (new)
- `piggles|sparx/apps/workbench/components/launcher-match.ts`
- `piggles/apps/workbench/components/app-panel.tsx`
- `sparx/apps/workbench/components/module-panel.tsx`
