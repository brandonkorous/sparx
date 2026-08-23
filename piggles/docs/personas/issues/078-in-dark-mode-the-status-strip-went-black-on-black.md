# 078 - In dark mode the status strip went black on black

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · standing checks - re-scoring in dark
**Surface:** mypiggles › the status strip along the bottom, every screen
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21, in both themes

## What happened

Switched the console to Dark to re-score the rated panes. Everything held up
except the bottom-right of the status strip, which reports the last thing that
happened: after taking her payment it should read **"Order payment recorded, 8m
ago"**, and instead there was a faint smudge.

Measured: **1.12:1**. Near-black ink on the dark strip. It was the only text on
the whole screen below 4.5:1 in dark, and the same element measures 15.18:1 in
light, so nothing about it was obviously wrong to anyone working in light.

## Why it matters

Small, and it is the one part of the console whose entire job is to tell her
something already happened. A confirmation nobody can read is the same as no
confirmation: she has no way to know the payment went in except by going back and
looking at the order again.

## The cause, which RULE #4 already names

```tsx
<Button color="neutral" variant="ghost" size="xs">
```

`neutral`'s foreground does not flip with the theme, so the ghost ink stays
near-black on a dark strip. Measured on the live page:

| classes                            | ink                | contrast    |
| ---------------------------------- | ------------------ | ----------- |
| `btn btn-neutral btn-ghost btn-xs` | `rgb(39, 35, 42)`  | **1.12:1**  |
| `btn btn-ghost btn-xs`             | `rgb(244,245,247)` | **12.66:1** |
| `btn btn-xs`                       | `rgb(244,245,247)` | 14.77:1     |

This is exactly the case the [[feedback_no_monotone_use_full_palette]] memory
describes: grey re-enters through SECONDARY controls, the ones that feel like
"just chrome", and the answer is to name no color at all so the control resolves
to `base-content` and is theme-correct by construction.

## The fix

`color="neutral"` dropped from all four status-strip controls: the activity
button in [status-bar.tsx](../../../apps/workbench/components/status-bar.tsx),
the [detached-chip](../../../apps/workbench/components/status/detached-chip.tsx),
and both in [jobs-chip](../../../apps/workbench/components/status/jobs-chip.tsx).

`variant="ghost"` is kept, and deliberately: a bare `btn` measures marginally
better but paints a filled chip, and these are quiet chrome in a 32px strip. A
colorless ghost is transparent AND theme-correct, which is what was wanted in
the first place.

Four fewer `color="neutral"` call sites. Counted properly at the end of the
session rather than carried forward: `piggles/apps` has **451** at HEAD and
**433** in the working tree, and the diff removes **18** and adds **0**. The
"445 → 432" figures quoted earlier in this run were counted over a different
scope and were wrong; these are `git grep` against HEAD and are reproducible.

## Confirmed on screen - 2026-08-21

Same element, same text, both themes:

| theme | before     | after       |
| ----- | ---------- | ----------- |
| dark  | **1.12:1** | **12.66:1** |
| light | 15.18:1    | 15.18:1     |

A full sweep of every text node on the order pane in dark now returns **nothing**
below 4.5:1.
