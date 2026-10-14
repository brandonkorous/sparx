# 221 — Every email signed off with the business name twice

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 11, on the other side (Renée's emails, read in `.dev-outbox`)
**Surface:** the legal line at the foot of every email the business sends
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01, 2026-10-11 (see below)
**Blocked on:** —

## What happened

The last line of Renée's shipping email (O-000025), and of every email Gillett sends:

> Gillett Diesel Service · Gillett Diesel Service 14812 Heritagecrest Way Bluffdale, UT 84065 United States

The business name twice, then the street, city and country run together with no break.
Gillett's postal address (Email settings) is four lines, the first being its name.

## What should have happened

> Gillett Diesel Service · 14812 Heritagecrest Way, Bluffdale, UT 84065, United States

## How to reproduce

1. A postal address in Email settings that starts with the business name (the natural way
   to write one).
2. Any email. Every time.

## Why it matters

It is on every message, and it is the line that says who the mail is from.

## Where it lives

`wizeworks/packages/email/src/silica/frame.ts`: `${name} · ${physicalAddress}`, the
address's line breaks left as they are, which HTML shows as spaces.

## The fix

- `packages/email/src/silica/frame.ts` `legalLine`: the name once (left out when the address
  already starts with it), the address's lines joined with commas, escaped once.

Shared: every tenant email, every brand. Tests, red first: `legal-line.test.ts` (4); email
package 231 pass. Lint clean.

## Confirmed by

P01, 2026-10-11, reading Renée's O-000027 confirmation in `.dev-outbox`: "Gillett Diesel
Service · 14812 Heritagecrest Way, Bluffdale, UT 84065, United States".

## Rating effect

—
