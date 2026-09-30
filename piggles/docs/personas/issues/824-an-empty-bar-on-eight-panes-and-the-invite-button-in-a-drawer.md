# 824 — An empty bar on eight panes, and the invite button in a drawer

**Status:** fixed on the panes opened; measured across the rest
**Severity:** usability
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — the Home app's settings panes
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi
**Blocked on:** —

## The one that mattered most

**Team.** One person on it, a search box, a count, and a hamburger. No way to
add anybody.

"Invite someone" was there — three clicks deep, inside the overflow popover,
behind an unnamed hamburger. It sat in `controls`, which is the slot that FOLDS
when a pane is narrow, and this pane was narrow because it is one of three open.

The file's own comment, two lines above it:

> …so a narrow pane shrinks the search box rather than turning **the primary
> action** into two stacked words.

It knew. It was in the wrong slot. `primary` never folds, and that is what
`check:toolbar-primary` exists to enforce — its rule is about COMMIT actions
(Save, Create), and "Invite someone" opens a dialog rather than committing, so
it passed. Both consoles. Fixed in both.

## Seven more bars with nothing on their left

Every pane in this console says what it is showing, on the left of its toolbar.
These did not:

| pane | says now |
| --- | --- |
| Dashboards | a count |
| Dashboard | **Sales · Last 30 days** — both its controls fold on a narrow pane, so at that width it was a wall of figures with nothing naming them |
| What kind of business | the line of work you have picked, which is the pane's single fact |
| AI connections | whether an AI account is connected, which is what everything else on the pane depends on |
| Notifications | Saved / Not saved yet, beside a Save button |
| Teammate | that person's role |
| Link | the reason, in a word — it was the ONE pane in 370 with no toolbar at all |

The link one is worth stating plainly: the pane reached by somebody who has just
clicked something that did not work was the pane with no chrome telling them
where they were.

## The measurement, and why the rest is not swept

Counted across both consoles once the pattern was clear:

|  |  |
| --- | --- |
| `<PaneToolbar>` elements | 689 |
| **with nothing on the left** (no `status`, no `controls`) | **171** |
| of those, panes that show a LIST | **72** |
| of those, everything else | 92 |

**72 list panes do not say how many rows they have**, and one of them is
`commerce/orders-list` — the screen a shop owner opens more than any other.

They are not swept here, for the same reason issue 818 did not sweep 74 bare
`<EmptyState>`s: the right sentence is different on every pane. A list wants a
count in its own noun with its own plural, a form wants a saved state, a detail
pane's tab already names it and a count of one thing is not information. A script
that filled 171 bars would be putting words on screens nobody had read, which is
the thing this whole pass exists to catch.

The 72 list panes are the bounded piece: one line each, one noun each, and the
count is already in scope in every one of them because the row list is right
there. That is the next job, not this one.

## Files

- `piggles|sparx/apps/workbench/surfaces/team/index.tsx` — Invite is `primary`
- `piggles/apps/workbench/surfaces/analytics/{dashboards-list,dashboard-view}.tsx`
- `piggles/apps/workbench/surfaces/industry/industry.tsx`
- `piggles/apps/workbench/surfaces/ai-connections/ai-connections.tsx`
- `piggles/apps/workbench/surfaces/notifications/notifications.tsx`
- `piggles/apps/workbench/surfaces/team/member.tsx`
- `piggles|sparx/apps/workbench/surfaces/link-unresolved.tsx`
- `piggles/apps/workbench/lib/console/copy.ts`

## The JSX comment, again

Moving the Invite button reproduced a mistake recorded four days ago in act 281:
a `{/* … */}` between two JSX **attributes** is `TS1005: '...' expected`, not a
comment. It is legal between children and illegal between props, and it looks
identical. Both files, caught by typecheck, moved inside the attribute value.
