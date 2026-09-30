# 877 — The ranking of what matters could not be answered

**Status:** fixed
**Severity:** **major** — "What matters" ranks every line of stock by worth and
by demand, stores an override beside each measurement, and already prints
_"you set this · measured long tail"_ when one exists. Nothing in either console
could write one. On the shop that needs it most, 69 of 76 lines rank as long tail
for the single reason that a maker's stock has no purchase price
**Found by:** P03 · act 311, sweeping Stock by data weight
**Surface:** mypiggles › Stock › What matters, in both consoles
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 14 tests, every rule proved red on a plausible wrong version

## Measured

```
classified lines on the platform                94
carrying an override on worth or demand          0
carrying a reason for one                        0

Devi's 76 lines: every one ranks C (long tail)
of those, with any cost recorded                 7
```

Seventy-six lines, one answer. Not a ranking, a tie.

## The chain

Everything behind the console is finished:

- `PUT /v1/inventory/classifications` exists, gated on `editor`.
- `setClassificationOverride` writes `abcOverride`, `xyzOverride`,
  `overrideReason`, `overrideBy` and `overrideAt`, clears all five when both
  classes come in null, calls `applyEffectiveClassToLevel` so the answer reaches
  `inventory_levels.abc_class`, and writes an audit entry with a before and
  after.
- `ClassificationRow` in the console carries `measuredAbcClass`,
  `measuredXyzClass`, `abcOverride`, `xyzOverride`, `overrideReason` and
  `overrideAt`.
- `useSetClassification` in `planning-data.ts` posts it and invalidates the right
  keys.

`useSetClassification` had **zero callers in either console**. A repo-wide search
returned the two definitions and nothing else.
[[feedback_screen_over_a_function_nobody_calls]]

And the pane was already rendering the answer:

```tsx
const overrideNote = (row) =>
  row.abcOverride ? (
    <span className="block text-sm">
      you set this · measured {abcLabel(row.measuredAbcClass).toLowerCase()}
    </span>
  ) : null;
```

Written, styled, placed in two spots for two widths, and never once on a screen.
[[feedback_fetched_but_never_rendered]]

## Why a maker needs to answer a ranking

Worth is `units used in a year × what a unit cost you`. A line with no cost
enters that product as a zero, scores nothing, ties with every other unpriced
line and lands in the long tail. The pane says all of this out loud already, and
sends her to record the costs, which is the right first answer and is wired.

It is not the only one. **Juniper Row makes clothes.** A cut-and-sewn shirtdress
has no purchase price and never will; it has cloth, thread and two afternoons.
So the ranking is not slightly wrong about that line, it is structurally unable
to be right about it, and the line the shop is known for sits in the long tail
being advised to buy some when somebody asks.

The pane's own code already relied on the answer existing:

```ts
const rankable = (row) => row.costKnown || row.abcOverride !== null;
```

The escape hatch was designed, depended upon, rendered, and unreachable.

## This is not the reorder level

The neighbouring pane, "Why this number", opens with a stated purpose: stop
people overriding arithmetic they cannot see. Nothing here contradicts it, and
the difference is worth writing down because it is the reason this is a fix
rather than a hole.

A **reorder level** is arithmetic over measured inputs: sales rate, lead time,
service level. Typing over it throws a measurement away, so that pane answers the
question instead of offering a box.

A **worth ranking** is arithmetic over inputs the platform cannot see at all:
what a hand-made line cost to make, which line the shop is known for, which one
is about to be in the window. Supplying a missing fact is not overruling a sum.

That is also why the dialog shows the measurement first and keeps showing it
after an answer is given. An override that hides what it replaced leaves a number
with nothing to check it against, which is the failure the other pane exists to
prevent.

## What it does now

A pencil on each row opens **Where <code> sits in your stock**. It is a dialog,
not a pane: one short question about one row, opened from that row, finished in
seconds, and the pane the row would otherwise open is already spoken for.

Four parts, in order:

1. **What your numbers worked out** — the measured pair as badges, plus, for an
   unpriced line, the sentence explaining that a year of it works out to nothing
   and what the fuller answer would be.
