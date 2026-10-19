# 321 — Page titles were doubled, missing or wrong, and a reset link asked for a password it could not set

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · scoring the screens outside the console
**Surface:** Gillett site › Book and an unknown address; workbench › Sign in, Create account, Reset password; sparx console
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Doty and Renée (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

Scoring the screens outside the console found four title faults and one dead form:

- **Book a service** had two page titles: the shop's own "Book your truck in" and the booking list's "Book with us". The page made the list the title whatever the published page already held.
- **An unknown address** on the site showed "We couldn’t find that page" under a tab that read only "Gillett Diesel Service".
- **Sign in, Create account and Reset password** had no page title at all: each view's heading was an `h2`.
- **Reset password opened with no code** (a link cut short by a mail client, or the bare address) showed the full "Set a new password" form. It asked for the password twice and only then said "This reset link is invalid or has expired". The invite page already says so up front.

## What should have happened

One page title per page, a tab that says what the page is, and a reset page that says at once when its link is incomplete.

## How to reproduce

1. Open the site's /book and count the h1s.
2. Open /no-such-page on the site and read the tab.
3. Open the console's /reset-password with no ?token.

## Why it matters

A page title is how a screen reader and a search engine know what a page is. A form that cannot work wastes a locked-out owner's time at the worst moment.

## Where it lives

`wizeworks/apps/site/app/book/page.tsx`, `app/products/page.tsx`, `app/[...slug]/page.tsx`, `lib/shell-page-title.ts` (new); `sparx/apps/workbench/app/reset-password/`, `components/auth/auth-wrapper.tsx`.

## The fix

- `shellHasPageTitle(root)` reads whether the published page already holds an `h1`. The booking list and the product listing are the page title only when it does not.
- The catch-all route answers an unknown address with "Page not found" (and noindex), as `app/not-found.tsx` does.
- The reset page reads the code on the server. With none it says "This reset link is incomplete … Go to sign in, choose “Forgot password?” and we will email you a new link."
- The nine auth view headings are `h1`, with their classes unchanged.

Tests: `lib/shell-page-title.test.ts` (3; red when it looks for the wrong tag). The site suite passes (52 files). The auth heading and reset changes have no test of their own; the auth tests pass (2).

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

2026-10-18. The site's /book has one h1, "Book your truck in"; /products and /shop keep theirs ("All products", "Shop"). An unknown address reads "Page not found · Gillett Diesel Service" in the tab; /about keeps its own title. Fetched signed out, /sign-in, /sign-up and /reset-password each have one h1 ("Welcome back", "Start your story", "This reset link is incomplete"). /reset-password?token=abc123 still shows the form.

## Rating effect

See the screen's row under "Outside the console" in `rating.md`.
