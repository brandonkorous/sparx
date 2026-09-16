# 471 — Six rows pointed "below" at something that was above them

**Status:** fixed
**Severity:** minor
**Found by:** reading the Accounting screen end to end
**Surface:** `finance.accounting` (both consoles) · `@wizeworks/finance` accounting catalog
**Filed:** 2026-09-09

## What was wrong

"Sending it automatically" is the last card on the Accounting screen. Its own
heading gets the direction right:

> Direct sync means Piggles posts each cost for you instead of you moving a file.
> Where it is not switched on yet, **the export above** already works with that
> package today.

The six rows inside it all say the opposite:

| row                 | said                                                    |
| ------------------- | ------------------------------------------------------- |
| QuickBooks Online   | "You can still export a spreadsheet **below**…"         |
| Xero                | "You can still export a spreadsheet **below**…"         |
| QuickBooks Desktop  | "The spreadsheet export **below** works with it today." |
| Sage 50 (Peachtree) | "The spreadsheet export **below** works with it today." |
| FreshBooks          | "You can still export a file **below**…"                |
| Wave                | "You can still export a file **below**…"                |

There is nothing below. The export card is the second thing on the screen and
this list is the last, so somebody who follows the instruction scrolls to the
bottom and finds the end of the page.

## Why it happened, and why "above" is not the fix

These sentences are written in `@wizeworks/finance`, and the console decides
where the export card goes. A package cannot know which way to point, so "below"
was a guess that happened to be wrong — and swapping it for "above" would just be
a luckier guess, wrong again the day either console reorders its cards.

The direction word is gone instead. "The spreadsheet export **on this screen**"
is true wherever it is placed, and each of the three sites carries a comment
saying why there is no direction word, so nobody puts one back.

## The fix

```
Direct QuickBooks sync is not switched on for this installation.
The spreadsheet export on this screen already imports into QuickBooks today.
```

Three files: the shared `accountingCatalog()` builder and the QuickBooks and Xero
adapters, which each write their own.

## Proven

On the live screen, counted in the DOM: **0 occurrences of "below", 6 of "on this
screen".**
