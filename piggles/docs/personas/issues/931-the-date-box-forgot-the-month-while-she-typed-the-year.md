# 931 — The date box forgot the month while she typed the year

**Status:** fixed (act 325)
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 325, re-checking Order to a supplier's held score
**Surface:** every date box that stores a day through `pickedDayUtc` and reads it back through `dayFromStored` (both consoles): Expected on an order to a supplier, the delivery notice's date and the assembly run's date
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, typing 10/20/2026 into an empty Expected at a person's speed and at full speed
**Blocked on:** —

## What happened

Order to a supplier was held at Ease 4 "until the silicaui release reaches the
catalog" for [667](667-i-could-not-type-the-date-it-asked-me-for.md). 667 says
it was cleared on September 19. Before raising the score I typed a date again.

From an empty Expected box, typing `10202026` at 120ms a key left
**`mm / dd / 2026`**. Key by key:

```
1  → 01 / dd / yyyy
0  → 10 / dd / yyyy
2  → 10 / 02 / yyyy
0  → 10 / 20 / yyyy
2  → 10 / 20 / 1902
0  → 10 / 20 / 1920
2  → mm / dd / yyyy      ← everything gone
6  → mm / dd / 2026
```

The box reports a date as soon as month, day and year each hold a number, so
typing 2026 hands the form the years 2, 20 and 202 on the way. Two helpers in
`lib/today.ts` could not carry those:

- `dayFromStored` rebuilt the day with `new Date(year, month, day)`, which reads
  a year from 0 to 99 as 1900 to 1999. Year 2 came back as **1902**, and the box
  showed it.
- `dayIso` did not pad the year, so year 202 became `202-10-20`. That failed the
  `YYYY-MM-DD` check, the stored value fell to null, and the box, handed null,
  wiped the month and day she had typed.

So 667's fix was real, and [670](670-the-date-i-typed-came-back-a-day-earlier.md)'s
fix the next day, which introduced `dayFromStored` to stop the day-earlier bug,
undid it for every box that reads through it. 667 was confirmed on a box that
already held a year, which is the one case this does not touch.

## The fix

- `dayIso` writes the year with four digits: `0202-10-20`.
- `dayFromStored` sets the year with `setFullYear`, which takes it as given.
- Both consoles, one file each, so the three boxes in each console that go
  through these helpers (an order to a supplier, a delivery notice, an assembly
  run) are fixed at once. The three that hand the `Date` straight through
  (receiving, stock as of a day, the books check) were never affected.

## Proof

- `today.test.ts` (both consoles), "a year typed one digit at a time": years 2,
  20, 202 and 2026 each go through a save and a read unchanged; year 202 is
  written `0202-10-20`. On the old file the first three and the padding case
  fail (4 red); 2026 passes, which is why every earlier test missed it.
- On screen, as Devi, a new order to a supplier: `10202026` at 120ms a key from
  empty read **10 / 20 / 2026**; `11032026` at full speed read **11 / 03 /
  2026**. Nothing saved.
- The sparx console's half is the same file, tested, not driven.
