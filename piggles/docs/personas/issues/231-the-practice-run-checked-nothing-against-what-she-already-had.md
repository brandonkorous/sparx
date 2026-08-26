# 231 — The practice run checked nothing against what she already had

**Status:** fixed and confirmed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 8 — the practice run before importing
**Surface:** mypiggles › Home › Get set up › Move in from somewhere else › Practice run
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 8 — the same file now previews **24 new, 1 already here**, and after the first import **9 new, 16 already here**

## What happened

The screen offers the practice run in these words:

> **Try a practice run first**
> It checks every row against what you already have and shows you exactly what
> would happen, without saving anything.

Devi ran it on her 25-name mailing list. It reported **25 imported, 0 updated**.

Anneliese Vogt is on that list and has been a customer since yesterday. She has
an order, a payment and a return. The practice run counted her as a brand-new
person.

## What should have happened

24 new, 1 already here.

## Why it matters

The one thing a person wants from a practice run before importing a customer list
is _"am I about to duplicate everybody?"_. That is the entire question, and the
answer given was wrong in the direction that causes the fear.

Worse, it is wrong in a way that looks right. "25 of 25" is a satisfying number.
Nothing about it suggests it was never checked.

## Where it lives

`customers` was registered through `wrapLegacy` in
[processors/index.ts](../../../../wizeworks/services/import-worker/src/processors/index.ts),
whose preview is:

```ts
preview: async (_ctx, rows) => rows.map((_row, rowIndex) => ({ rowIndex, action: 'create' }));
```

Its comment is honest about it:

> Its preview reports every row as `create`, which is deliberately the pessimistic
> answer: these three resolve their own natural keys inside the write path, so the
> only way to know create-from-update would be to run them.

That reasoning holds for the two entities it was written for. It does not hold for
customers: the natural key is the email, and the match is one lookup. The wrapper
was reached for because it was there.

**The screen's promise was never adjusted to match.** Two things existed — a
preview that could not check, and a sentence saying it did — and nobody put them
side by side.

## The fix

`customersProcessor` is now a real processor with a real preview: one query for
the whole file (`email IN (…)`, not one round trip per row), then create / update
/ skip per row against what came back.

It was extended again the same day, after the first real import rejected ten rows
the practice run had passed — see
[233](233-ten-contacts-refused-because-market-stall-has-a-space-in-it.md). The
preview now also runs the write path's own validation, so "exactly what would
happen" covers _would this be refused_ as well as _is this person already here_.

## What it looked like once fixed

```
practice run   25 rows   24 new · 1 already here · 0 problems
```

And after the first import had landed 15 of them, the same file re-previewed as
**9 new, 16 already here** — which is the arithmetic working.

## Related

[233](233-ten-contacts-refused-because-market-stall-has-a-space-in-it.md) is the
other half of the same promise.

## Rating effect

`Home › Move in` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
