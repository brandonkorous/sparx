# 806 — An arrow, a dot, and two meanings for one mark

**Status:** fixed
**Severity:** copy
**Found by:** P03 · Juniper Row · act 280 (follow-up)
**Surface:** mypiggles + sparx workbench — the **Ready-made lists** picker on `commerce.fitment.list`
**Filed:** 2026-09-24
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen, full width and at 328px
**Blocked on:** —

## What happened

Act 280 renamed the button that opens this picker from "Starter library" to
"Ready-made lists" (issue 802). I did not open the picker itself. Inside it,
under every list, sat a badge:

> Make → Model → Engine · Year

Twelve of the badges carried notation. Others:

> Brand → Model
> Species → Breed · Weight
> Class → Model

This is the first fitment screen a business owner ever sees, and it is where she
picks which ready-made list to take.

## Why it matters

The arrow is the ordinary complaint: it is a developer's way of writing a
drill-down, on a screen built for somebody who has never seen one.

The middle dot is the worse one, and it is not taste. Everywhere else in the
preset chips a dot joins PEERS:

```
Cash · Check · Wire · ACH          payments
CA · TX · NY                       tax
Clothing · Footwear · Accessories  categories
50% margin · .99                   markup
```

Here alone it divided the steps from the things that narrow them. `Species ·
Breed` would mean two peers; `Species → Breed · Weight` meant two steps and one
narrowing. One mark, two meanings, both on screen in the same console.

It is copy. Nothing computes wrong. Said plainly rather than inflated.

## The first fix was wrong, and the screen is what said so

I spelled the notation out in words: `Make, then Model, then Engine, plus Year`.
Tests green, typecheck green, eight new cases, six of them red on the old line.

Then I docked the dialog to 328px and looked. The badge read:

> Make, then Model, then Engine, plu

Cut mid-word, and the card overflowed by 53px. Measured, at a 328px dialog:

|                       | width                      |
| --------------------- | -------------------------- |
| old arrow string      | 203px                      |
| my words string       | 260px                      |
| the column it sits in | 112px                      |
| the card              | 255px client, 308px scroll |

So the clip was **older than my change** and my change made it worse. Spelling
out notation is not free when the thing it sits in has a fixed size.

A second wrong turn worth recording: I tried `h-auto whitespace-normal` on the
badge to make it wrap. It wrapped, and the pill collapsed to **9px tall** with
the text hanging out of it, because `.badge` has no vertical padding at all: it
gets its height from a fixed `height`, and taking that away leaves nothing.

## What the component actually says

silicaui, `get_component('badge')`:

> The Badge component — a **small pill** for labels, counts, and statuses.

Fixed height, no vertical padding, `white-space: nowrap`. There is no wrapping
prop and no multi-line variant, because a badge is not for a sentence. The
component was right. **The content was wrong**, in both spellings.

## The fix

The chip carries a token, which is what a pill is for:

```ts
export function stepWords(levelCount: number): string {
  return levelCount === 1 ? '1 step' : `${String(levelCount)} steps`;
}
```

| list          | was                            | reads                       |
| ------------- | ------------------------------ | --------------------------- |
| vehicle       | `Make → Model → Engine · Year` | `3 steps` · `4 makes`       |
| apparel-sizes | `Size`                         | `1 step` · `8 sizes`        |
| footwear      | `Department → Width · Size`    | `2 steps` · `3 departments` |
| device        | `Brand → Model`                | `2 steps` · `3 brands`      |

**The level names are not lost. They were never the chip's to carry.** All
fourteen descriptions already say the shape, one line above the badge, in the
owner's own words:

> A shopper picks their make, model and engine, and you can narrow it further by
> year.

And in **five of the fourteen** the chip said it in a DIFFERENT word than the
sentence above it: `Brand` against "the make of their phone", `Species` against
"the animal", `Class` against "the kind of machine", `Department` against "who
they are buying for", `Discipline` against "the kind of riding they do". Same
defect shape as issues 798 and 804. The step count is the one thing about the
shape the sentence makes you work out for yourself.

**Also fixed, same row.** The card was `flex items-start` with the words on
`min-w-0 flex-1` beside a fixed Install button, which is exactly issue 803: the
flexible child absorbs the whole squeeze. At 328px the description column was
112px, six words to a line. It is `flex-wrap` with a `min-w-48` floor and
`ms-auto` on the button now, so Install drops underneath instead of crushing it.

**And the chip was `color="neutral"` in both consoles.** A chip carrying no
meaning is a COLORLESS badge, which needs no approval; naming `neutral` does
(root RULE #4). Both render colorless.

**Checked the neighbours and deliberately left them.** The dot as a peer
separator is a house pattern across payments, tax, categories, markup and
surcharge chips, where it reads as "and" and means one thing consistently. Those
labels are longer than a pill wants too (`Clothing · Footwear · Accessories` is
33 characters), but they render in their own surfaces, not this one. Wider
question, not this defect.

Files:

- `wizeworks/packages/commerce/src/presets/fitment.ts`
- `wizeworks/packages/commerce/src/presets/fitment-chip-words.test.ts` (new)
- `wizeworks/packages/modules/src/presets.ts` — the type's doc comment carried
  the arrow as its worked example, which is how the shape spread
- `piggles/apps/workbench/surfaces/commerce/fitment-dictionary-picker.tsx`
- `sparx/apps/workbench/surfaces/commerce/fitment-dictionary-picker.tsx`

## Proved red

8 tests. Restoring the long label turns **6 of 8** red, including the guard that
would have caught the clip in the first place:

```
× counts one step without a plural
× counts several
× says none rather than an empty string
× keeps every chip short enough for a pill that cannot wrap
      AssertionError: expected [ …(12) ] to deeply equal []
× says the vehicle list in tokens
× says a one-level list is one step
```

That length guard is the lesson, not the wording: a pill cannot wrap, so the
only safe chip is a short one. Twenty characters, against a 192px column floor.

## Confirmed by

Opened as Devi on Juniper Row, 2026-09-25, at full width and docked to 328px.
Reads `3 steps` · `4 makes`, `1 step` · `8 sizes`, `2 steps` · `3 departments`.
Measured at 328px across the first six rows:

```
anyOverflow: false   anyClipped: false
every row   clientW 255 = scrollW 255
every pill  24px tall (not the 9px the h-auto attempt gave)
widest chip 106px ("3 departments")
```

## Noted, not fixed

The level labels themselves (`Brand`, `Species`, `Class`, `Department`,
`Discipline`) are stored on the row at install time and are shown on the level
editor too, so aligning them with the sentence is a data question rather than a
copy one.

## Rating effect

None. `commerce.fitment.list` stays 8/8 from act 280; the picker behind it now
reads the way the list does.
