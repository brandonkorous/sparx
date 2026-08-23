# 162 — One button drags the home page sideways on a phone

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · before act 1, reading meetpiggles at 360px
**Surface:** meetpiggles — home, the trade wall
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope — the one-class fix drags a 714-line file's split with it

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

One class on that anchor — `max-sm:whitespace-normal` — and the column drops back
to 265px. Sixty seconds of work.

RULE #0.5.4 is what stops it here: touching `home.tsx` obliges applying the rule
set to it, and the file is **714 lines** against a 250 limit, opening with ~105
lines of comment that are the page's whole design argument (the section contract,
the word budget per beat, why the pain clause is not pink, what was deleted and
why it is not coming back). Splitting it means deciding where that documentation
lives — a doc, or six section files each carrying its own share — and that is a
decision about Brandon's page rather than a defect fix.

So it is two pieces of work, and only the first is small:

1. `max-sm:whitespace-normal` on the CTA in `Whatever()`.
2. Split `home.tsx` into `components/marketing/home/*` — `Thursday`, `Whatever`
   (with `TRADES`, `TradeCard`, `TradeLane`, `scene`), `TheTurn`, `TwoQuestions`,
   `Pricing`, `Questions` — and rehome the header comment.

**The wider version, checked and left alone:** a button that refuses to wrap will
do this again wherever a long label meets a narrow column, so the durable answer
is `white-space: normal` for `.btn` below `sm`, once, in Piggles' own
`globals.css`. That file is 355+ lines and carries the same obligation, so it is
named here rather than changed on the way past.
