# 047 — The editor showed a made-up phone number on his Contact page

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Editor › Contact page (any page bound to his contact details)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2: the editor's Contact page now shows (801) 571-7780, contact@gillettdiesel.com and 14812 Heritagecrest Way, Bluffdale, UT 84065, the same as the live page
**Blocked on:** —

## What happened

Doty opened his Contact page in the editor. It said "Call us (555) 123-4567",
"hello@yourbusiness.com", "123 Main Street, Portland, OR 97204". The live page
showed his real details. The obvious next move is to type his number over the
sample, which would cut the page loose from Business details.

## What should have happened

The editor shows what visitors see.

## Where it lives

`surfaces/builder/studio/data.ts` `useSitePreview` already fetched the public
tenant payload, which carries `contact`, and dropped it: fetched, never drawn. An
unresolved binding falls back to the design's sample words. Piggles fixed the
same gap earlier; sparx never got the port, and no parity check covered it.

## The fix

Ported from Piggles: `SiteIdentityPreview` gains `phone`, `email`, `address`,
`phoneHref`, `emailHref` (`preview-data.ts`), filled from `payload.contact` with
the live site's `telHref` and `null`-not-empty rules (`data.ts`).

Checks: workbench tsc 0.

## Rating effect

Editor: Ease deduction removed for the Contact page.
