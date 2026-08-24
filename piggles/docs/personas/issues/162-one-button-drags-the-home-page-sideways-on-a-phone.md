# 162 — One button drags the home page sideways on a phone

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · before act 1, reading meetpiggles at 360px
**Surface:** meetpiggles — home, the trade wall
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** not on screen — no browser attached this session (see below)
**Blocked on:** decision, for the platform-wide version only — whether `.btn` may wrap below `sm`

## What happened

With [160] and [161] fixed, the home page still moves sideways under the thumb.
Not far — seven pixels — but the whole page rubber-bands on a vertical swipe,
which is the tell that something on it does not fit.

## What should have happened

Nothing moves horizontally. Every other page on the site now measures 341 of 341
at 360px; home measures 352 of 345.

## How to reproduce

Every time.

1. Open `localhost:3020/` at 360px.
2. Swipe up. The page slides left and springs back.
3. Or read it: `document.documentElement.scrollWidth` is 352, `clientWidth` 345.

## Why it matters

Cosmetic, and worth saying so plainly rather than inflating it. It costs nobody
a job. It is recorded because it is on the first page anybody sees and because a
page that rocks sideways is the specific thing that reads as unfinished.

## Where it lives

[piggles/apps/web/components/marketing/home.tsx](../../../apps/web/components/marketing/home.tsx),
`Whatever()` — the trade wall and its sticky column.

The chain, measured rather than guessed:

| Element                     | Left | Right |
| --------------------------- | ---- | ----- |
| `<section class="px-4">`    | 0    | 345   |
| `.rounded-section` (`px-6`) | 16   | 329   |
| the two-column grid         | 40   | 305   |
| `.trade-wall` (`-mx-6`)     | 16   | 352   |

The wall bleeds its section's padding on purpose, so a card is visibly cut at the
edge rather than stopping short of it. That is correct and it is not the problem.
The problem is that the grid's single column is **288px wide, not 265**, so the
bleed starts from the wrong place.

What sets 288 is one control in the other column:

> **What is different about yours**

`.btn` computes `white-space: nowrap`, so that label cannot wrap, and its
min-content width becomes the floor under the whole column. `min-height` is 0 and
the height is padding plus line height, so a wrapped label would simply make the
button two lines tall.

## The fix

**Both pieces made.** This was filed `Blocked on: scope`, which was the wrong
call: the second piece is work, not a decision, and writing a paragraph about
why a file is too big to touch costs more than splitting it.

1. **`max-sm:whitespace-normal`** on the CTA in `Whatever()`. The comment beside
   it now records the whole chain, so the next person to shorten that class list
   knows what it is holding up.

2. **`home.tsx` 714 → eight files** under `components/marketing/home/`:

   | File                | Lines | What it is                                    |
   | ------------------- | ----- | --------------------------------------------- |
   | `index.tsx`         | 109   | the page contract, and `HomePage`             |
   | `thursday.tsx`      | 108   | 1b · recognition                              |
   | `trade-wall.tsx`    | 195   | `TRADES`, `scene()`, `TradeCard`, `TradeLane` |
   | `whatever.tsx`      | 69    | 2 · whatever kind of business                 |
   | `the-turn.tsx`      | 121   | 3 · the turn, and `ONCE`                      |
   | `two-questions.tsx` | 20    | 5 · you answer two questions                  |
   | `pricing.tsx`       | 100   | 6 · the one price                             |
   | `questions.tsx`     | 46    | 8 · the six questions                         |

   `app/page.tsx` imports `@/components/marketing/home` and did not change —
   the directory's `index.tsx` answers to the same path.

**Where the documentation went, which was the actual question.** The split of
the ~105-line header was decided by what each part is ABOUT rather than by
length. The page contract — the nine-section shape, the three-to-five-second
rule with its word counts, the three legal homes for depth, why every component
is a server component, and what was deleted and is not coming back — is about
the PAGE, so it stays with the page in `index.tsx`. Each section's own argument
travels with its section: why the pain clause is not pink is in `thursday.tsx`,
why the wall has no panel and how eleven scenes are sized is in `trade-wall.tsx`,
why the turn is a theme island is in `the-turn.tsx`. Nothing was moved to a doc
and nothing was dropped — every line of the old file was diffed against the new
directory, and the only differences are two JSX comments converted to JSDoc
(same words), three prose lines prettier re-wrapped, and the one class above.

RULE #0.5's second clause was applied too: four sections were over 50 lines and
are now `Words`, `TheArgument`, `OnceList` and `PriceCard` beside their sections.

## What is still open

**The platform-wide version, and it is a real decision.** A button that refuses
to wrap will do this again wherever a long label meets a narrow column, so the
durable answer is `white-space: normal` for `.btn` below `sm` — but `.btn` is
silicaui's, shared with sparx, and "every button in the platform may now be two
lines tall on a phone" is a design change rather than a bug fix. Named here
rather than made.

## Confirmed by

**Nothing yet, and that is the honest state.** No browser was attached when this
was fixed, so the measurement that produced the finding —
`document.documentElement.scrollWidth` 352 against `clientWidth` 345 at 360px —
has not been re-taken. The arithmetic says the column drops from 288 to 265 and
the overflow goes with it, and the page typechecks, lints and formats clean.

**Re-take the measurement before scoring this.** It is one line in the console
on `localhost:3020/` at 360px, and it either reads 345 of 345 or this is not
fixed.

## Rating effect

`meetpiggles › home` — not re-scored until the measurement above is re-taken.
