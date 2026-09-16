# 490 — The examples on two forms were somebody else's trade

**Status:** fixed
**Severity:** minor
**Found by:** Devi opening New cost
**Surface:** `finance.expense.detail` · the timesheet note (both consoles)
**Filed:** 2026-09-09

## What was wrong

The placeholder in the box where a business says what it spent money on:

> Brake pads for the Henderson job

Devi makes clothes. So does the shop next door in the persona set, and the salon,
and the bakery. A placeholder is the platform showing somebody what this field is
FOR, and this one shows them a garage.

The timesheet note beside it does the same: _"Forgot to clock in, callout on the
Henderson job…"_ — a callout is a trade word, and "the Henderson job" is the same
garage.

## Why it matters more than a placeholder usually does

There is a standing rule about this: one client is not the frame. An example that
belongs to one trade tells everybody else this software was built for somebody
like them and adapted for you.

## The fix

- "Boxes and tape from the packing supplier" — anybody who ships anything
- "Forgot to clock in, early start on Saturday…" — anybody with staff

## Proven

New cost opens with the packing-supplier example.
