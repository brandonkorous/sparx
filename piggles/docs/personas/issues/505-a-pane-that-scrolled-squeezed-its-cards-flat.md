# 505 — A pane that scrolled squeezed its cards flat instead

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, when the warning she needed was cut off mid-sentence
**Surface:** `PANE_SHELL` + seven inventory panes, both consoles
**Filed:** 2026-09-14

## What she saw

The counting schedule's "Nothing is covered by this" warning, clipped:

> There is no stock at this location in this group, so this schedule would never
> raise a
> ~~count. Try "Everything at this location", or pick the place your stock actually sits.~~

The last line was half-drawn and the card ended.

That was not the half of it. Asked what the pane was actually hiding, in a 908px
window:

```
card                              shown   real    hidden
What to call it / Which location    142     220      78
What it covers                      252     410     158
How often, and how much at a time   288     471     183
History                              88     128      40
                                                  -----
                                                    459
```

**459 pixels of a form, gone.** The location dropdown was one of them: the label
"Which location" was on screen and the control under it was not.

And the pane reported `scrollHeight === clientHeight`. It believed it fitted, so
there was no scrollbar and no way to reach any of it.

## Why

`PANE_SHELL` is a flex column. Silica's `.card` sets `overflow: hidden` — sensible
for rounded corners — and per the CSS flexbox spec, **`min-height: auto` resolves
to 0 when `overflow` is anything but `visible`**. That is the whole bug in one
sentence: the automatic minimum size that normally stops a flex item shrinking
below its content is switched off by the very property that then hides the
overflow.

So on a pane shorter than its form, the column does not scroll. It compresses
every card until the total fits, each card silently clipping its own remainder,
and the shell measures as fitting because it now does.

It gets worse as content grows, which is exactly backwards: the warning that only
appears when something is wrong is the thing that pushes the column over the
edge and gets cut off.

## The answer was already in the building

`pane-toolbar.tsx` carries `[&>*]:shrink-0` on the toolbar row, for this reason.
It had not been carried to the shell around it.

## What changed

A named shell, so the next scrolling pane cannot be written without it:

```ts
export const PANE_SHELL_SCROLL = `${PANE_SHELL} overflow-y-auto [&>*]:shrink-0`;
```

Seven panes in each console were building `` `${PANE_SHELL} overflow-y-auto` ``
by hand (eight sites, since one file has two). All of them now use the constant:
asn-detail, count-schedule-detail, planning-explain, po-approval-rule-detail,
supplier-bill-detail, supplier-bill-new, supplier-return-detail.

The other ~880 uses of `PANE_SHELL` hold their own scrolling region inside and
were never at risk.

## Proven

Same pane, same window, after:

```
pane content    1297px in a 908px pane, scrollbar present
cards hidden    0 · 0 · 0 · 0
```

The location dropdown is back on screen.

## Worth keeping in mind

This is a defect a static check cannot see and a screenshot only shows by
accident. Nothing was misspelled, nothing threw, every test passed, and the
clipping is invisible unless you happen to know the card should be taller. What
found it was reading one sentence on screen and noticing it stopped early.
