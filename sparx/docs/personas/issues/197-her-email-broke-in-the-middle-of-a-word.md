# 197 — Her email address broke in the middle of a word

**Status:** fixed
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · standing checks (the other side)
**Surface:** the Gillett site › Your account › the sidebar
**Filed:** 2026-10-09
**Fixed:** 2026-10-13
**Confirmed by:** the Gillett site as Brynn, 2026-10-16
**Blocked on:** —

## What happened

Brynn's account sidebar printed her address as "brynn.ohara@kanabmail.te" over "w".

## Why

`break-all` (from issue 379, which stopped a long address spilling out of the column)
breaks at any letter, even when the address could wrap at its "@".

## The fix

`wizeworks/apps/site/app/account/(authed)/layout.tsx`: `overflow-wrap:anywhere` in place of
`break-all`, and a line break offered just after the "@" (`EmailWrap`). The address
wraps at the "@" first; a part longer than the column still breaks, so 379 stays fixed.
Lint clean.

## Confirmed by

The Gillett site as Brynn, 2026-10-16: on the account overview at desktop width the
sidebar reads "brynn.ohara@" over "kanabmail.test", broken at the "@". In a 360px frame
it fits on one line. Found on the same screen at 360px: the header loses the logo
([291]).
