# 706 — "Came up short 50.0%", out of two lines

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 247
**Surface:** mypiggles + sparx — Stock › How fast you pack
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen, plus a test proved red
**Blocked on:** —

## What happened

Devi has picked two lines in her life. One came up short. The pack report:

|                   |                 |
| ----------------- | --------------- |
| Confirmed by scan | **0%** (red)    |
| Came up short     | **50.0%** (red) |

and underneath, in red beside her own name, `0%` and `50.0%`, and a table headed
with a warning triangle:

> ⚠ **Shelves that keep coming up empty**

listing one row, for a shelf that is not a shelf: **No shelf recorded**.

One thing happened once. The screen reported a rate, a habit and two failures.

## Why it matters

**A tenth of a percent of precision, out of two events.** 50.0% is not a more
accurate way of saying "1 of 2", it is a claim that this keeps happening. So is
"keep coming up empty". So is a warning triangle.

**The rule was already on this pane, applied to one figure out of five.**
`pickingRate` refuses to divide by a window under a minute and says why instead:

```ts
if (activeMinutes < 1) {
  return { value: '—', hint: `${units} picked, too close together in time to work out a rate.` };
}
```

Its own comment in the picker table says it out loud — _"a walk done too fast to
measure has no rate, and 0.0 is not the honest way to say so"_. Four other
figures on the same screen divide by whatever they are handed.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**And the red one is about hardware she does not own.** "Confirmed by scan 0%"
has two causes with opposite remedies: a warehouse that has scanners and stopped
using them, and a shop that has never had one. Both are zero, so the window
cannot tell them apart, and the pane told a business with no barcode reader that
it was failing at scanning. [[feedback_one_outcome_two_causes]]

```
tenants that have picked anything          1
of those, under 20 lines                   1
of those, that have ever scan-verified     0
```

The denominator is one, because picking is new. Every tenant that ever opens this
pane in its first month sees it the way Devi did.

## What was changed

`ratePercent(part, whole, toneFor)` — below **10 events** a percentage is not
earned, so the figure is the count it actually is:

```
Confirmed by scan    0 of 2
Came up short        1 of 2
```

with **no alarm color**, because one short pick is not a trend to be alarmed
about. `toneFor` is passed in rather than chosen inside: a short rate is bad when
HIGH and a scan rate is bad when LOW, and one helper that pretended otherwise is
how a dashboard goes green on the wrong thing.

The service now returns `everScanned` — one unfiltered look outside the window at
whether this business has EVER confirmed a pick by scan — which splits the two
causes. Devi reads:

> Nothing here was confirmed by scan. If you pick with a barcode reader, this is
> where it shows.

The shelf table only claims a habit when one row has enough behind it to be one;
otherwise it is headed **Where things came up empty**, with no triangle. Its
Rate column shows `—` rather than repeating the count in the column beside it,
and "No shelf recorded" is no longer set in the code face, because it is not a
code.

**The hints stopped being badges.** Each card's explanation sat in a soft
`<Badge>` — a fixed narrow box — so every one of them clipped: `1 unit picked,
too clos…`. The part that says WHY the figure is what it is was the part being
cut, which is issue
[687](687-a-shelf-label-that-says-not-for-sa.md)'s rule again. They are sentences
now, and the alarm color moved onto the figure, which is the thing being judged.

## Guarded

`rate-floor.test.ts`. Removing the floor:

```
× will not make a percentage out of two events
    AssertionError: expected '50.0%' to be '1 of 2'
× gives a count no alarm color, because one event is not a trend
    AssertionError: expected 'danger' to be null
× starts being a rate at the floor and not before
```

Restored: 8 passed, in both consoles.

## Confirmed

Nothing on the pane is red now, because nothing red was true. Every hint reads in
full.
