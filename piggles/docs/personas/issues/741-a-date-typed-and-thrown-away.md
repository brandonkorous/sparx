# 741 — A date typed into a box, and the form saved as though the box were empty

**Status:** fixed everywhere, and guarded
**Severity:** major
**Found by:** P03 · Juniper Row · act 265
**Surface:** mypiggles + sparx workbench — every date box in both consoles
**Filed:** 2026-09-19
**Blocked on:** —

## What happened

Setting an agreed wholesale price until the end of March. The date box took
`03`, `31` and `2027`, and showed all three.

The button underneath still said **"Set this price"** rather than "Record this
agreement", and it was enabled. The form had decided no end date was given.

Asking the box itself:

```js
> const el = document.querySelector('input[type="date"][aria-label="Until"]');
> ({ value: el.value, badInput: el.validity.badInput })
  { value: "", badInput: true }
```

A native date box is three cells and reports a value only when **all three**
hold something. Until then `value` is the empty string, which is the same thing
it says when nobody has touched it. The two states a form must tell apart look
identical from the one property everyone reads.
[[feedback_the_empty_control_is_the_untested_one]]

The browser knows. `validity.badInput` is exactly this state and nothing else.

**MEASURED 2026-09-19:** **82** `<Input type="date">` call sites across the two
consoles. **0** read `badInput`.

**Not the same as [667](667-i-could-not-type-the-date-it-asked-me-for.md).** That
one was silicaui's segmented `DateInput` taking no keystrokes at all from empty,
and it was fixed upstream in silicaui 0.56.0. This is the NATIVE
`<input type="date">` the console reaches for instead, taking the keystrokes
perfectly well and then telling the form nothing about them. Same lesson, two
different controls, which is the point of the lesson.

## What it costs

- On an OPTIONAL date, the typing is dropped in silence and the record saves
  without it. That is what nearly happened to the agreement: a price with no end
  date, saved under a button whose words said it was not an agreement at all.
- On a REQUIRED date, Save stays disabled with nothing on screen saying why —
  "you have not filled this in" and "you have half filled this in" are two
  causes behind one outcome, and only one of them has an obvious remedy.
  [[feedback_one_outcome_two_causes]]

## What was done

**`dayBoxProblem(value, badInput)`** in `lib/today.ts`, beside the `NOT_A_DATE`
sentence it already owned, returning the new `HALF_A_DAY`:

> That date is not finished. Fill in the day, the month and the year.

**`<DayInput>`** in `components/`, a wrapper over silica's `Input` whose
`onValueChange(value, incomplete)` reports both halves. A caller that ignores
the second argument behaves exactly as before. It fires on blur as well as
change, because the box never fires `change` at all while it is half typed —
leaving it is the only moment the app can hear about it.

Used on `commerce.product.trade-pricing`, which is where this was found.

## Closed: the other 76 call sites, and why the plan changed

Found again on 2026-09-22 from the other end. Devi raised an invoice for a $504
order and typed a due date into **When it should be paid**. The box took it.
`value` was the empty string, `badInput` was true, the Save button stayed grey,
and the footer said **"Saved just now"** — so the screen reported success over a
date that had been thrown away. On an invoice that date is the whole point: with
no due date it never counts as late, so it never appears on the list of who owes
money, and nobody is ever chased for the $504.

**The plan above was wrong, and doing it would have been the mistake.** It said
to visit each of the 81 panes and give each one its own `useState` and its own
copy of the sentence. That is 81 places the wording can drift and 81 places the
next person forgets — a call-site patch is a deferred fix everyone else pays
interest on. [[feedback_silicaui_single_point_of_change]]

**The box is the only thing that knows it is half typed, so the box says so.**
`DayInput` now holds that state itself and renders `HALF_A_DAY` under the
control. Every call site gets the warning by being this component, and a caller
that also wants to block a save still reads the second argument of
`onValueChange(value, incomplete)`.

```
76 boxes, 49 files, both consoles   ts.createSourceFile, 0 refused
```

The sweep was a TypeScript-parser codemod, not a regex: it classified every
site, verified that each `onChange` used its argument for `.target.value` and
nothing else, and would have refused loudly on anything it could not place. It
refused none. [[feedback_codemod_diff_your_own_sweep]]

**One pane needed a hand after it.** `b2b/invoice-detail` already refuses an
EMPTY due date with "Set a due date." A half-typed box reports empty, so that
pane would have shown two red lines about one keystroke, and the first of them
would have been wrong — she had started setting it. It now tracks `incomplete`
itself, says `HALF_A_DAY` in its own slot, and passes `sayWhenUnfinished={false}`
so the box stays quiet. One failure, one sentence.
[[feedback_one_outcome_two_causes]]

**And `check:day-boxes` is born green**, so the pinned-baseline shape the plan
called for is not needed: there is nothing left to exempt. It fails on any
`type="date"` outside `components/day-input.tsx`, and it separately asserts that
`DayInput` still asks `validity.badInput`, still says the sentence, still hands
both halves to the caller, and still reports on blur.

The last of those four first passed while the code had stopped passing the
second argument — the check was reading the component's own header, which
DESCRIBES `onValueChange(value, incomplete)` in prose. It reads the code only
now, and all four were watched going red.
[[feedback_a_test_that_cannot_go_red]]

**A half-typed box fires no change event at all**, because its value never
changes from the empty string. Blur is the only moment the app can hear about
it, which is why `DayInput` reports there too and why the warning appears when
she leaves the field rather than as she types.

## Files

- `piggles|sparx/apps/workbench/lib/today.ts` — `HALF_A_DAY`, `dayBoxProblem`
- `piggles|sparx/apps/workbench/lib/today.test.ts`
- `piggles|sparx/apps/workbench/components/day-input.tsx` — now draws the
  sentence itself; `sayWhenUnfinished` for the one pane that says it in its own slot
- `piggles|sparx/apps/workbench/surfaces/commerce/product-trade-pricing.tsx`
- 49 more surface files across the two consoles, 76 boxes
- `piggles|sparx/apps/workbench/surfaces/b2b/invoice-detail.tsx` — the one that
  would have said it twice
- `piggles|sparx/apps/workbench/surfaces/inventory/movements-list.tsx` — a
  wrapping `<label>` needed `htmlFor` once the box was no longer its only child
- `scripts/check-day-boxes.mjs` — new, proved red on all five of its refusals
- `package.json`, `.githooks/pre-push`

## Proof

Typed `03` and `31` into Until and clicked away: the box reads `03/31/yyyy`,
the sentence under it reads **"That date is not finished. Fill in the day, the
month and the year."**, and the button is disabled. Typed `2027`: the sentence
becomes **"Putting a date on it records it as an agreement, starting today"**
and the button becomes **"Record this agreement"**.

The test was proved red by making `dayBoxProblem` ignore `badInput` — which is
what all 82 call sites do — and it failed on exactly the one assertion.
