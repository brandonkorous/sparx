# 329 — Anyone could open a guest's orders by signing up with her email

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 9, a stranger follows "Track your order"
**Surface:** Gillett site › /account (sign up, sign in, orders, addresses, bookings); every site on the platform; `wizeworks/packages/customer-auth`, `wizeworks/services/api-rest`, `wizeworks/apps/site`, `wizeworks/packages/email`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as a stranger (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

Marisol Vega bought an injector as a guest (O-000034). Her order email's "Track your order" opened "Sign in", which asked for a password she never made. Nothing said a guest could make an account.

Making one showed the bigger fault. The account was made with her email and any password, and her order opened at once, with her home address. The sign-up never checked that the person typing owned the inbox (`email_verified = false`). Anyone who knew a buyer's email could do the same and read her orders, her addresses and her bookings. It held for every site on the platform, and for every record a business keeps under an email: guest orders, bookings, CRM imports.

## What should have happened

A record kept under an email is handed to an account only once the person shows they own that inbox. A guest who follows "Track your order" is told how to get to her orders.

## How to reproduce

1. As a guest, place an order with an email.
2. In another browser, open /account/login, Create account, with that email and any password.
3. Open Orders.

## Why it matters

It exposes a buyer's purchases and home address to a stranger who knows her email. That is a privacy breach, on every shop.

## Where it lives

- The rule: `wizeworks/packages/customer-auth/src/membership.ts` (`ensureMembership`, `AwaitingConfirmation`).
- The link: `customer-auth/src/server.ts` (`emailVerification`), `service.ts` (`sendCustomerEmailConfirmation`, `confirmCustomerEmail`, `emailVerified` on the session), `email.ts`, `store-url.ts` (`resolveStoreName`), `tenant-adapter.ts` (`withTenantEmailKey`).
- The email: `wizeworks/packages/email/src/templates/customer-email-confirm.tsx`, registered in `send.tsx`, `template-ids.ts`, `template-fixtures.ts`, the every-template test, `email-worker/src/template-schema.ts` and `events/src/types.ts`.
- The API: `wizeworks/services/api-rest/src/lib/customer-session.ts` (`emailUnconfirmed`), `routes/v1/public/account.ts` (register, login, session, `email/confirm`, `email/resend`).
- The site: `lib/customer-client.ts`, `components/customer-provider.tsx`, `components/auth-panel.tsx`, `components/confirm-email-notice.tsx` (new), `components/account/verify-email-form.tsx` (new), `components/account/account-auth.tsx` (`verify` mode), `app/account/verify/page.tsx` (new).

## The fix

- **The rule.** `ensureMembership` adopts a guest or imported record only for a login whose email is confirmed. An unconfirmed login on a site where a record waits under its email gets `awaitingConfirmation` and no membership there: it is treated as not signed in on that site. A sign-up with an email nobody used before still goes straight in, so a new shopper waits for nothing. A login already linked keeps its account. The site-less case (issue 152) follows the same rule. A connected assistant's token follows it too.
- **The link.** The customer auth instance now sends Better Auth's verification link as "Confirm your email for Gillett Diesel Service", from the business (`sendAs: 'tenant'`), landing on the shop's own `/account/verify`. The email says nothing is shared until the link is opened.
- **Better Auth could not save "confirmed".** It updates the user by email alone, and a shopper's email is unique per business, so every link failed with an error. The tenant adapter now spells that lookup as (business, email).
- **The API.** Sign-up and sign-in answer `customer: null, confirmEmail: { email }` and send the link. `/session` says the same. Routes that need a customer answer 403 with `reason: email_unconfirmed`, not "Session expired". New: `POST …/account/email/confirm { token }` and `POST …/account/email/resend`.
- **The site.** The sign-in panel shows "Check your email: we sent a link to …", with "Send the link again" and "Use a different email". It says nothing about what is kept, because the reader may not own the address. `/account/verify` opens the link and then "Your email is confirmed" with "Go to your account".
- **The guest's way in.** Arriving from "Track your order", the sign-in page says "Ordered without an account? Create one with the email you ordered with. We email you a link, and your orders join your account."
- **On a phone** the auth panel no longer pads itself a third time. Inside the page's and the shell's padding it left 216px for tabs that need 220px, so "Create account" was cut off on every phone sign-in. It fits at 320px and 360px now.

Tests: `customer-auth` `membership.test.ts` (5 new: not handed over before the link, nor a site-less record; a fresh membership at once with no record; an existing link kept; handed over after), red with the rule removed (2 fail); `tenant-adapter-email-key.test.ts` (4); `session-resolve.test.ts` updated. api-rest `customer-session-announce.test.ts` (1 new: nothing announced while waiting). Site `lib/confirm-email.test.ts` (5). Email: the new template renders, names no other company and uses no other brand's colors (292 pass). Suites: customer-auth 31, email 292, email-worker 95, site 53 files / 508 + 5, api-rest 530 in `lib` and the public and commerce routes. `tsc` clean on the site, customer-auth, email, email-worker, events, builder-schemas and silica-catalog. Not checked: the api-rest and commerce `tsc` (out of memory on this machine).

## Confirmed by

2026-10-18, in a headless browser on the Gillett site. Seamus O'Malley, a real Gillett customer with one order and no account: Create account with his email showed "Check your email. We sent a link to seamus.omalley@omalleyranch.test", and /account/orders showed the same notice, not his order. The dev outbox held "Confirm your email for Gillett Diesel Service", from "Gillett Diesel Service <noreply@sparx.email>". Opening its link: "Your email is confirmed. Your account is ready, with everything you did here before." Then Orders listed O-000013. The guest hint showed on /account/login reached from /account/orders, at 1280px and 360px, with no sideways scroll.

Left as it was: Marisol's account, made before the fix, keeps the order it was handed.

## Rating effect

The site's account rows under "Outside the console" in `rating.md` were scored on what a signed-in shopper sees. This removes a breach those scores did not know about; the scores themselves are unchanged.
