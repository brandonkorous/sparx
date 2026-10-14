# 197 — Her email address broke in the middle of a word

**Status:** open
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · standing checks (the other side)
**Surface:** the Gillett site › Your account › the sidebar
**Filed:** 2026-10-09
**Fixed:** —
**Confirmed by:** —
**Blocked on:** screen proof

## What happened

Brynn's account sidebar printed her address as "brynn.ohara@kanabmail.te" over "w".

## Why

`break-all` (from issue 379, which stopped a long address spilling out of the column)
breaks at any letter, even when the address could wrap at its "@".

## The fix

`apps/site/app/account/(authed)/layout.tsx`: `overflow-wrap:anywhere` in place of
`break-all`, and a line break offered just after the "@" (`EmailWrap`). The address
wraps at the "@" first; a part longer than the column still breaks, so 379 stays fixed.
Lint clean.

## Confirmed by

Not yet on screen.
