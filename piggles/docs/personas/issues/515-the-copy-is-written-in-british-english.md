# 515 — 436 sentences are written in British English

**Status:** DONE — swept in [528](528-the-british-spelling-sweep.md) (353 changed, 48 held back on purpose)
**Severity:** minor each, and a standing rule broken across the whole product
**Found by:** reading the em-dash sweep's output ([514](514-the-em-dash-sweep.md))
**Surface:** both consoles, both marketing sites, the shared packages
**Filed:** 2026-09-15

## What is wrong

The rule is American spelling, everywhere, in code and comments and copy alike.
While reading roughly 7,800 rewritten sentences for the em-dash sweep, the same
British spellings kept turning up in them.

Counted the same way the em-dash sweep counts, so this is text a PERSON READS
and not enum values, Prisma columns or comments. A bare `'cancelled'` used as a
stored status is excluded; `'Cancelled. The order is closed'` is not.

| spelling      | reads     | in copy |
| ------------- | --------- | ------: |
| cancelled     | canceled  |     175 |
| catalogue     | catalog   |      48 |
| grey          | gray      |      35 |
| cancelling    | canceling |      32 |
| licence       | license   |      24 |
| recognise     | recognize |      23 |
| labour        | labor     |      21 |
| programme     | program   |      13 |
| centre        | center    |      10 |
| honour        | honor     |       8 |
| metre         | meter     |       8 |
| ageing        | aging     |       8 |
| per cent      | percent   |       7 |
| enrol/enrols  | enroll    |       9 |
| the long tail |           |      15 |
| **total**     |           | **436** |

## What was fixed

Four, because they were mine or sat beside mine:

- `'in your favour'` on the supplier bill detail in both consoles, which I wrote
  earlier this same session ([510](510-a-partial-invoice-reads-as-a-disagreement.md))
- `'so no one is favoured.'` on the scheduling setup in both consoles

## Why the rest is a pass of its own, not a find-and-replace

**`cancelled` is 175 of the 436 and it is the dangerous one.** It is also a
stored status value on orders, bookings, subscriptions, purchase orders and
supplier bills, an API contract and a Prisma enum. A blind replace would rename
data. The count above already separates the two by requiring the string to look
like prose, but every one still has to be looked at to know which side it is on.

`licence` and `programme` have the same shape: the noun is British, the verb and
the compound may be spelled either way, and some are inside a quoted product name
where the spelling is not ours to change.

## Worth keeping in mind

This was invisible for as long as nobody read the copy end to end. It took a
different sweep, reading every sentence for a different reason, to surface it.
