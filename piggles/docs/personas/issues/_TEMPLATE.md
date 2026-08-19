# NNN — What the owner could not do, in her words

**Status:** open
**Severity:** blocker · major · minor · design · copy
**Found by:** P0N · Business name · act N
**Surface:** mypiggles › App › Screen
**Filed:** YYYY-MM-DD
**Fixed:** —
**Confirmed by:** —
**Blocked on:** — (pipeline · decision · scope, only if the fix could not be made now)

Title it the way the owner would say it — "Devi had to type fifteen prices one at
a time", not "bulk price mutation absent on variant grid". The mechanism goes in
**Where it lives**.

## What happened

What you saw, in the order you saw it. Quote the exact words on screen — the
sentence is often the defect.

## What should have happened

What this business owner had every reason to expect. If the expectation comes
from a rule or a doc, name it.

## How to reproduce

1. Numbered, from a signed-in console (or from meetpiggles if it starts earlier).
2. Include the data — the actual product name, the actual price.
3. Say how reliably it happens: every time, or once in five.

## Why it matters

Who is hurt and how. "Wrong money", "the customer sees it", "she could not finish
the job", "it says something false". If it is cosmetic, say that plainly rather
than inflating it.

## Where it lives

Files and lines. Leave blank rather than guessing — a wrong pointer costs more
than no pointer.

## The fix

What changed and in which files. Fix it where it propagates: a prop, then a
token, then a variant, then — with a reason — a call site (root RULE #1). If the
same defect could exist on a sibling screen, say whether you checked.

## Confirmed by

**Required before `Status: fixed`.** The step re-run as the persona, on the
screen, with the same data, and what you saw:

> Re-ran P03 act 3. Set one price across all 15 Ash Overshirt variants in a
> single pass, saved, reopened the product — all 15 read $128.00.

A typecheck, a unit test or a `fetch` is not a confirmation.

## Rating effect

If this moved a pane's score, record it here and in
[rating.md](../rating.md): `Sell › Products — Ease 4 → 8`.
