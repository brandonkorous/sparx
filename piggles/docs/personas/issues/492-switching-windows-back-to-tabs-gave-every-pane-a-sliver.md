# 492 — Switching windows back to tabs gave every pane a sliver, then no tab at all

**Status:** fixed
**Severity:** major
**Found by:** Brandon, toggling the workspace back to tabs with a day's work open
**Surface:** the workspace presentation toggle, every pane (both consoles)
**Filed:** 2026-09-09

## What was wrong

With nineteen panes open, switching the workspace from windows back to tabs
tiled the screen into **nineteen tab groups**, one pane each, about 90px wide.
Every tab strip was squeezed down to a pair of arrows and a `…`; the pane bodies
showed one word per line. Measured:

```
groupCount: 18
tabsPerGroup: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2]
```

And it did not go away on reload, because by then it had been SAVED as the tab
arrangement.

## Why

Windows mode gives every pane a window of its own — that is what
`evictFromGrid` is for, and it is correct. So a busy workspace in windows mode
is N windows for N panes.

Coming back, `applyWindowMode` docked each one with:

```ts
group.api.moveTo({ position: 'right' });
```

`moveTo` with a `position` and no target group asks dockview for a **new grid
group** and docks the window into that. One new group per window. With N=19 that
is nineteen columns.

The comment above it described the call correctly and never asked what happens
when it runs nineteen times:

> No target group + a position docks it against the grid's edge — the same call
> the tear-off control uses to bring a popout back, so a window returning to the
> grid behaves identically however it left.

True for ONE window. The tear-off control moves one. This loop moves all of
them, and "identically however it left" is exactly the wrong property when
windows mode's normal state is one pane per window.

**A second, quieter half:** `reconcile` re-opens any pane the saved photograph
never saw, and did it with no reference pane — so `addPanel` minted a group for
each of those too.

### And why it kept coming back

Switching to windows PHOTOGRAPHS the tab arrangement you are leaving. So the
nineteen slivers were written into
`piggles-console-mode-layout:<site>:tabs` and faithfully restored on every
switch back. Clearing that one key was needed on top of the code fix; deleting
it while still in tabs mode does nothing, because the next switch re-photographs
the broken layout on the way out.

## The fix

A window coming back joins a group that already exists, as a TAB. The saved tabs
arrangement is restored first, so the groups that photograph placed are the
homes on offer, and this only has to house what it never saw. The host is
re-read each pass, because moving a group can dispose it and because the first
window back is what creates the grid when the photograph placed nothing.

```ts
for (const group of floating) {
  const host = api.groups.find((other) => other !== group && other.api.location.type === 'grid');
  if (host) {
    group.api.moveTo({ group: host, position: 'center' });
    continue;
  }
  group.api.moveTo({ position: 'right' });
}
```

`reconcile` now passes `target: 'tab'` and a `fromPaneId` in tabs mode, so a
homeless pane joins a group instead of minting one. In WINDOWS a group of its
own is right — `applyWindowMode` turns each into its own window a moment later,
which is what that presentation is.

## The second defect, which the first fix caused

Merging the groups fixed the slivers and broke something else in the same
breath. Measured straight after:

```
groupCount: 1     tabsPerGroup: [19]     activeTabs: 0
contentHTML: '<div class="dv-watermark"></div>'
```

Nineteen tabs across the top, **every one of them inactive**, and dockview's
"nothing open" watermark filling the body. A full tab strip over a blank screen,
which reads as every pane having collapsed the moment tabs were switched on.

**Moving a group into another leaves the host with no active panel.** Nothing
warns; the group is valid, it just has nobody selected, and that is a state a
person cannot reach by clicking and so should never be left in.

`applyWindowMode` now reads the active pane BEFORE anything moves and puts it
back afterwards, falling back to the first tab if that pane is gone.

```ts
const focused = api.activePanel?.id ?? null;
// …moves…
const landing = (focused ? api.getPanel(focused) : undefined) ?? api.panels[0];
landing?.focus();
```

## Proven

Nineteen floating windows, nineteen active tabs. One click:

| after the switch | value                 |
| ---------------- | --------------------- |
| groups           | **1**                 |
| tabs in it       | **19**                |
| active tabs      | **1**                 |
| watermark        | **false**             |
| body text        | 553 characters, drawn |

Held across a reload. Typecheck clean on both consoles.

## Still open

Once, the stored preference read `tabs` while the toggle button still read
`windows` and every pane floated. A reload cleared it and it has not recurred,
so the cause is unproven and nothing has been patched for it. If the toggle ever
stops responding, this is it, and a reload is the workaround.
