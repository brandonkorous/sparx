# 157 — An unconfirmed owner could not send, and had nowhere to confirm

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Write an email › Send now; the console shell; the email confirmation link
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx end to end; Piggles landing page only)
**Blocked on:** —

## What happened

Doty pressed "Send now" on "Fleet winter readiness, November 2026" to his 6 fleet contacts. The composer's "still needs" list was empty and the button was on. The server refused:

> That didn't go through. Confirm your email address to use this feature. Check your inbox, or resend the link from the dashboard.

- `p01.doty@gillettdiesel.test` has never been confirmed (`users.email_verified = false`). His three staff are confirmed.
- There is no "dashboard". The old console that had the "confirm your email" banner and its resend button was removed. The workbench has no banner and no resend control anywhere.
- The link in the confirmation email (sent once, at sign-up) returns to `/verify-email`. The workbench has no such page, so after the link confirms the address, the owner lands on "That link doesn't open anything. Nothing in sparx lives at "/verify-email"". A successful confirmation reads as a broken link.
- The same refusal guards publishing the site, buying a domain and other tenant actions (`requireVerifiedEmail` in `wizeworks/services/api-rest/src/lib/verified-email-guard.ts`), once onboarding is finished.

## What should have happened

An owner whose address is not confirmed sees it in the console, with a button that sends the link again. The link lands on a page that says the address is confirmed (or, for an expired link, says so and offers a new one). The refusal names a place that exists.

## Why it matters

Every owner who missed or lost that one email is locked out of sending newsletters, publishing changes and buying a domain, with no way back in from the screens. The code still says "the user can resend from the dashboard banner" (`wizeworks/packages/auth/src/sign-up.ts`).

## Where it lives

- `wizeworks/services/api-rest/src/lib/verified-email-guard.ts`: the message.
- `wizeworks/packages/auth/src/sign-up.ts`: sends the link with `callbackURL: '/verify-email'`.
- `sparx/apps/workbench`: no banner, no resend, no `/verify-email` page.
- Piggles has the same gap. Owners sign up on getpiggles.com (the account app, which hosts the sign-in system), the link lands on `/verify-email` there, and that app had no such page (a 404). The console on mypiggles.com had no band and cannot send the link itself, because it mounts no sign-in handler. A Piggles owner hits the same refusals for a list send, a domain purchase and connecting payments.

## The fix

sparx console (`sparx/apps/workbench`):

- `/api/token` now also carries the signed-in `email` and `emailVerified` (repeated in plain form like `userId` and `role`, never a control). `useViewer` returns them.
- `components/verify-email-banner.tsx`, mounted in both shells under the billing banner: "Confirm your email address. We sent a link to … when you signed up. Until you press it, sparx can’t send an email to a whole audience for you, buy a domain, or connect payments." Its "Send the link again" calls `sendConfirmLink` (`app/verify-email/actions.ts`, Better Auth's `sendVerificationEmail` in this process), then says where the link went. Not dismissible.
- `app/verify-email/page.tsx`: the page the link lands on. Confirmed (read from the session, not from the URL), it says so and offers "Go to your console". An expired or broken link (`?error=TOKEN_EXPIRED`, `INVALID_TOKEN`, …) says which, and offers "Send a new link".
- Words in `lib/verify-email/words.ts`.

Piggles:

- Console (`piggles/apps/workbench`): `/api/token` and `useViewer` carry the same two facts; `components/verify-email-band.tsx` sits beside the lifecycle band in both shells. Its "Send the link again" is a door to getpiggles.com's `/verify-email`, which owns sending.
- Account app (`piggles/apps/account`): `app/verify-email/` page, screen and `sendConfirmLink` action, words in `lib/verify-email-landing.ts`. Signed out, it offers "Sign in to ask for a new link".

Shared:

- `VERIFY_EMAIL_MESSAGE` (api-rest) now reads: "Confirm your email address to use this. We sent you a link when you signed up. For a new one, press “Send the link again” at the top of your console."
- The two comments in `wizeworks/packages/auth` that promised "the dashboard banner" now name the console notice.

Tests, proved red:

- `sparx/apps/workbench/lib/verify-email/link-lands-on-a-page.test.ts`: the `callbackURL` sign-up sends has a `page.tsx` in this console. Red before the page existed.
- `piggles/apps/workbench/lib/verify-email-lands-on-a-page.test.ts`: the same for the Piggles account app, read from its files (the account app has no test runner). Red with the page moved away.
- `wizeworks/services/api-rest/src/lib/verified-email-guard-words.test.ts`: the refusal does not say "dashboard" and names "Send the link again". Red on the old message.
- Words: `lib/verify-email/words.test.ts` (sparx) and `lib/verify-email-words.test.ts` (Piggles console): the notice shows only for an unconfirmed owner and names the address; the landing page says "confirmed" only when the session does. These are new words, so they have no red of their own.

Typecheck clean in the sparx console, the Piggles console, the Piggles account app, `@wizeworks/auth` and api-rest. Lint clean on every file.

## Confirmed by

P01 on screen, 2026-10-08, as Doty:

- The console shows the notice across the top, naming p01.doty@gillettdiesel.test, with "Send the link again".
- `/verify-email` before confirming reads "Confirm your email address", and "Send a new link" answered "A new link is on its way to p01.doty@gillettdiesel.test…".
- The link itself prints only to the event-worker's terminal, so it was rebuilt on localhost from the dev secret with Better Auth's own `createEmailVerificationToken`, and opened. It landed on "Your email address is confirmed". `users.email_verified` is now true, and the console notice is gone.
- "Send now" then went through: "Fleet winter readiness, November 2026" was sent to Fleet customers, 6 people, and all 6 `email_scheduled_sends` rows read `sent`.

Piggles, on screen: getpiggles.com's `/verify-email?error=TOKEN_EXPIRED` reads "That link has expired." with "Send a new link". Not checked on screen: the Piggles console band, and a Piggles link confirming end to end. There is no Piggles test owner of this run to sign in as, and the browser held another persona's session, so nothing was sent from it.

## Rating effect

—
