# 287 — "Fix this first: We make one for you in your colors" (one what?)

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Site checks › About (90 / 100)
**Surface:** a page's site check, the "Fix this first" box (both consoles read the same check words)
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

> Fix this first
> We make one for you in your colors. Your own photograph will always do better.

The sentence was written to sit under its check's name ("The picture shown when it is
shared"). The "Fix this first" box shows it alone, so "one" refers to nothing.

## What should have happened

"When this page is shared, it shows a picture we make in your colors. Your own photograph
will always do better."

## How to reproduce

1. Sign in as Doty. Site checks › About.

Any page whose share picture is the generated one, when that is its top fix.

## Why it matters

The top advice on the page cannot be acted on if it does not say what it is about.

## Where it lives

`wizeworks/packages/seo-audit/src/check-copy.ts`, `checkTip('og-image', warn)`.

## The fix

The tip names its subject. Stored scorecards take current words when read (issue 863),
so every page shows the new sentence without a rescan.

Test: `src/check-copy.test.ts` (one new, red, then green); seo-audit 51/51. Package type
check and lint clean.

## Confirmed by

sparx as Doty, Site checks › About: "Fix this first: When this page is shared, it shows a
picture we make in your colors. Your own photograph will always do better."

## Rating effect

seo.audits.detail: the top fix says what it is about.
