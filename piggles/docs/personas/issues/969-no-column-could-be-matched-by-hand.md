# 969 — No column could be matched by hand

**Status:** fixed (standing checks)
**Severity:** major
**Found by:** P09 · The Marrow Review · standing checks (importing her list a second time)
**Surface:** mypiggles › Move in › Start with a file › Tell us what this file is (both consoles)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks
**Blocked on:** —

## What happened

She brought her reader list in a second time, on purpose. The screen was honest:
"Nobody in this file is new", and nobody was copied (40 readers before, 40 after,
Hugh still off the list). But it also put a code error over the page: "Cannot update a
component while rendering a different component".

Looking at why showed something worse. Every column has a box saying what the column
is. She opened the box for **Subscribed** and picked **Leave this column out**. The
list stayed open and the box still said **Email opt-in**. No click and no key changed
it. On a file the guess got wrong, she could not put it right, and the screen tells her
to "Change anything we got wrong".

Under that there was a second fault. The screen only told the import about a change
when the number of rows ready changed. Leaving out "Subscribed" keeps 40 rows ready, so
even with a working box the import would have used the old match.

## Why

- `column-mapper.tsx` filled silica's `Select` with plain `<option>` elements. Silica's
  Select draws those in its list but only answers to `SelectItem`, so the click did
  nothing.
- It reported upward by calling the surface's setter while drawing, keyed on
  `entity:okCount:errorCount:blocked`. That broke React's rule (the error) and missed
  any change that kept the counts.

## The fix

Both consoles' `surfaces/migration/column-mapper.tsx`:

- Every choice is a `SelectItem`.
- The mapping is reported after drawing, on every change of the mapping itself.

A sweep of both consoles found no other silica `Select` filled with `<option>`; the
rest sit in `NativeSelect`, where `<option>` is right.

## Proof

On screen, her file: **Subscribed** set to **Leave this column out** sticks, and the
practice run sent rows with no opt-in field. No code error. With the old count-keyed
report put back, the same steps still sent `"accepts_marketing":"yes"` for every row;
the fix restored, none. Both consoles type-check and lint clean.
