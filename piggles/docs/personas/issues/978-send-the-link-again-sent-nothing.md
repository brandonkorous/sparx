# 978 — "Send the link again" sent nothing

**Status:** fixed
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 10 (before the real send)
**Surface:** mypiggles › the yellow "Confirm your email address" band › getpiggles › Confirm your email
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P09, 2026-10-11, one press on the band
**Blocked on:** —

## What happened

Rosalind's address is not confirmed, so the band says Piggles cannot send to a whole
audience until she confirms it. Its button says **Send the link again**. Pressing it
opened getpiggles' "Confirm your email address" page, which asked her to press **Send a
new link**. Nothing was sent by the first press.

## Why

The sign-in system lives on getpiggles, another site, so the console's band can only
open that page (`components/verify-email-band.tsx`). The page then waited for a second
press. In sparx the same button sends in place.

## The fix

- The band opens `/verify-email?send=1`.
- `account/lib/verify-email-landing.ts` `sendsOnArrival`: a signed-in owner whose address
  is not confirmed, arriving with `send=1`, gets a link straight away. Never for a
  signed-out visitor or a confirmed address.
- `account/app/verify-email/verify-email-result.tsx` sends once on arrival (a ref holds
  through the dev double mount) and takes `send=1` out of the address, so a reload sends
  nothing.

Test `workbench/lib/verify-email-lands-on-a-page.test.ts`, 4 pass; the band test went
red with the plain address put back. Lint clean; account typecheck clean.

## Confirmed by

P09 on screen, 2026-10-11, as Rosalind: one press on **Send the link again** opened the
page reading "A new link is on its way to p09.rosalind@piggles.test. Open that email and
press the link. It works for an hour.", with the address back to `/verify-email`.
