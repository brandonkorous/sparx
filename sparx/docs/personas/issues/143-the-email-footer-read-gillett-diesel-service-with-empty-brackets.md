# 143 — The email footer read "Gillett Diesel Service ()" and "&middot;"

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (reading Renée's overdue reminder)
**Surface:** the branded footer on every email; the plain-text copy of every email
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

The overdue reminder for 4459, rebuilt with the same code the sender used, ends:

> Gillett Diesel Service ()
> Your account (https://gillettdiesel.sparx.zone/account?…) &middot; Privacy Policy (…) &middot; Terms of Service (…)

Two defects in the frame sparx puts round every email:

1. The business name links to the site's home page through `{{site.url}}`. The data for a send is looked up from what the email's BODY mentions. The overdue notice's body never names the site, so the address was never looked up: the name links nowhere in the HTML email, and the text copy prints empty brackets.
2. The frame separates its footer links with `&middot;`. The plain-text converter knew six entities and not that one, so every plain-text copy prints it raw.

## What should have happened

The name links home on every email, and the text copy reads "Your account (…) · Privacy Policy (…)".

## Why it matters

Every email whose body does not mention the site has a dead link on the business's name. The plain-text copy (what a text-only reader, a watch and many previews show) of every email has HTML code in it.

## Where it lives

- `wizeworks/packages/email/src/silica/frame.ts`: `{{site.url}}` on the name; `&middot;` between links.
- `wizeworks/services/api-rest/src/lib/email-data.ts`: `resolveSilicaEmailData` looks up only what the body names.
- `wizeworks/packages/email/src/silica/to-text.ts`: `decodeEntities`.

## The fix

- `email/src/silica/frame.ts`: the frame names its own tokens in one place, `EMAIL_FRAME_TOKENS` (today `{{site.url}}`), exported from `@wizeworks/email/silica`.
- `api-rest/src/lib/email-data.ts`, `resolveSilicaEmailData`: every send's data lookup adds the frame's tokens to what the body names. Every send path (the dispatch tick, a direct send, a broadcast) resolves through it.
- `email/src/silica/to-text.ts`: the plain-text converter decodes the named entities the platform writes (`&middot;`, `&rsquo;`, `&mdash;`, …) and any numeric one.

Tests, proved red:

- `email/src/silica/__tests__/frame-reads-right.test.ts` (4): the text copy separates footer links with "·" and has no entity left; the name reads "Gillett Diesel Service (https://…)" once the site is looked up; numeric entities decode; every token the frame writes is declared. With the old converter 2 fail; with the token list empty 1 fails.
- `api-rest/test/integration/email-data.test.ts`, "looks up the site for the frame even when the body never names it": the overdue notice's body has no `{{site.`, and its data has the site's address. Without the frame tokens it fails.

## Confirmed by

Renée's 4459 reminder, rebuilt with the sending code after the fix: "Gillett Diesel Service (https://gillettdiesel.sparx.zone/…)" and "Your account (…) · Privacy Policy (…) · Terms of Service (…)".

## Rating effect

—
