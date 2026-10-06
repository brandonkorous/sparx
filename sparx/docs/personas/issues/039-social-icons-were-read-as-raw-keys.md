# 039 — Social icons were read aloud as "facebook", "linkedin", "x"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** tenant site › footer social links (`wizeworks/packages/builder-render/src/atoms/social-links.tsx`)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** test; after the restart, the live homepage footer icons carry `aria-label` Facebook, Instagram, LinkedIn and YouTube
**Blocked on:** —

## What happened

Each icon's `aria-label` is `socialLabel(platform)`, whose name table covered only
the two networks WITHOUT an icon. Every icon network fell back to its raw key, so a
screen reader announced "facebook". The test even said this label "is never
reached on a real site".

## The fix

Proper names for all ten networks; the test pins them and the stale test comment
is corrected. Proved red by removing Facebook (1 fails). builder-render 119/119, tsc 0.

## Rating effect

—
