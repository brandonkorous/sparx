# 076 - Every soft badge, button and alert is below readable, in light mode

**Status:** open — needs Brandon
**Severity:** major
**Found by:** P01 · Thistle & Rye · standing checks — re-scoring in light
**Surface:** mypiggles in LIGHT mode. 1,005 `variant="soft"` across 411 files
**Filed:** 2026-08-21
**Measured:** in the browser, on her own Home, against the rendered pixels

## What happened

Looking at Home to re-score it, the least readable text on the screen turned out
to be a panel **I added yesterday** (#073). Measuring it rather than squinting at
it showed **2.17:1** — and then showed that the panel was not the problem.

Silica's `soft` variant paints the background as a 12–15% tint of the accent
color and **the text in the accent color itself**:

```js
// @wizeworks/silicaui/src/components/alert.js  (badge.js and button.js identical)
[sel("-soft")]: {
  backgroundColor: "color-mix(in oklab, var(--alert-accent) 12%, var(--color-base-100))",
  color: "var(--alert-accent, var(--color-base-content))",   // ← the ink IS the hue
  borderColor: "transparent",
},
```

On a saturated palette that lands somewhere near legible. **Piggles' palette is
deliberately soft and warm**, so hue-on-tint-of-hue collapses. Measured in the
running console against the actual rendered background:

| color                 | soft contrast | badge size | AA needs |
| --------------------- | ------------- | ---------- | -------- |
| `warning` `#ffd166`   | **1.37:1**    | 13px       | 4.5:1    |
| `success` `#5ecf8b`   | **1.77:1**    | 13px       | 4.5:1    |
| `info` `#6ea8fe`      | **2.14:1**    | 13px       | 4.5:1    |
| `module` (builder)    | **2.17:1**    | 14px       | 4.5:1    |
| `danger` `#f08080`    | **2.28:1**    | 13px       | 4.5:1    |
| `primary` `#ff6f86`   | **2.32:1**    | 13px       | 4.5:1    |
| `secondary` `#2d3443` | 9.18:1        | 13px       | — passes |

`secondary` passes only because Piggles' secondary happens to be a dark ink. Every
color that is actually a _color_ fails, and `warning` — the one that means
"look at this" — is the worst on the list at **1.37:1**, which is pale yellow on
pale yellow.

**The same recipe, and so the same numbers, in three components.** Counted across
`piggles/apps`:

| component | `variant="soft"` call sites |
| --------- | --------------------------- |
| `Badge`   | **689**                     |
| `Alert`   | **133**                     |
| `Button`  | **26**                      |
| other     | ~157                        |
| **total** | **1,005 across 411 files**  |

Every Alert in the console that names a variant names `soft`. There is not one
`outline`, `dash` or solid among them.

## Why it matters

**The house style mandates the broken thing.** `statusTone()` +
`<Badge color={statusTone(s)} variant="soft">` is the documented pattern for
every status pill ([[feedback_status_badges_semantic_color]]), so all 689 of them
render Paid, Draft, Overdue and Out of stock at 1.4–2.3:1. The rule that says
status must carry semantic color and the recipe that renders semantic color
unreadably are pointing in opposite directions.

It also sits directly on top of [[feedback_no_faded_text]] — a CORE rule, and one
already recorded as a consistent failure. This is that failure at 1,005 call
sites, and not one of them chose it: they chose `soft`, which is the house style,
and `soft` did the fading.

On her Home right now, four of the five things she is offered are below 2.2:1:

```
17px  2.03:1  Add a product
17px  2.05:1  Send an invoice
17px  1.96:1  Add a customer
17px  2.12:1  Work on my site
```

Those are the calls to action on the first screen a new owner sees.

**Badges are also 13px** and alerts **14px**, under the platform's 16px body floor
([[feedback_base_font_size_16px]]) — a second, independent problem stacked on the
first.

## What this is NOT

Not a palette bug. `#ffd166` is a fine warning color: the **solid** variant puts
dark ink on it and measures **6.35:1**. The hue is right; using it as ink on a
tint of itself is what fails.

Not a call-site bug either. 1,005 sites all made the same correct choice from the
component's own API.

## The fix, and why it is not in this repo

One line, three times, in `@wizeworks/silicaui`, and the variable it needs is
**already being set**. It has to darken the ink in light and leave dark alone,
which mixing toward `base-content` does in both directions. A soft alert already carries `--alert-accent-content`
(`#202631`, the readable ink for that hue); the soft recipe simply does not use
it:

```js
[sel("-soft")]: {
  backgroundColor: "color-mix(in oklab, var(--alert-accent) 12%, var(--color-base-100))",
  color: "var(--alert-accent-content, var(--color-base-content))",   // ← already defined
  borderColor: "transparent",
},
```

or, if the tinted look is wanted rather than full-contrast ink, a darkened mix:
`color-mix(in oklab, var(--alert-accent) 60%, var(--color-base-content))`.

**Silicaui is an external versioned package (0.55.0), so this cannot be changed
from this repository**, and a `.alert-soft { … }` override in Piggles' own CSS is
a bespoke restyle of a silica component — RULE #1 says that needs Brandon's
explicit approval, asked for up front. Hence: open, not fixed.

There is no token-only fix. `--alert-accent` also drives the outline and dash
borders, and `--color-warning` is correct as the solid fill; changing either to
rescue `soft` breaks something that currently works.

## What was changed

**One call site, and only because it was mine.** The #073 template-update panel
on Home was the worst text on the screen at 2.17:1 / 14px. It now uses the solid
`alert-module` at 16px:

|             | before        | after             |
| ----------- | ------------- | ----------------- |
| title       | 2.17:1 @ 14px | **6.35:1 @ 16px** |
| description | 2.17:1 @ 14px | **6.35:1 @ 16px** |
| button ink  | 6.35:1        | **14.29:1**       |

The button drops its `color="module"`: the alert is already wearing the module
hue, so a module-colored button on it measures **1:1** — invisible. A colorless
`btn btn-sm` is the right control there and needs no approval (RULE #4 covers the
_naming_ of `neutral`, not a control with no color at all).

**The other 1,004 were left alone deliberately.** Changing them one at a time is
exactly the deferred fix RULE #1 exists to prevent, and the systemic fix is one
line somewhere I cannot reach.

## Rating effect

Every rated pane's Clarity score was taken by eye on a screen where the status
pills were unreadable, so the scores are optimistic by an unknown amount. Worth a
re-score once this is settled, not before.
