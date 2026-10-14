# 955 — Her email address was cut off on a phone

**Status:** fixed (act 7)
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 7, reading to the end of a piece at 390px
**Surface:** every site, any email link in a narrow column
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 7, her footer at 390px
**Blocked on:** —

## What happened

Her footer's "Write to us" column read **editors@marrowreview.co.u**. The address is
one word with nowhere to break, wider than its half of the footer, so it ran off the
screen.

## The fix

`apps/site/app/site.css`: `a[href^='mailto:'] { overflow-wrap: anywhere; }` in the
lowest layer, so an author's own utility still wins. It also lets the column shrink to
fit, which `break-word` does not.

## Proof

At 390px the address wraps to a second line inside its column ("…co." then "uk") and
the page is 390px wide.

## Still open

It breaks where it runs out of room, not after the `@`. Choosing the break point would
mean inserting a break opportunity into the rendered text.
