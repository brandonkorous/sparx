# 346 — A new password said so for one and a half seconds

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 5 promise 11, as Renée Castañeda on the Gillett site
**Surface:** the site › Set a new password (`wizeworks/apps/site/components/reset-form.tsx`)
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** P01 on screen as Renée Castañeda, 2026-10-18
**Blocked on:** —

## What happened

Renée opened the reset link, typed her new password twice and pressed "Set new password". A
grey line said "Your password has been reset. Redirecting you to sign in…", and 1.5 seconds
later the page was the sign-in page, which said nothing about a new password.

## What should have happened

The page says the password is set, in a color that says it worked, and stays until she
moves on.

## How to reproduce

1. Reset a password on a shop's site.
2. Look away for two seconds. The sign-in page gives no sign that anything changed.

## Why it matters

A customer who missed the line does not know whether it worked, and asks for another link.
The grey line was also `color="neutral"`, which a success is not (RULE #4).

## Where it lives

`ResetForm`, `state === 'done'`: a neutral alert and `setTimeout(() => router.push(...), 1500)`.

## The fix

A success alert, "Your new password is set. Sign in with it now.", and a "Sign in" button.
No timer.

No new test: the site tests rules in `lib/`, not React (its `vitest.config.mjs` says why), and
this is a screen. Lint and format clean.

## Confirmed by

P01 as Renée Castañeda, 2026-10-18: after "Set new password" the page read "Your new password
is set. Sign in with it now." and still did six seconds later; "Sign in" opened the sign-in
page, and she signed in with the new password.

## Rating effect

—
