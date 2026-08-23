# 128 — The check that was supposed to catch the brand leak does not look for it

**Status:** open
**Severity:** major
**Found by:** P02 · Halo & Hem · act 9
**Surface:** `pnpm check:boundaries`
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —

## What happened

[122](122-every-email-her-salon-sends-is-signed-with-another-companys-name.md) put
one brand's name and marketing link into the footer of every email the other brand's
tenants send. `wizeworks/CLAUDE.md` says a guard exists for exactly that, and lists
it among the four things `check:boundaries` fails on:

> - a brand name literal in a user-facing string under `wizeworks/**`

It does not check that. [scripts/check-boundaries.mjs](../../../../scripts/check-boundaries.mjs)
has three rules — imports crossing between the trees, imports from a banned package,
and a ratchet on `@sparx/*` usage counts — and no string rule at all. There is no
hex-literal rule either, which the same paragraph also claims.

The check runs green. It has always run green on this.

## Why it matters

A documented guard that does not exist is worse than no guard, because the next
person to add a literal reads the paragraph, sees the check pass, and concludes they
are inside the rules. That is how "Sent with sparx" survived a documented sweep of
110 brand literals across 29 files.

It is also the shape already recorded as a running theme in this repo: a structural
check whose scope is asserted in prose rather than proven by a red run.

## What it should do

Fail on a brand name (`sparx`, `Piggles`, and any future brand key) appearing in a
**string literal** under `wizeworks/**`, comments stripped as they already are, with
the exceptions the same file names for hexes: the brand registry itself, and
`platformBrandIdentity`'s env-var plumbing, which must name the brands to resolve
them.

The prose already lists a hex-literal rule too. Either both get written, or the
paragraph is corrected to describe the three rules that exist. **Writing them is the
right answer** — the leak they describe is real and has now happened twice.

## Worth proving before it lands

The rule this file exists to record: a new guard must be shown to go RED before it is
trusted green. Reverting the two lines of
[frame.ts](../../../../wizeworks/packages/email/src/silica/frame.ts) that carried
"sparx" is a ready-made red case.
