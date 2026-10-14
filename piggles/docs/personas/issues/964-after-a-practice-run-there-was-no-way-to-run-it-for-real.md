# 964 — After a practice run there was no way to run it for real

**Status:** fixed (act 10)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10
**Surface:** mypiggles › Move in › a file (both consoles)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 10
**Blocked on:** —

## What happened

She took the practice run the screen recommends. It said **"Practice run finished:
nothing was saved. This is exactly what a real import would do. Run it for real when you
are ready."** The only button left was **Move something else**, which throws away the
file and every column choice. To run it for real she had to pick the file and match the
columns again.

After a page reload the tab still read **Practice run** over an empty file box.

## The fix

`surfaces/migration/migration-run.tsx`, both consoles:

- After a practice run, the toolbar keeps **Bring in 40 customers** beside "Move
  something else", using the same file and the same columns.
- A pane opened with no run on screen names itself "Move in", once, on opening. (A first
  version re-ran on every render and renamed the practice run's own tab; it now runs once.)

## Proof

On screen: practice run, then **Bring in 40 customers**: "Your business is here", 40 of
40 brought over. Reloaded: the tab reads "Move in"; a new practice run's tab reads
"Practice run". Both consoles typecheck and lint clean.
