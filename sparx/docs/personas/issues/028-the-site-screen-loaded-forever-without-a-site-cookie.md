# 028 — The Site screen loaded forever for a business that never switched sites

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Site (identity: name, logo, favicon, contact, socials), and 7 more screens
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — Site identity opened, logo, favicon, contact and socials saved
**Blocked on:** —

## What happened

Doty searched "logo" and opened **Site**. It said **Loading…** and never stopped.
No error, no retry: the screen where a business sets its logo could not be opened.

## Why it matters

Every business with one site never opens the site switcher, so it never has the
active-site cookie. For all of them, the logo, favicon, tagline, contact details
and social links could not be set from the screen that owns them.

## Where it lives

`surfaces/builder/site-identity.tsx` waited for `useActiveSiteId().propertyId`,
the raw cookie value, which is null when there is no cookie. The shared
`useActivePropertyId()` already answers "no cookie means the primary site", and
its comment records the same failure on the campaign form. Fourteen screens still
read the raw value: six re-derived the primary by hand; eight did not and were
dead or wrong without a cookie — Site identity (forever loading), the site
designer, the email editor's "version for this site", product detail, product
overview and product SEO site scope, the site picker field, and the customer
message composer.

It showed up now because issue 011 stopped forwarding another company's stale
cookie; before that, this browser always had _some_ cookie.

## The fix

- All fourteen read `useActivePropertyId()` (one rule, one place). Script edit,
  diff read back line by line: only the declaration, the import and the reads
  changed.
- `lib/api/active-site-readers.test.ts` (both consoles): fails if any file outside
  the shell reads `useActiveSiteId()`. Adding one raw read back turns it red.
  Piggles already had none; its shell's boot file is the allowed reader there.

## Confirmed by

> Re-ran P01 act 2: Site opened on "Site identity" with "Gillett Diesel Service";
> set tagline "Diesel Done Right Since 1986!", logo (banner), dark logo (white),
> favicon, contact, four social links; saved. The live site shows the logo and
> favicon about 20 seconds later.

Checks: sparx workbench tsc 0; eslint 0; prettier clean; guard tests 1/1 in each
console; `check:console-parity` green.

## Rating effect

—
