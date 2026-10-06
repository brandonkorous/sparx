# 031 — Searching "shipping policy" found nothing

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Search everything (launcher)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — "shipping policy" in Search everything shows Content › Legal pages; Enter opens it
**Blocked on:** —

## What happened

The site check said the product page links to `/shipping-policy`, which does not
exist. Doty searched **shipping policy**: "Nothing matches that." Searching
**policy** alone found **Legal pages**, where shipping and refund policies live.

## Where it lives

The launcher requires every word of a phrase to match (by design,
`components/launcher-match.ts`). The Legal pages entry
(`lib/surfaces/catalog/cms.ts`) carried `privacy, terms, policy, cookies,
returns policy, gdpr, compliance`, and nothing with "shipping" or "refund".

## The fix

Both consoles: Legal pages also answers to "shipping policy", "refund policy",
"return policy", "privacy policy" and "terms of service".

## Confirmed by

To confirm on screen in the next search (see 032 for why the first attempt was
interrupted).

Checks: prettier clean; Piggles `cms.ts` 240 lines.

## Rating effect

—
