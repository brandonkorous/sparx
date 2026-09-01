# 357 — Half the times in her version list were broken across two lines

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · reading the History pane for her About page
**Surface:** mypiggles › My Site › History, and My Site › Publish
**Filed:** 2026-08-31
**Fixed:** 2026-08-31
**Confirmed by:** her own eight versions, all on one line, measured on the screen

## What happened

Her About page's history listed four saves and four releases. Three of the eight
times were broken across two lines:

```
2:59 AM   You saved          2:59 AM   Published
2:53 AM   You saved          2:54      Published
2:44      You saved          AM
AM                           2:49      Published
9:14 AM   You saved          AM
                             9:14 AM   Published
```

Rows of two different heights, a ragged column of badges, and no reason a person
could name for which times broke and which did not. It is the same time of day in
the same font on the same screen.

## What should have happened

Eight rows the same height, and eight badges in a straight line.

## How to reproduce

Every time, on any document with saves at the wrong minutes.

1. Sign in as Devi, open **My Site › Pages › About**, press the clock.
2. Read the "Your saves" list. Times containing a 4 wrap; times containing 9 and 3
   do not.
3. Same in **My Site › Publish**, whose releases list is built the same way.

## Why it matters

Cosmetic, and worth saying so plainly. But it is the loud kind of cosmetic: a
list where identical rows are different heights reads as something rendering
badly rather than as a design, and this is a screen somebody opens when they are
already nervous — they are looking for the version from before they broke
something.

The half that is not cosmetic is that it gets worse with the clock. Every save
between 10am and 1pm wrapped **unconditionally**, and mornings are when people
work.

## Where it lives

- [history-rows.tsx](../../../apps/workbench/surfaces/studio/history-rows.tsx) `Row`
- [publish-releases.tsx](../../../apps/workbench/surfaces/studio/publish-releases.tsx) `ReleaseRow`
- [when.ts](../../../apps/workbench/surfaces/studio/when.ts) — new; where the cell lives now

## The fix

The time sat in a fixed `w-14` — 56px — to line the badges up in a column. A
clock time is not one width, so 56px was a coin toss. Measured on the running
page at this font size:

| Time       | Proportional | Tabular |
| ---------- | -----------: | ------: |
| `2:59 AM`  |       55.8px |  57.1px |
| `2:44 AM`  |   **56.9px** |  57.1px |
| `9:14 AM`  |       55.6px |  57.1px |
| `11:20 AM` |            — |  66.1px |
| `14:44`    |            — |  40.1px |

4 is a wider glyph than 9, so "2:44 AM" crossed 56px and "2:59 AM" did not. That
one pixel decided whether a row was 20px tall or 40px tall.

Three changes, in one shared `when.ts` that both lists now import (they were also
declaring the same two `Intl.DateTimeFormat`s separately):

- **`tabular-nums`** — every digit the same width, so all one-digit-hour times
  become exactly 57.1px and the badges line up for real rather than by luck. It
  is already the house convention: 227 files in this console use it.
- **`min-w-18`** — 72px, which holds the widest time on a 12-hour clock with room
  to spare. `w-14` was too small even for the tabular figures.
- **`whitespace-nowrap`** — a time is one word.

`min-w-` rather than `w-` deliberately: a locale with a longer pattern grows the
cell instead of wrapping inside it, and a 24-hour locale (40.1px) still pads to
the same column.

## Confirmed by

> Re-ran P03 on her About page's history. All eight cells measured **72px wide and
> 20px tall** — one line each, badges in a straight column. Before the fix three of
> the eight measured 40px tall.

## Rating effect

Folded into `builder.history` and `builder.publish` in [rating.md](../rating.md).
