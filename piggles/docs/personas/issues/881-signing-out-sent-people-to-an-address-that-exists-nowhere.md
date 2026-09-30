# 881 — Signing out sent people to an address that exists nowhere

**Status:** fixed
**Severity:** **major in production, invisible in development** — the sign-out
route built its redirect from the address the server is BOUND to, which in a
pod is `0.0.0.0:3000`. On a laptop that is the same machine, so it works. In
production it is a redirect to nothing
**Found by:** P03 · act 313, signing out to test an invitation
**Surface:** getpiggles › Your account › Sign out
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** the helper that documents this exact failure, applied; plus
typecheck and lint on the changed file

## The line

```ts
const response = NextResponse.redirect(new URL('/sign-in', request.url), 303);
```

And one directory away, `lib/same-origin-redirect.ts`, whose entire header is
about that line:

> _"The obvious spelling is `NextResponse.redirect(new URL('/sign-in',
> request.url))`, and it shipped, and it sent every visitor to
> `https://0.0.0.0:3000/sign-in?next=%2Fhandoff`. `request.url` is built from
> the address the server is BOUND to, and a pod binds to `HOSTNAME=0.0.0.0` on
> `PORT=3000`. Behind Caddy that is invisible in development and total in
> production: getpiggles.com answered, correctly, with a redirect to an address
> that exists nowhere. **Nothing logged an error** — a 307 is a success, and the
> failure happened in the browser afterwards."_

The helper was written, the handoff route was moved onto it, and the sign-out
route was not. It is the last one in the repository that still spelled it the
broken way. [[feedback_a_fix_leaves_its_neighbour_behind]]

## Measured

```
NextResponse.redirect(new URL(…)) in piggles      2
  · sign-out/route.ts             request.url     THE BUG
  · oauth/consent/submit/route.ts authOrigin()    correct: cross-origin, from configuration
```

One hit. The other is the sanctioned form: a cross-origin redirect names another
host, so it has to be absolute and it has to come from configuration, which is
what `authOrigin()` is.

## What it does now

`sameOriginRedirect('/sign-in', 303)`, which sets a bare relative `Location`.
That is valid HTTP (RFC 7231 §7.1.2), every browser resolves it against the URL
it actually requested, and it is therefore right behind any proxy, on any
hostname, in every environment, with no variable to set and none to get wrong.

The `Set-Cookie` headers Better Auth returns are still copied onto it
unchanged — clearing the cookie correctly is the other half of this route's job
and was never the broken half.

## Why it was not caught

Three things at once, and each one alone would have been enough:

1. **Development cannot see it.** The bind address and the public address are
   the same machine on a laptop, so the redirect resolves correctly every time
   anyone tests it.
2. **A 307 is a success.** Nothing logs, nothing retries, nothing alerts. The
   failure is entirely in the browser, after the server considers the request
   finished.
3. **Sign-out is the one flow nobody re-tests.** It is the last thing a person
   does, so a broken landing page reads as "I signed out" rather than as a
   fault.

## Files

- `piggles/apps/account/app/sign-out/route.ts`

## The thing to remember

**A helper written to stop a bug does not stop it anywhere it was not applied.**
The comment explaining the failure was three directories from the file still
committing it, and it had been there for months.

When a fix comes with a helper, the fix is not done until every caller of the
old spelling has moved. Grep for the BROKEN form, not the helper — the helper
tells you who already knows, and the point is to find who does not.
