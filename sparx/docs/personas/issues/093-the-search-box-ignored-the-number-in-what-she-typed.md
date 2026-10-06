# 093 — The search box ignored the number in what she typed

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 5 (finding a renamed task)
**Surface:** workbench › Search everything (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty typed "Units 31" to find her task "Quote Dana the Cheetah turbos at contract price, Units 31 and 34". The box listed the Units and Pick & pack throughput screens, then Deals and New deal, and only below them, under Tasks, the one thing that matched both words.

## What should have happened

A number is never filler. "Units 31" asks for something with 31 in it; the screens match only "Units".

## How to reproduce

As Doty, Search everything, type "Units 31". Before the fix: four screens above the task. Every time.

## Why it matters

Unit numbers, order numbers and part numbers are how a parts business names things. The highlight starts on the first row and Enter opens it, so Enter opened the Units screen.

## Where it lives

`meaningfulWords` in `components/launcher-match.ts` (both consoles) drops words of two letters or less so "a" and "of" do not block a match. "31" is two characters, so it was dropped too, and the screens were matched on "Units" alone.

## The fix

A short word is kept when it holds a digit. Both consoles.

Test: `components/launcher-match.test.ts` "a number in what was typed", both consoles. The old line reddens 1 of 2 in each (the other checks "a" is still dropped).

## Confirmed by

On screen, 2026-10-06, as Doty: "Units 31" lists only the task, beside "Done", "1 record matched."

## Rating effect

—
