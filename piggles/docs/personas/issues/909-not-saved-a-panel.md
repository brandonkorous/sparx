# 909 — "Not saved: a panel"

**Status:** fixed
**Severity:** **minor**
**Found by:** P03 · act 321, on Who is worth chasing
**Surface:** the status bar's unsaved chip (Piggles; sparx shows a count only)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** walked on screen: "Not saved: Who is worth chasing", cleared
when the edit was undone

The chip read only a title a screen had set for itself. A screen that never set
one went "Not saved: a panel" while its own tab named it. Issue 482 fixed this
for one screen at a time. The chip now asks the registry for the tab's name,
the way the detached-window chip already does, so every screen is covered.
