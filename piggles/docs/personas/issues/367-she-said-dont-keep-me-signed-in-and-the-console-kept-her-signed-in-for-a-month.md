# 367 — She said "don't keep me signed in" and the console kept her signed in for a month

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · working the register (FOLLOW_UPS #6)
**Surface:** getpiggles.com › Sign in › Keep me signed in — and what mypiggles.com does with it
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** driving both routes with the cookies of a person who unticked the box, against the running stack

## What happened

The sign-in form asks a plain question, and it is the only privacy control on
the screen:

> ☐ Keep me signed in

Untick it and getpiggles.com does exactly what it says: the cookie it writes has
no expiry date, so the browser throws it away when it closes.

Then the handoff carries her to mypiggles.com, which writes its own cookie,
because three registrable domains cannot share one. That cookie was set to last
**thirty days**, for everybody, whatever she had ticked.

So the box worked on the sign-up-and-billing site and was discarded on the one
that runs her business. On a borrowed laptop, in a shared back office, at the
library: she says don't remember me, the screen agrees, and the console remembers
her for a month.

## Why it happened

The console has no sign-in form — by design, and that is the whole point of the
three-domain split. It never saw the checkbox. So `session-cookie.ts` asked
Better Auth for the cookie's attributes and used what it got:

```ts
const { sessionToken: cookie } = getCookies(auth.options);
// …
...(attributes.maxAge === undefined ? {} : { maxAge: attributes.maxAge }),
```

Asking the library for its own answer is the right instinct and it is why the
prefix, the `__Secure-` handling and SameSite have all stayed correct through
config changes. But `getCookies` is not the function that decides this one:

```ts
const sessionToken = createCookie('session_token', {
  maxAge: options.session?.expiresIn || sec('7d'),
});
```

That is unconditional. The function that decides is `setSessionCookie`, and it
overrides the attribute every time it writes:

```ts
const maxAge = dontRememberMe ? undefined : ctx.context.sessionConfig.expiresIn;
```

The console never called that function, so it never applied the override — and
`session.expiresIn` here is thirty days. The attribute is the default for a
remembered session, not the answer for this one.

**The register had this backwards**, and that is worth recording. Item 6 read:
"that route passes no `maxAge`, so the console's cookie is a browser-session
cookie whatever the customer chose", with the cost given as one extra redirect
after a browser restart. Every clause of that is wrong in the same direction —
the cookie was persistent, not session-scoped; the choice ignored was "no" rather
than "yes"; and the cost was a month of standing access rather than a redirect.
It was filed as a mild defect on the strength of it. The note also said "the
helper already accepts `maxAge`; nothing passes one", and the helper had no such
parameter. A diagnosis written from memory instead of from the file, carried for
weeks because nobody re-opened either.

## The fix

**The choice travels with the token.** It has to: mypiggles has no way to know
it, and the thing that knows it is a cookie on the other domain.

- **`readsAsRemembered()`** reads Better Auth's own `dont_remember` cookie, which
  is where the answer already lives. Not a value plumbed down from the sign-in
  form — the handoff route runs on every crossing, which may be days later and is
  never the request that ticked the box. Both the plain and `__Secure-` spellings
  are checked, because dev is HTTP and production is not.
- **`mintHandoffUrl({ remember })`** carries it in the one-time payload, and
  `consumeHandoffToken` hands it back. Absent means a token minted by a build
  that predates the field, which can outlive a deploy by 60 seconds; that
  defaults to `true`, the behavior that build had.
- **`handoffCookies(token, remember)`** omits `maxAge` entirely when she said no.
  Omitted, not zero: zero DELETES a cookie, and the two are one keystroke apart.

**And it sets the `dont_remember` marker on the console's own domain**, which is
the half that is easy to miss. Better Auth refreshes the session cookie every
`updateAge` and reads `dontRememberMe` back off that cookie when it does. Without
the marker, the first refresh on mypiggles would quietly restore the thirty days
— a fix that works once and then undoes itself.

Signing out clears both. Leaving the marker behind would carry one person's
answer into the next person's sign-in on the same browser, which is the
shared-computer case the checkbox exists for.

**This survives two-factor**, which matters because the persona has it on. The
2FA hook calls `deleteSessionCookie(ctx, true)` — the `true` is
`skipDontRememberMe` — so the marker written by the password step is deliberately
preserved, and `verifyTwoFactor` reads it back before creating the real session.
The answer she gave before the code is still her answer after it. Social sign-in
shows no checkbox and writes no marker, so it reads as remembered, which is
correct and matches what getpiggles does.

## Confirming it

Driven against the running stack, as the browser of somebody who unticked the
box: her real session cookie plus the `dont_remember` marker, both signed with
the dev secret, through the real `/handoff` and the real `/auth/callback`.

```
box ticked   → set-cookie: …session_token=…; Path=/; Max-Age=2592000; HttpOnly; SameSite=lax
box unticked → set-cookie: …session_token=…; Path=/; HttpOnly; SameSite=lax
               set-cookie: …dont_remember=true.…; Path=/; HttpOnly; SameSite=lax
```

Thirty days when she asked for it, and nothing at all when she did not. The first
line is also the measurement of the defect: 2592000 is what the old code applied
to both.

**Twelve tests**, and three of them fail against the previous behavior — checked
by running them against a reverted copy of the builder rather than by assuming:

```
× lasts only as long as the browser when they unticked the box
    AssertionError: expected 2592000 to be undefined
× never writes maxAge 0 for a browser-session cookie
× carries the dont_remember marker so a later refresh cannot undo the choice
```

The mock stops at `auth.options`; the real `getCookies` derives the names and
attributes from it, exactly as the routes do. Mocking `getCookies` would have
tested nothing, since the whole defect was in what it returns and what we did
with it.

## Also in this change

- **`index.ts` was 266 lines**, over Piggles' 250. Split: `origins.ts` answers
  "which machine is getpiggles.com today", `index.ts` keeps the one-time token.
- **A second, weaker copy of the `?next=` guard is gone.** The package carried a
  private `safeNext` that rejected `//evil.com` but not `/\evil.com`, which some
  parsers normalize to the same thing. Nothing escaped through it — both ends
  re-guard with `safeInternalPath` — but `safe-path.ts` says exactly why that is
  not good enough: "a guard that is stricter on one end than the other is a guard
  with a hole in the middle." One copy of the rule now, with an adapter for the
  shape this package wants.

## The gate did not cover any of this

Adding the tests above surfaced something worse than the defect they cover:
**three of the five Piggles packages had no `typecheck` script at all** —
`config`, `brand` and `auth-handoff` — so `pnpm -r typecheck` skipped them and
the pre-push gate never compiled a line of them. They were checked only
incidentally, when a consuming Next app pulled their source in with its own
ambient types, which is why every consumer stayed green while all three failed
on their own.

That mattered immediately: `session-cookie.test.ts` is imported by nothing, so
**no consumer would ever have typechecked it**. Running the package standalone
found two real errors in it the moment vitest was linked.

All three now carry `"typecheck": "tsc --noEmit"` and all three pass:

- **`brand`** and **`config`** needed `"types": ["node"]` — `og.tsx` reads fonts
  off disk, `notice.ts` and `product.ts` read `process.env`, and type roots are
  per-compilation, so a consumer having @types/node never helped.
- **`config`** also used `fetch(url, { next: { revalidate: 60 } })`, which is
  Next's own extension to `RequestInit`. The package is consumed only by Next
  apps but does not depend on `next` and should not gain a framework dependency
  to describe one fetch, so the shape is asserted once at a named constant rather
  than declared globally — a global augmentation here would collide with Next's
  identical one in the three apps that do have it.

`pnpm -r --filter "@piggles/*" typecheck` now runs 8 projects, up from 5.

## Still open

- **Signing in twice in one browser session, without signing out in between, is
  read as her earlier answer.** Better Auth sets the `dont_remember` marker when
  she says no and does not clear it when she says yes, so an untick followed by a
  re-tick keeps the shorter cookie. It errs safe, it self-corrects at the next
  sign-out or browser close, and — the reason it is left alone — it keeps the two
  domains consistent, since getpiggles' own next refresh reads the same stale
  marker and does the same thing. Diverging from the authority domain to be
  cleverer here would be worse than the quirk.
