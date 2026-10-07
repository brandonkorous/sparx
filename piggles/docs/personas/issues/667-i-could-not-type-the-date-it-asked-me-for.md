# 667 — I could not type the date it asked me for

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 238
**Surface:** mypiggles › Stock › Orders to suppliers › New order › Expected
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** — cleared 2026-09-19. silicaui 0.56.0 is installed and the fix is
live in both consoles; driven on screen, both halves, see **Confirmed live** at
the end.

## What happened

Devi rang Ashcombe Mills weeks ago for a small order of linen tape. They promised
it for the 4th of September. It never came, and she wanted Piggles to chase it,
so she opened **Stock › Orders to suppliers › New order** to write the order down
after the fact.

She picked Ashcombe Mills. She picked Main Warehouse. Then she came to:

> **Expected**
> `mm / dd / yyyy`
> When you expect it. Left blank, the supplier's usual lead time fills it in when
> you place the order.

She clicked the `mm` cell and typed **9**.

The cursor moved on to `dd`. The month still read `mm`.

She typed the rest of the date anyway — `0 4 2 0 2 6`. The field stayed
`mm / dd / yyyy`. Nothing she typed landed anywhere. She tried the up arrow on
the month, which is the other way a segmented date field is meant to work.
Nothing. The cell reported `aria-valuetext="empty"` after every keystroke.

**A date field that will not take a date.** There is no calendar button beside it
and no other way in, so the only thing she could do was leave it blank and accept
whatever lead time the supplier had on file.

Then, on a different screen, it got worse. **Stock versus your books** opens with
today's date already in the field, and that one DOES type. She pressed Backspace
once, in the month, meaning to retype it:

| Before           | After one Backspace |
| ---------------- | ------------------- |
| `09 / 18 / 2026` | `mm / dd / yyyy`    |

One keystroke in one cell emptied all three. And once emptied, that field was
dead too — typing into it did nothing, exactly like the new-order one. The report
underneath went on showing figures, because it falls back to today when the date
is blank, so the screen looked fine while the control above it was broken.

## What should have happened

You type the date. That is the entire reason this control exists rather than a
calendar popover — silicaui's own documentation for it says so:

> a **typeable**, segmented date field (month/day/year cells you type digits into
> directly, à la native `<input type="date">`), not a calendar-only picker

And Backspace in one cell clears that cell, not its neighbours.

## How to reproduce

Every time, on any of them.

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Orders to suppliers › New order.**
3. Click the `mm` cell of **Expected** and type `09042026`.
4. The cells stay `mm / dd / yyyy` while the cursor advances through all three.

And the second half:

1. **Stock › Reports › Stock versus your books** — the date field reads today.
2. Click `mm`, press Backspace once.
3. All three cells empty. Typing will not refill any of them.

## Why it matters

**It is a hard stop on the one field the screen exists to collect.** "Expected"
is what Overdue deliveries watches, what a backorder promise is computed from,
and what a buyer quotes down the phone. A buyer who cannot set it cannot record
what the supplier actually promised, so the whole chasing loop runs on a lead
time the platform guessed instead of the date the supplier gave.

It was not one screen. **Every date field in both consoles is affected**, because
every one of the 10 call sites passes `value` — which is the normal, correct way
to write React, and is what made this total rather than occasional:

| Screen                          | Field           | Starts | What Devi gets                   |
| ------------------------------- | --------------- | ------ | -------------------------------- |
| Orders to suppliers › New order | Expected        | empty  | **cannot be set at all**         |
| Making runs › new run           | Planned for     | empty  | **cannot be set at all**         |
| Booking stock in                | When it arrived | today  | types, but dies on one Backspace |
| Stock versus your books         | Reconcile as at | today  | types, but dies on one Backspace |
| Reports › what stock is worth   | Value as at     | today  | types, but dies on one Backspace |

(Times and date-times have the same fault, in `TimeInput` and `DateTimeInput`.
Neither has a call site in these consoles yet, so nobody has hit them.)

**Why it lasted.** A field that opens with a date in it works. The two that open
empty are on screens that nobody had yet typed a date into — a purchase order
raised in the console at all is act 237 of this persona run. So every time
anybody looked at a date field, it behaved. [[feedback_absent_behaves_like_fine]]
in the form where the broken case and the working case are the SAME control.

## Where it lives

`@wizeworks/silicaui-react@0.55.0` — a separate repo, `G:/code/@wizeworks/silicaui`.

- `packages/silicaui-react/src/date-input.tsx`
- `packages/silicaui-react/src/time-input.tsx`
- `packages/silicaui-react/src/date-time-input.tsx`

The segment cell itself (`src/lib/date-time-segment.tsx`) was never wrong. It
reads the digit, works out whether it can still grow, and calls `onChange`
correctly. The fault is one level up, in what the three container components do
with that call when they are controlled:

```tsx
const [internal, setInternal] = React.useState(() => partsFromDate(value ?? defaultValue));

React.useEffect(() => {
  if (isControlled) setInternal(partsFromDate(value)); // ← unconditional
}, [value, isControlled]);

function commit(next) {
  if (!isControlled) setInternal(next); // ← controlled: dropped
  onValueChange?.(dateFromParts(next)); // ← null until all three are in
}
```

`onValueChange` only fires with a WHOLE date, which is the right contract — no
parent should ever be handed the 4th of no month. But it means **the keystrokes
before the last one are not representable in the parent**, and the components
kept the half-typed cells only for the uncontrolled case. So, controlled and
empty:

