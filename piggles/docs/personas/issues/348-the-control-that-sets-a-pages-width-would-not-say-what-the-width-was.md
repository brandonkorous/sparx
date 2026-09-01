# 348 — The control that sets a page's width would not say what the width was

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · chasing why her About page did not line up with the rest of her site
**Surface:** mypiggles › My Site › Page › the Design panel (every chip row in it)
**Fixed:** 2026-08-30
**Confirmed by:** read back off her own About page, and five tests proved red first

## What happened, on her site, in pixels

Her About page's words started 240 pixels to the right of everything else on the same
page. Measured off the served HTML:

| On her About page              | starts at | width                   |
| ------------------------------ | --------- | ----------------------- |
| The footer's columns           | 703px     | 1152px (`max-w-6xl`)    |
| The header's nav               | 727px     |                         |
| **Her heading and paragraphs** | **943px** | **672px (`max-w-2xl`)** |

Four of her pages use `max-w-6xl`. Her About page was the only one on the site set to
anything else, so its left edge lined up with nothing — not with the header above it,
not with the footer below it, not with any other page.

## What she would have seen if she had gone looking

The control exists, and it is well named: **Don't get wider than — Auto · No limit ·
Narrow · Readable · Wide · Very wide.** `Readable` is exactly `max-w-2xl`, which is
exactly what her page was set to.

Opening it on her About page showed **six plain buttons with nothing marked.** Not
"Readable". Not even "Auto". A row of six, all identical, on the one control that knew
the answer.

## Why

```ts
const selected = state.value === option.value && !state.inherited;
```

An INHERITED value was never marked. And the "Auto" chip lights only when there is no
value anywhere — so a row whose value came from a smaller size lit nothing at all.

**That is the ordinary case, not an edge one.** Almost everything is authored at the
base size, and the Inspector opens on desktop. So most rows, most of the time, in every
group of the Design panel — arrangement, spacing, size, surface, corners, borders, type
— answered "what is this set to?" with a blank.

The value was in the control's own hand. It drew none of it, and printed a small grey
"from a smaller size" beside the group name to say that a value existed without ever
saying which.

## The fix

Show the value in force, and let the WEIGHT say where it came from:

- **solid** — pinned at this size
- **soft** — in force, from a smaller size
- plain — not this one

Soft is not a new idea here: it is the same treatment "Auto" already wears for "this is
what you are getting, and you did not choose it here". And it keeps the distinction the
file's own header is about, which is why the naive fix would have been wrong:

> "Auto" is not the same as picking the inherited value. Cleared means "whatever the
> smaller size says" and keeps tracking later edits to it; re-declaring the value pins
> it, which looks identical today and stops following tomorrow.

Marking an inherited chip solid would have said "you chose this", and clicking it would
then look like a no-op when it is really a pin. Soft says both true things at once.

The rule was extracted into `chipEmphasis`, a pure function, so it is tested rather
than mirrored — this package's own `rowKey` precedent.

## What it let her do

With the control finally saying `Readable`, the fix on her page was two decisions:

- the column that holds the page → **Very wide** (`max-w-6xl`), so her left edge is the
  site's left edge;
- the two paragraphs inside it → **Readable** (`max-w-2xl`), so the lines stay the
  length they were.

That is the structure her own "Made in the studio" page already used: the band at the
site's measure, the prose narrower inside it. Her About page now starts where every
other page starts and still reads at 75 characters a line.

## Confirmed by

`@wizeworks/studio`: **184 tests across 23 files**, five of them new. Proved red, then
read back off her live console:

```
Readable :: btn btn-primary btn-soft btn-sm
```

Typecheck clean.

## Noticed, not fixed

**The vocabulary describes a measure in the abstract, not relative to her own site.**
`Readable` looks like the right answer for a page of prose; nothing in the control says
the rest of her site is set to `Very wide`. A control that knew what the site's other
pages used could have said so. That is a design proposal rather than a defect, and it
is left for Brandon.

## Rating effect

Against `P03 console — Juniper Row`, the page editor, and against `P03 site` where it
closes the alignment gap.
