# 708 — "Sent every monday at 7am", and it was none of those things

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 248
**Surface:** mypiggles + sparx — Stock › Sent to your inbox
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen, plus a test proved red
**Blocked on:** —

## What happened

The schedule form's **When** section describes itself in a sentence. On a new
schedule it read:

> Sent every monday at 7am.

with the Time zone field below it, a free-text box, containing **UTC**.

## Why it matters

Three faults in one sentence, and the field under it made a fourth.

**The zone was hidden exactly when it was wrong.**

```ts
const zone = schedule.timezone === 'UTC' ? '' : ` (${schedule.timezone})`;
```

`UTC` is what the form defaults to. So the one case where the hour is NOT the
reader's hour is the one case the sentence kept quiet about. In Britain a 7am UTC
report lands at 8am for five months of the year, and the screen said "7am" with
nothing after it. [[feedback_one_outcome_two_causes]]

**The caption under the field promised something it could not keep:**

> The hour above is local to this zone, and it follows the clocks: a 7am report
> stays a 7am report through the summer.

True of a real zone. Not true of UTC, which has no clocks to follow.
[[feedback_a_promise_in_copy_is_a_contract]]

**`.toLowerCase()` on the whole sentence.** The caller lowered the string to slot
it after "Sent ", so a weekday stopped being a proper noun. Had she typed a zone
name, it would have lowered that too, into a string that is not the one she
typed.

**And the 21st read "the 21th".** The ordinal tested the whole number against 1,
2 and 3, so the 21st, 22nd, 23rd and 31st of the month were all "th".

**The field was a text box.** It asked a shop owner to type `Europe/London` from
memory, and when she did not, it left UTC in.

## What was changed

- The zone is named whenever it is not the zone the reader is sitting in,
  whatever it is, and said as a place: **"7am London time"**, not
  **"(Europe/London)"**.
- `afterSent` lowers the first letter only.
- `ordinal` counts the way English does: 11th, 12th, 13th, 21st, 22nd, 23rd.
- Time zone is a list, not a box, defaulted to where the browser says she is.
- The caption is true of any zone: "the time **in this zone**, and it follows
  **that zone's** clocks".

## Guarded

`schedule-sentence.test.ts`. Putting the three faults back:

```
× names the zone when it is not the reader's own
    AssertionError: expected 'Every Monday at 7am' to be 'Every Monday at 7am UTC'
× counts the days of the month the way English does
    AssertionError: expected 'On the 21th of each month…' to contain 'the 21st'
× lowers only the first letter, so Monday stays Monday
    AssertionError: expected 'every monday at 7am utc' to be 'every Monday at 7am UTC'
```

Restored: 7 passed, in both consoles.

## Confirmed

On the screen, with the browser in Los Angeles and the schedule set to London:

> **Sent on the 21st of each month at 7am London time.**

The schedule was saved, **Send now** pressed, and the delivery table read
`5 seconds ago · By hand · Sent · p03.devi@piggles.test · 1 row`.
