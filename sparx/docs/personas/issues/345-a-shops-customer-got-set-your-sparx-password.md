# 345 — A shop's customer got "Set your sparx password"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 promise 11, as Renée Castañeda on the Gillett site
**Surface:** the site › Sign in › Forgot your password?, and the email it sends (`wizeworks/packages/customer-auth/src/server.ts`)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen and in the dev outbox as Renée Castañeda, 2026-10-18
**Blocked on:** —

## What happened

Renée could not sign in to Gillett's site, so she pressed "Forgot your password?". The email
came from "sparx <noreply@sparx.email>", with the subject "Set your sparx password". It said
"Use the button below to set a password for your sparx account", "You're receiving this
because a password reset was requested for your sparx account", and ended "WizeWorks, Inc.".
Only the link went to Gillett's site.

Renée buys parts from Gillett. She has never heard of sparx.

## What should have happened

The email is Gillett's, like the confirm email beside it: from Gillett Diesel Service, about
her account at Gillett Diesel Service.

## How to reproduce

1. On a shop's site, press "Forgot your password?" and give a customer's email.
2. Open the email. It is sparx's staff email. Every time, on every shop.

## Why it matters

A customer who gets "Set your sparx password" from a company she never dealt with deletes it
as phishing, and is locked out of the shop. A shop's site must never speak as sparx.

## Where it lives

`sendResetPassword` in `wizeworks/packages/customer-auth/src/server.ts` published the staff
template `password-reset` (the platform's own account email). The confirm email next to it
(issue 329) has its own shopper template, `customer-email-confirm`, sent as the tenant.

## The fix

A shopper template of its own, `customer-password-reset`
(`wizeworks/packages/email/src/templates/customer-password-reset.tsx`): the shop's layout,
"Set your password for <site>", "Someone asked to set a new password for your account at
<site>". `sendResetPassword` sends it with the site's name and the customer's first name, and
`publishCustomerAuthEmail` sends both shopper emails as the tenant. Wired as the confirm
template is: the template id list, the send switch, the worker's schema, the event type, the
fixture.

Test, red first: `email/src/__tests__/every-template.test.ts` counts 44 templates and lists
`customer-password-reset` among the emails a shop writes to its own customer, which renders
it with the shop's identity and no WizeWorks fine print. Red before the template existed
("expected 43 to be 44"), green after. Email 295, email-worker 97 and customer-auth 31 pass.
Lint and format clean.

## Confirmed by

P01 as Renée Castañeda, 2026-10-18. "Forgot your password?" on the Gillett site; the email in
the dev outbox: from "Gillett Diesel Service <noreply@sparx.email>", subject "Set your password
for Gillett Diesel Service", "Hi Renée, Someone asked to set a new password for your account at
Gillett Diesel Service.", button "Set my password", signed "Gillett Diesel Service · Sent with
sparx". The link set her password and she signed in with it.

## Rating effect

—
