# 338 — Signing in on the site said "Signing in…" for good

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 178 (a card-paid return), as Marisol Vega on the Gillett site
**Surface:** the site › Sign in, and Create account when no confirm link is needed (`wizeworks/apps/site/components/auth-panel.tsx`)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Marisol Vega, 2026-10-18
**Blocked on:** —

## What happened

Marisol Vega bought an injector by card (O-000034) and made an account. She came back
to send it back. She typed her email and password on the Gillett site's sign-in page and
pressed "Sign in". The button changed to "Signing in…" and stayed so. After three minutes
the page was still the sign-in page.

The sign-in had worked. The API answered 200 with her account, and her session was set.
Opening `/account` by hand showed "Hi, Marisol" and her order. It also failed with
`redirect=/account/orders`, the link an order email sends.

## What should have happened

She presses "Sign in" and her account opens, or the page the link was going to.

## How to reproduce

1. Open `http://localhost:3004/account/login?tenant=gillettdiesel`.
2. Sign in with a site account that needs no confirm link.
3. The button says "Signing in…" and the page never changes. Every time.

## Why it matters

Nobody can sign in to a shop's site through its own form. A customer who comes back to
send a part back, track an order or pay an invoice is stuck at the door, and the shop
never hears why.

## Where it lives

`wizeworks/apps/site/components/auth-panel.tsx`. After a good sign-in, three moves
started at once:

- the signed-in effect (issue 189): `router.replace(alreadyIn)`, because `status` turned
  `authenticated`;
- `submit`: `router.push(redirectTo)`;
- `submit`: `router.refresh()`, which reloads the page it is on: the sign-in page.

The reload finished last and won. The page stayed on sign-in, and the effect does not
run again, because its destination did not change. The button stayed busy.

## The fix

One place moves anybody on: the signed-in effect. `submit` no longer pushes or reloads.
A good sign-in sets `status`, and the effect sends the person on. Nothing above the
account pages reads the session on the server (the root layout reads the theme cookie
only, and the account area checks the session in the browser), so the reload was doing
nothing but cancel the move.

Test, red first: `wizeworks/apps/site/lib/auth-redirect.test.ts`, "the sign-in form moves
a person on from one place only", reads the form. It fails on any `router.push` beside
the effect's `router.replace`, and on any `router.refresh`. Red against the old form
(it found `push` and `replace`), green after. Site lint and format clean on both files.

## Confirmed by

P01 on screen as Marisol Vega, 2026-10-18. Sign in from
`/account/login?tenant=gillettdiesel`: on `/account` in 2.2 seconds, "Hi, Marisol". From
`/account/login?tenant=gillettdiesel&redirect=%2Faccount%2Forders`: on `/account/orders`
in 2.2 seconds. The header reads "Marisol" both times.

## Rating effect

—
