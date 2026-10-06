# 044 — "cookie banner" found the Cookie Policy, not the screen with the banner

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Search everything (both consoles)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** sparx: "cookie banner" puts **Legal pages** first, Enter opened it, and the cookie banner section was there. Piggles: same catalog change, phrase test green; not checked on screen (only another persona's account is signed in)
**Blocked on:** —

## What happened

To change his cookie banner's title, Doty typed "cookie banner" in Search
everything. The only result was his **Cookie Policy** page. The screen that holds
the banner, Legal pages, did not appear.

## What should have happened

The phrase he types for a thing finds the screen where that thing is set.

## Where it lives

`lib/surfaces/catalog/cms.ts` (both consoles): Legal pages carried "cookies" but
not "cookie banner", and every word must match. The cookie banner section was
added to that screen in [037] without its search words.

## The fix

- Legal pages keywords: "cookie banner", "cookie consent", "cookie popup",
  "do not sell" (both consoles).
- `components/launcher-owner-phrases.test.ts` (both): "cookie banner" must put
  `cms.legal.list` first. Red with the keyword misspelled (1 of 10 fails).

## Rating effect

Search: none (a new phrase, now covered).
