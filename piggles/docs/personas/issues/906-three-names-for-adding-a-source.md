# 906 — Three names for adding a source, and a column that did not say what it held

**Status:** fixed
**Severity:** **minor**
**Found by:** P03 · act 321
**Surface:** `inventory.sources` and `inventory.sources.detail` (both consoles)
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** walked on screen

## Three names

The `+` in the panel said **Connect somewhere else**. The list's button said
**Add a source**. The tab it opened said **Where a count comes from**. One
action, three names, and the search box knew none of them (issue 904). Issue
729 set the rule: one action, one name.

"Source" is already this screen's word: the column, the search box, the button
and the form's own save button ("Add this source") all use it. So the `+`, the
tab and the empty-state sentence say **Add a source** too. The Piggles override
that renamed the `+` is gone, and the sparx tab ("Add a stock source") matches.

## The column

**How it is doing** read **Only when I ask** over a source that had never run.
That cell holds a file's or a link's update SCHEDULE, and a bridge program's
last check-in. It is now **How it reaches us**, which fits both.