2. **Worth** and **Demand** pickers, each with an explicit
   _"Work it out from my numbers"_ option rather than a blank first entry. A
   blank reads as "not loaded yet".
3. **Why** — optional, because insisting on a reason is how a screen gets
   answered with "because", and it is the part somebody reads a year later.
4. **Use the numbers again**, shown only when there is something to put back.
   Hidden rather than disabled: a greyed control invites somebody to work out
   what would turn it on.

Save is disabled until something has actually moved, so opening a dialog and
closing it cannot stamp a fresh date on a record nobody touched.

## The rule

```ts
export function classifyWrite(form: ClassifyForm): ClassifyWrite {
  const abcClass = form.abc === '' ? null : form.abc;
  const xyzClass = form.xyz === '' ? null : form.xyz;
  const reason = form.reason.trim();
  const setting = abcClass !== null || xyzClass !== null;
  return { abcClass, xyzClass, ...(setting && reason ? { reason } : {}) };
}
```

The reason rides along only when an axis is actually being answered. A reason
attached to nothing is a sentence explaining a decision that was not taken, and
stored it would make the record read as though one had been.

## A second defect, created by the first fix and fixed with it

The pane counted its warnings off `costKnown`:

```ts
const withoutCost = rows.filter((row) => !row.costKnown).length;
const noneRankable = rows.length > 0 && withoutCost === rows.length;
```

while judging each row with `rankable`, which also accepts an override. The two
could not disagree while no override could exist. They disagreed **the first time
one did**: on screen, a line badged **Top value**, sitting under a warning
reading _"Neither column can rank anything yet"_.

Both counts now come off `rankable`, and the milder warning says the lines
already answered by hand are not counted in it.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## Proved

**14 tests**, every rule proved red by breaking the thing it guards:

```
send the reason whatever is set     →  "drops a reason when neither axis is being answered"
drop the trim on the reason         →  2 fail: spaces, and the edges
ignore the reason in "has it moved" →  "is true when only the reason changes"
count a stray reason as an answer   →  "is false for a stray reason with no band behind it"
```

**Checks:** typecheck 0 on both workbenches. ESLint and prettier clean. Guards
green including `check:console-parity`, `check:column-floor`,
`check:action-labels` and `check:screen-names`. `classify-by-hand.ts` and
`classify-dialog.tsx` are byte-identical in both consoles — the dialog renders no
icon, so there is nothing in it that has to come from one brand's icon set.

**Driven end to end on her own screen**, on `LINEN-SHIRTDRESS`.

The dialog opened with both pickers on "Work it out from my numbers", the
measured pair reading **No cost price** and **Not enough history**, and **Save
disabled**. Setting Worth to **Top value** and typing _"We cut and sew this one
ourselves, so it will never have a purchase price. It is the dress the shop is
known for."_ enabled Save. It reported **"LINEN-SHIRTDRESS is ranked the way you
said"**, and the row came back badged **Top value** with **"you set this ·
measured long tail"** beneath it — the first time that sentence has rendered on
this platform.

The database afterwards: `abc_class` C, `abc_override` A, the reason stored,
`override_by` and `override_at` both set, and **`inventory_levels.abc_class`
now A**, which is what the cycle-count schedules and the reorder worklist read.

Reopening showed the stored answer seeded back, **"Answered by hand 34 seconds
ago"**, a **Use the numbers again** button, and Save disabled again. Pressing it
reported **"LINEN-SHIRTDRESS goes back to what the numbers say"** and the row
returned to **No cost price**, with 0 overrides left on the platform.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/inventory/classify-by-hand.ts` (new, identical)
- `{piggles,sparx}/apps/workbench/surfaces/inventory/classify-dialog.tsx` (new, identical)
- `piggles/apps/workbench/surfaces/inventory/classify-by-hand.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/inventory/planning-classes.tsx`

## The thing to remember

**A screen can describe an act nobody can perform, in the present tense.** The
pane did not have a gap where the override should be. It had the override's
output, its styling, its comparison to the measurement, and a helper function
treating it as a settled fact. Everything except the twenty lines that let a
person do it.

The tell is a rendering whose condition has never once been true. The measurement
that finds it is the same one as 874 and 876: **how many rows in this column are
filled, and what would fill one?**