1. Type `9` → `commit({month: 9, day: null, year: null})`.
2. `setInternal` is skipped.
3. `dateFromParts` returns `null`, so the parent is told `null`.
4. `value` is still `null`, so the effect writes the placeholders back.
5. Repeat forever. The third digit can never arrive at a field that still has
   the first two.

The same line explains the Backspace: clearing the month made the date
incomplete, the parent heard `null`, and the effect reset the day and the year
along with it.

## The fix

**In silicaui, not at the call sites.** Ten `value={...}` props in this repo are
each written correctly; patching them would be ten copies of a workaround and the
eleventh would break (root RULE #1 — a call-site patch is a deferred fix).

The segments are the component's own state whether it is controlled or not, and
`value` is synced down only when it says something the cells do not already say:

```tsx
React.useEffect(() => {
  if (!isControlled) return;
  setInternal((prev) => {
    const incoming = partsFromDate(value);
    if (datePartsEqual(prev, incoming)) return prev;
    // An incomplete set of cells beside a null value is the user part-way
    // through typing, never a parent clearing the field.
    if (value == null && dateFromParts(prev) === null) return prev;
    return incoming;
  });
}, [value, isControlled]);

function commit(next) {
  setInternal(next); // always
  onValueChange?.(clamp(dateFromParts(next)));
}
```

The parent still hears nothing until the value is whole, so the contract in the
prop docs is unchanged. A parent that clamps, or that sets the date from
somewhere else, still wins — those are cases where `value` genuinely disagrees.

Changed, all in `G:/code/@wizeworks/silicaui`:

| File                                                | What                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/silicaui-react/src/date-input.tsx`        | the effect + `commit`                                                                    |
| `packages/silicaui-react/src/time-input.tsx`        | same, and the initial state now reads `value`, not only `defaultValue`                   |
| `packages/silicaui-react/src/date-time-input.tsx`   | same; its two `useState`s folded into one so completeness is judged across all six cells |
| `packages/silicaui-react/src/lib/date-parts.ts`     | `datePartsEqual`                                                                         |
| `packages/silicaui-react/src/lib/time-parts.ts`     | `timePartsEqual`                                                                         |
| `packages/silicaui-react/verify-segment-typing.mjs` | NEW — 16 checks                                                                          |
| `packages/silicaui-react/package.json`              | the probe added to `verify`                                                              |

**Sibling check.** All three segmented fields had it; all three are fixed.
`DateRangeInput` is two `DateInput`s and inherits the fix. `Calendar` does not
use segments and was never affected.

**Proved red.** The probe is a jsdom behavioral one in the house idiom
(`verify-form-focus.mjs`), driving real keystrokes against the built bundle.
Reinstating the original three-component handling **fails 11 of its 16 checks**;
the 5 that still pass are exactly the ones that should (rendering a value,
setting one from outside, clearing one from outside, the uncontrolled path, and
"the parent is told the field is incomplete"). [[feedback_a_test_that_cannot_go_red]]

**Not yet in the consoles.** sparx.works consumes the published `0.55.0`, so the
fix lands when silicaui is released and `pnpm-workspace.yaml`'s catalog moves.
Nothing in this repo changed.

## Confirmed by

Re-ran P03 act 238 on the screen, against a locally built silicaui bundle put in
place of the installed one (and then put back, byte for byte).

> **Stock › Orders to suppliers › New order.** Clicked the `mm` cell of
> **Expected** and typed `09042026`. The field read **`09 / 04 / 2026`** and held
> it while the rest of the order was filled in — the same eight keystrokes that
> did nothing twenty minutes earlier.

Before, on the same screen and the same keystrokes: `mm / dd / yyyy`, with
`aria-valuetext="empty"` on all three cells.

## Rating effect

Recorded in [rating.md](../rating.md):

- `Stock › Orders to suppliers › (an order) — Ease 8 → 4`, and back to 8 when the
  silicaui release reaches the catalog. It is scored on what the console does
  today, not on what the source now says.

**Stock versus your books** is not scored here. Its date field has the same
fault, but the pane has not been walked as a pane yet, and a score is for a walk.
Whoever takes it should press Backspace in that field first.

## Confirmed live — 2026-09-19

silicaui **0.56.0** installed, dev restarted, driven as Devi on
**Making things › Plan a run › Planned for**, the field that was dead:

|                        | typed    | showed                                         |
| ---------------------- | -------- | ---------------------------------------------- |
| from EMPTY             | `09`     | `09 / dd / yyyy`, focus on the day             |
|                        | `252026` | `09 / 25 / 2026`                               |
| Backspace on the month |          | `mm / 25 / 2026` — **the neighbours survived** |
| retype the month       | `11`     | `11 / 25 / 2026`                               |

Both halves of the defect are gone: the empty field fills, and clearing one cell
clears one cell. The shipped mechanism keeps the segments as the component's own
state and syncs `value` down only when it says something the segments do not
already say:

```ts
setInternal((prev) => {
  const incoming = partsFromDate(value);
  if (datePartsEqual(prev, incoming)) return prev;
  if (value == null && dateFromParts(prev) === null) return prev;
  return incoming;
});
```

That second line is the fix: an incomplete set of segments beside a `null` value
is somebody part-way through typing, never a parent clearing the field.

## Regressed, and fixed again — 2026-10-06

[931](931-the-date-box-forgot-the-month-while-she-typed-the-year.md). The
next day's fix for 670 added `dayFromStored`, which rebuilt a day with
`new Date(year, month, day)`, and `dayIso` never padded the year. Typing a year
digit by digit into an EMPTY box then wiped the month and day again. The
confirmation above was on a box that already held a year, which hid it. Both
helpers are fixed and the round trip is tested for years 2, 20 and 202.
