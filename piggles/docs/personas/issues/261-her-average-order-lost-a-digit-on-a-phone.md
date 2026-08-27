# 261 — Her average order lost a digit on a phone

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 11 — scoring the selling report at 360px (RULE #6)
**Surface:** mypiggles › Sell › How it is going › How selling is going
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

The three figures at the top of the selling report, at 360px:

```
Revenue      Orders          Average
$584|        6               order
after        placed in       $111.3
refunds      this period     spent per
                             order
```

Her average order is **$111.32**. The phone says **$111.3**.

Revenue is clipped too — the hairline separator cuts through the last glyph of
`$584`.

## What should have happened

A money figure is shown in full or it is not shown.

## Why it matters

- **It is not ugly, it is WRONG.** A truncated number reads as a complete one:
  nothing on screen says a digit is missing, so $111.32 becomes $111.3 and there
  is no cue to distrust it. Two cents is nothing; the same clip on `$1,234.56`
  hides fifty-six cents, and on a four-figure revenue it can hide a whole digit.
- It is on the report a shop owner opens ON A PHONE — checking the day's takings
  away from a desk is the phone use case for this screen, not the desk one.
- Nothing catches it. The number is correct in the data, correct in the DOM and
  correct in the accessibility tree; only the pixels are wrong.

## Where it lives

`.stats` in silicaui is an `inline-flex` row with `overflow: hidden` and no
wrapping, and `.stat` is `inline-grid` with `grid-template-columns: repeat(1,
minmax(0, 1fr))` — so a block shrinks freely and the container crops whatever no
longer fits. `.stat-value` is `1.875rem` (30px) with `1.25rem 1.5rem` of padding
around it: three blocks in a ~330px pane leaves roughly 60px of usable width for
a figure that needs about 90.

Nothing is wrong with silica here. `.stats` is a row of KPIs and it does that
correctly; **what the pane never said is what should happen when the row does not
fit.**

## The fix

`flex-wrap` on the container and `min-w-44 flex-1` on each block: they share the
row while it is wide enough for all three, and wrap to one per line when it is
not. Both are layout/sizing utilities on a silica component, which root RULE #1
sanctions — no re-skinning, nothing painted, and the component keeps its own
surface, separators and type.

Silica's own `stats-vertical` was the other candidate. It is the right class for
a deliberately stacked group, but it is not responsive — it flips the separators
to horizontal too, and undoing that at the wide end takes two arbitrary-variant
selectors that would be exactly the call-site painting RULE #1 exists to stop.

## Confirmed

At 360px, stacked and whole:

```
Revenue        $584      after refunds
Orders         6         placed in this period
Average order  $111.32   spent per order
```

At 900px, back in one row with its hairline separators, `$111.32` complete.

## Worth a look elsewhere

Every other `<Stats>` in the console has the same shape and the same exposure —
this was found because the selling report is the one act 11 sent Devi to, not
because it is the only one. Not swept in this pass, and named here rather than
left silent.

## Related

RULE #6 — a pane is not scored until it has been seen in dark AND at 360px. This
one passed every automated check, reads correctly in the DOM, and is only wrong
in pixels; the width pass is the only thing that finds it.

[[feedback_responsive_top2_rule]] — responsive is non-negotiable for platform UI.

## Rating effect

How selling is going, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
