# 337 — "Send the link again" said "on its way" and sent nothing

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9, checking issue 327 on an empty business
**Surface:** console › "Confirm your email address" notice; the invitation and sign-in app's resend (both brands); the site's shopper confirm link; `wizeworks/packages/auth`, `wizeworks/packages/customer-auth`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Ines Varga (Quiet Bench Repair), 2026-10-18
**Blocked on:** —

## What happened

Ines Varga had never confirmed her email, so sparx would not let her connect payments. She pressed "Send the link again". The notice said "A new link is on its way to p01.emptycheck@sparx.test. Open that email and press the link." Nothing reached the email worker, and no email was sent.

Two causes:

1. The sparx console's local settings had no `EVENT_BROKER`, so every event it published was discarded. Piggles' sign-in app had the lines; the sparx console did not.
2. `publishAuthEmail` refuses to pretend in exactly that case, and throws. But Better Auth runs the send through `runInBackgroundOrAwait`, which catches what the callback throws and only logs it. The refusal never reached the button, so the console promised a delivery it knew would not happen.

The shopper confirm link from issue 329 has the same shape, so it had the same trap.

## What should have happened

A link is said to be on its way only when it can leave. Otherwise the screen says it could not be sent.

## How to reproduce

1. Run a console with no `EVENT_BROKER`.
2. As an owner who has not confirmed her email, press "Send the link again".

## Why it matters

An owner locked out of payments until she confirms is told to wait for an email that is never coming.

## Where it lives

- `wizeworks/packages/auth/src/email-events.ts` (`authEmailsCanLeave`), `index.ts`.
- `sparx/apps/workbench/app/verify-email/actions.ts`, `app/accept-invite/actions.ts`; `piggles/apps/account/app/verify-email/actions.ts`, `app/accept-invite/actions.ts`.
- `wizeworks/packages/customer-auth/src/email.ts` (`customerAuthEmailsCanLeave`), `service.ts`, `errors.ts` (`EMAIL_UNAVAILABLE`); `wizeworks/services/api-rest/src/routes/v1/public/account.ts`; `wizeworks/apps/site/components/confirm-email-notice.tsx`, `customer-provider.tsx`, `auth-panel.tsx`, `lib/customer-client.ts`.
- `sparx/apps/workbench/.env.example` (and the local `.env`).

## The fix

- **Ask before promising.** `authEmailsCanLeave()` says whether this process's publisher discards. The four places that call Better Auth's `sendVerificationEmail` (the console's confirm link and invitation resend, in both brands) ask it first and say "Email cannot be sent from here right now, so no link went. Nothing changed."
- **The shopper side.** `sendCustomerEmailConfirmation` refuses the same way. Sign-up answers `confirmEmail: { email, sent }`, and the site says "We could not send the link. Your account is made, and it needs a link sent to … to finish. Press Send the link again in a minute." instead of "Check your email". The resend route answers that it could not send.
- **The setting.** `sparx/apps/workbench/.env.example` now carries the broker, as Piggles' sign-in app already did, and the local `.env` has the same three lines.

Tests: `wizeworks/packages/auth/src/auth-emails-can-leave.test.ts` (2: no with a discarding transport, yes with a broker). Site `lib/confirm-email.test.ts` updated. auth 28 + 2, customer-auth 31, site 518; `tsc` clean on auth, customer-auth and the site.

## Confirmed by

The shopper side: issue 329's run, where the link was sent and the API's broker is set.

The console side, 2026-10-18, after the console restarted with the new `.env`. As Ines, on sparx Pay, "Send the link again" answered "A new link is on its way to p01.emptycheck@sparx.test. Open that email and press the link. It works for an hour." The dev outbox received "Confirm your sparx email" from "sparx <noreply@sparx.email>" 0.4 seconds later. Its link opened "Your email address is confirmed", and the notice was gone from the console.

## Rating effect

None to the scores.
