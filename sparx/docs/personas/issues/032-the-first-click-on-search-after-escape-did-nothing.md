# 032 — The first click on "Search everything" after Escape did nothing

**Status:** open
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › top bar › Search everything
**Filed:** 2026-10-01
**Fixed:** —
**Confirmed by:** —
**Blocked on:** —

## What happened

With the site designer open: open Search everything, press Escape, click Search
everything again. The button takes a focus ring and nothing opens; a second click
opens it. Reproduced twice in a row. Typing after the swallowed click goes
nowhere, which is how "shipping policy" first seemed to vanish.

## Evidence

A history/DOM probe on the page logged, after Escape: `back()`, palette closed,
`popstate {seq:4}`; then for the swallowed click, nothing at all (no open, no
history push). A later click opened it, and that open recorded no `pushState`
either, which suggests `nav-history.tsx`'s `applying` flag stayed set after the
dismissal's `history.back()` (it is cleared only inside `applyView`, which runs
only when the popped seq has a stored view).

## Update

Later the same swallowed first click happened on a fresh page load with no
Escape at all, on Business details too. That widens it, and it also makes a
browser-tool artifact possible (the automation's first click on a freshly loaded
tab). The next probe (a capture listener on the button and a dialog observer) was
cut off when the browser extension disconnected.

## Next

1. Brandon: one real-mouse check. Reload the workbench and click "Search
   everything" once. Does it open?
2. If it does not: trace the `lib/workbench/nav-history.tsx` dismissal path and the launcher's open path
   together; check whether it reproduces outside the site designer.
