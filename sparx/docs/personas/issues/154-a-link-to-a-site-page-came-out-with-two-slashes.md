# 154 — A link to a site page came out with two slashes

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Email designs › Preview & check; every email sent
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

Doty pointed his email's button at his booking page the obvious way: `{{site.url}}/book`. "Preview & check" said "Ready to send: every check passed", and the plain-text copy read:

> Book a winter check <https://gillettdiesel.sparx.zone//book?utm_source=…>

`{{site.url}}` is the site's home with a trailing slash (`siteUrl` in `@wizeworks/db/site-origin`, on purpose, "so a mail client never has to guess"). Anything an owner writes after it starts with its own slash.

## What should have happened

`{{site.url}}/book` sends `https://gillettdiesel.sparx.zone/book`.

## Why it matters

A doubled slash is the address the customer taps. Many servers treat it as a different page. To a careful reader it also looks like a broken link in an email from their supplier. The check that says "every check passed" did not notice.

## Where it lives

`wizeworks/packages/email/src/silica/render-silica-email.ts`, step 3 and step 4: the tokens are filled into hrefs and the plain text, and nothing tidies the join.

## The fix

`joinSiteSlashes` in `wizeworks/packages/email/src/silica/render-silica-email.ts` runs on the HTML and on the plain text, right after the tokens are filled in. It joins the slashes straight after a host into one (`https://host//book` to `https://host/book`). A doubled slash further down a path is left alone. Every send goes through `renderSilicaEmail`. The only other token filler, `sampleEmailText`, glosses the old canvas and sends nothing.

Test, proved red: `wizeworks/packages/email/src/silica/__tests__/site-links-join.test.ts`. `{{site.url}}/book` with a home of `https://gillettdiesel.test/` has one slash in the HTML and in the text, and `https://example.test/a//b` is kept. Against the renderer before the fix, 2 of its 3 tests fail. Email package: 274 tests pass, typecheck clean.

## Confirmed by

P01 on screen, 2026-10-08. Email designs › "Fleet winter readiness, November 2026" › Preview & check › Plain text: "Book a winter check <https://gillettdiesel.sparx.zone/book?utm_source=…>". The booking page answers at /book on Gillett's site.

## Rating effect

—
