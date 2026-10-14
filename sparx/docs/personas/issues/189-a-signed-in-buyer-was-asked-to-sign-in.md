# 189 — A signed-in buyer was asked to sign in again

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › /account/login and /account/register
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Teodora Vukić-Hale was signed in on the Gillett site (her name was in the account
sidebar a moment before). She opened the sign-in page, as anyone does from an old
bookmark, a "Sign in" link in an email, or the browser's Back button after signing in.
It showed the empty sign-in form, as if she were signed out.

## What should have happened

A signed-in buyer goes on to where the link was taking them (its `redirect`), or to
their account.

## How to reproduce

1. Sign in on the site.
2. Open `/account/login`. Every time.

## Where it lives

`wizeworks/apps/site/components/auth-panel.tsx`: the form never asks whether someone is
already signed in; the customer provider already knows (`status`).

## The fix

`wizeworks/apps/site/lib/auth-redirect.ts` `signedInDestination(status, redirect)`: a
confirmed session goes on to the link's `redirect`, or to the account; a path on this
site only, so a crafted `redirect` cannot send anyone elsewhere. `components/auth-panel.tsx`
(the sign-in and create-account form) asks it and moves on, and its after-sign-in
redirect now goes through the same rule. "Loading" and "unreachable" still show the
form. Test `lib/auth-redirect.test.ts` (5), wiring red first; site 444 pass; lint clean.

## Confirmed by

P01 on screen, 2026-10-09, as Teodora: signed in, `/account/login?redirect=/account/b2b`
went straight to her Wasatch Front page. Signed out, `/account/login` showed the form and
stayed.

## Rating effect

—
