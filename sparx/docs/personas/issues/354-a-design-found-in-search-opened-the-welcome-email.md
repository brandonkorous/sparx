# 354 — A design found in search opened the Welcome email

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 161, as Doty
**Surface:** workbench › Site › Email designs, opened from search or a link (`sparx/apps/workbench/surfaces/builder/email/email-editor.tsx`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 on screen as Doty, 2026-10-19
**Blocked on:** —

## What happened

Doty searched "Fleet winter". Search listed "Fleet winter readiness, November 2026 · Email
design". He clicked it. The designer opened on "Welcome (sent automatically)", with the
subject "Welcome to {{site.name}}". The address said
`/builder/email-designs?emailId=c8bb7462-…`, the right design.

## What should have happened

The designer opens on the design he clicked.

## How to reproduce

1. Search for an email design by its name and open it.
2. The designer shows the first email in the list, whichever was clicked.

## Why it matters

An owner who edits what opened changes the automatic Welcome email that every new customer
gets, believing it is the campaign.

## Where it lives

Every link names the design `emailId`: the search entry (`commerce/src/universal-projection.ts`),
the route (`links/src/routes.ts`), the Piggles designer. The sparx designer read only
`ctx.params.id`, found nothing, and showed the first email.

## The fix

`linkedEmailId(params)` in `email-switching.ts`: `emailId`, else `id` for a pane saved before.
The designer uses it.

Test, red first: `email-switching.test.ts`, four new cases, among them "opens the design the
search result names, not the first in the list". Lint and format clean.

## Confirmed by

P01 as Doty, 2026-10-19: the same search result opened "Fleet winter readiness, November 2026",
subject "Winter's coming: get your fleet checked early".

## Rating effect

—
