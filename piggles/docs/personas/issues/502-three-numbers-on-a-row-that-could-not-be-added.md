# 502 — Three numbers on a row that could not be added

**Status:** fixed and proven
**Severity:** minor
**Found by:** Devi, booking in 60 brass buckles from Fairfield Trims
**Surface:** the delivery detail, both consoles
**Filed:** 2026-09-14

## What she saw

The delivery she had just booked in, one line:

| Item                         | Units | Invoiced | Plus getting it here | Really cost, each |
| ---------------------------- | ----- | -------- | -------------------- | ----------------- |
| Brass belt hardware, antique | 58    | $3.60    | **$14.00** 6.3%      | **$3.84**         |

$3.60 plus $14.00 is not $3.84. It is not close to $3.84.

## Why

**Invoiced** is per unit. **Really cost, each** is per unit. Between them, **Plus
getting it here** was the line's whole share of the delivery's costs. Two of the
three numbers answered "each" and the middle one answered "in total", with
nothing on the row saying so.

A table is read across. Putting a total between two per-unit figures makes the
row state an arithmetic that is false.

It was wrong on the linen delivery too, where the same row read $18.00 · $1.25 ·
$18.63. Nobody caught it, and the reason is instructive: **$1.25 is small enough
to look like a per-unit number.** $14.00 against $3.60 is not, so the second
delivery exposed what the first had hidden. A defect that only shows at certain
magnitudes is still there at all of them.

## What changed

The column carries the per-unit share:

| Item                         | Units | Invoiced | Plus getting it here            | Really cost, each |
| ---------------------------- | ----- | -------- | ------------------------------- | ----------------- |
| Brass belt hardware, antique | 58    | $3.60    | **$0.24** 6.3%<br>$14.00 in all | **$3.84**         |

$3.60 + $0.24 = $3.84. The row is now the sum it looks like.

The line's total share is named under it whenever more than one unit landed, so
nothing is lost on a delivery with several lines, where the per-line total is the
only place that figure appears.

The percentage badge did not change and did not need to: it was already a ratio
of the landed total, so it never depended on which basis the column used.

## The wider lesson

The house rule against presenting an unmeasured value as a measured one has a
sibling: **do not present two different bases as if they were one.** A column
header is a promise about what its numbers mean, and neighbouring columns make
that promise stronger than the header does on its own.
