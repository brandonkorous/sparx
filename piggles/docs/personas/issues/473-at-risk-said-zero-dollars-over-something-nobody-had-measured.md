# 473 — "$0.00 at risk", over something nobody had measured

**Status:** fixed
**Severity:** major
**Found by:** Devi opening Stock for the first time and reading the headline before the words
**Surface:** `inventory.planning` and `inventory.planning.idle` (both consoles)
**Filed:** 2026-09-09

## What was wrong

At risk is the screen the planning module exists for: what am I about to run
out of, and what will running out cost me. Opened for the first time, the top of
it read:

```
Sales at risk     Items to act on     Suppliers measured
$0.00             0                   0
```

`$0.00` in danger red. Devi has never opened this screen and no overnight pass
has ever run for her.

She pressed **Work it out now**, which is what the screen asks for, and the same
three figures became:

```
Sales at risk     Items to act on
$558.00           2
```

Two garments, seven days of cover each, a fortnight's lead time. The screen had
been $558 wrong, in the reassuring direction, on the number a person reads first.

## The screen already said so, three times, in words

This is not a pane that forgot the problem. It says it in the blue banner
(_"Nothing has been measured yet"_), in the amber note (_"72 stock lines have
never been measured"_), and in the empty state, which is as clear as it gets:

> **Nothing has been checked yet.** This list is empty because no pass has been
> made over your sales and deliveries — not because everything is fine.

The file's own header comment states the rule in capitals:

> _"a row that has never been measured says so instead of showing a zero, and an
> empty list says WHICH kind of empty it is"_

The rows follow it. The empty state follows it. The three headline figures did
not, and a headline figure is what gets read. Words underneath a number do not
outrank the number.

`useHasBeenMeasured()` was already imported into the component and already in a
variable, two lines above the figures that ignored it. Exactly the shape that
keeps recurring here: the value is in the component's hand and nothing draws it.

## The fix

The two figures that are OUTPUTS of the pass now say `Not yet` until one has
run, with the reason underneath:

```
Sales at risk     Items to act on
Not yet           Not yet
Unknown rather    Nothing has been
than zero, until  looked at, so
a pass has run    nothing can be counted
```

**Suppliers measured** is left alone on purpose. It counts delivery times taken
from real deliveries, which is a fact about the supplier records rather than an
output of the pass — zero there is a real zero, and Devi genuinely has no
suppliers.

**Not selling** carried the identical shape and got the identical fix: `Cash
tied up`, `Costing you a year` and `Not selling at all` are all sums over rows
the pass produces, and all three read `$0.00 / $0.00 / 0` before it had.

## Proven

Forced the unmeasured branch locally and reloaded both panes: three `Not yet`
figures on Not selling, two on At risk, each with its reason, and the empty
state below them agreeing rather than contradicting. Reverted the force and
confirmed the real figures return.
