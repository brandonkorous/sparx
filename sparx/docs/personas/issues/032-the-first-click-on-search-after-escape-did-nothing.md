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

## Measured, 2026-10-06 (acts 6 and 7)

The browser tool drops input, not the page:

- Every click and keystroke sent in the **same tool batch as a navigation, or in
  the first batch after one**, reached nothing: the deal form for Salt Lake County,
  Red Rock and Høgberg stayed blank three times, and "Add a request" and "Add
  someone" each needed a second press right after a `scroll_to`. In act 6, a
  document listener saw **no event at all** for such a click.
- The same form, typed into 5 seconds later in its own batch, kept every
  character (title checked after a 5-second wait). So nothing on the page was
  resetting it.
- Search everything opened on the first press several times this session when the
  click was not the first input after a navigation.

So this is the tool, not the product, on every case measured. It stays open only
for the one check the tool cannot make.

## Next

1. Brandon: one real-mouse check. Reload the workbench and click "Search
   everything" once. Does it open?
2. If it does not: trace the `lib/workbench/nav-history.tsx` dismissal path and the launcher's open path
   together; check whether it reproduces outside the site designer.
