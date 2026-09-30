# 720 — Fulfillment Cente

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 252
**Surface:** mypiggles + sparx workbench — the recipe pane, and 38 pickers across Stock and Bookings
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the recipe pane's location picker reads "Fulfillment Center" in full
**Blocked on:** —

## What happened

Opened **The Ash Overshirt recipe** to see what it is made of. Below the
ingredients is a card called **What the shelves allow**, with a picker choosing
which place to count against. It said:

> Fulfillment Cente

The "r" was cut off. Her warehouse is called **Fulfillment Center**, and the
line one card above it says so in full: "from what is free at Fulfillment
Center."

The picker was 160px wide. The row it sits in was 863px wide. There were 700
pixels going spare to the right of it.

## Why it matters

A warehouse name is not our copy. She typed it. `max-w-40` is a guess that no
place she ever names will be longer than 160 pixels, and when the guess is
wrong the name is not shortened, it is **cut** - so what she reads is a word
that is not the name of anything.

She only has two places today. The picker needed **164px**. The cap missed by
four.

## The part that makes it a guard and not a one-line fix

`PaneToolbar` puts this on its slots:

```
[&>.select]:w-auto [&>.select]:max-w-full
```

That selector is `.parent > .select`, which **outranks** a `max-w-40` written
on the control itself. So inside a toolbar the cap does nothing, has never done
anything, and looks from the source like it works.

MEASURED 2026-09-19, live console: the counts toolbar's location picker carries
`max-w-40` and computes to `max-width: 100%`, rendering at **164px** — four
pixels wider than the class it wears says it can be.

So somebody had already hit this and could not have known. The diary picker's
own note read:

> Wide enough for its own default option: at `max-w-40` the picker read
> "Everyone & equip" at every width, including inside a popover with room to
> spare. **Still capped**, because a business may name a chair a whole sentence.

They widened it one step to `max-w-56` and changed nothing at all: measured on
screen it is **197px**, its own content width, at a cap of 224. What had
actually been clipping it was the overflow popover, released separately by
issue 717. The note describes a ceiling that is not there.

The recipe card is the same JSX with no toolbar slot around it, so there the cap
bites for real. **A cap on one of these is a lie in a bar and a defect in a
card**, and which one you get depends on where the control happens to be drawn.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**MEASURED 2026-09-19:** 158 pickers in the two consoles list names the business
typed. **41 carried a width we chose.** 2 clip today; the other 39 are inert.

## What was done

**One rule, with a name and a place.** `FITS_ITS_NAME` in
`components/pane-toolbar.tsx`:

```ts
export const FITS_ITS_NAME = 'w-auto max-w-full';
```

As wide as its widest option, never wider than the room it is in. The bar
already applied the same pair to its own slots; a picker drawn anywhere else in
a pane now has something to ask for.

- **The recipe pane**, both consoles, now uses it. "Fulfillment Center" reads in
  full.
- **38 inert caps removed.** No pixel moves; the class stops claiming a ceiling
  there is none of.
- **The diary picker's note rewritten** to say what is actually true, with the
  measurement in it.

`Time zone` on a person's record keeps its `max-w-sm`. IANA zones are our list
in an ordinary form field, not a name anybody typed. Exempted by file and
accessible name so it cannot spread.

**`scripts/check-select-name-width.mjs`** — new, wired into
`pnpm check:select-name-width` and pre-push. It flags a picker whose options
come from anything that is not a fixed list of our own words, and that carries a
`max-w-*`. It prints the denominator.

The `<Select>` family was checked too: **0** of them cap a name.

## Files

- `piggles|sparx/apps/workbench/components/pane-toolbar.tsx` — `FITS_ITS_NAME`
- `piggles|sparx/apps/workbench/surfaces/inventory/bom-detail.tsx` — the fix
- 36 more surfaces across Stock and Bookings — the inert caps
- `scripts/check-select-name-width.mjs` — new, wired into pre-push

## Proof

Put `max-w-40` back on the counts picker: the check exits 1 naming the file, the
line, the picker and the cap. Removed:
`158 pickers list names the business typed, and not one of them is capped at a
width we chose.`

On screen, the recipe pane's picker: `class="select select-sm w-auto max-w-full"`,
164px, `Fulfillment Center`, nothing clipped. 999 piggles tests and 873 sparx
tests pass; both typechecks and ESLint clean.
