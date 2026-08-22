# 005 — "Start free" on the local site took her to the real Piggles

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Thistle & Rye · act 1
**Surface:** meetpiggles › every "Start free" / "Sign in" / "Talk to a person"
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran P01 act 1 from `http://localhost:3020` — clicked **Start free** and landed on `http://localhost:3021/signup?from=home-hero`, still on the laptop
**Blocked on:** —

## What happened

Act 1 says to start on `http://localhost:3020` and follow a real call to action
into signup, never to type the signup URL. Did exactly that: clicked **Start
free** in the hero.

The address bar went to **`https://getpiggles.com/account`** — the live product,
served from Cloudflare, showing a real WizeWorks tenant and a real signed-in
session. Not localhost. The persona's first click leaves the machine.

Every affordance on the local marketing site does it: the header's Sign in, the
hero's Start free, the pricing CTA, the footer, the closing band, and every
"Talk to a person". The account app returns the favour — its Terms, Privacy,
Trust, Cookies links and its wordmark all point at `https://meetpiggles.com`.

## What should have happened

A laptop that configures nothing points at the laptop. That is not a preference —
`@piggles/auth-handoff` already had this exact bug, was fixed, and wrote the
reasoning down:

> So the origin comes from the environment, with production as the default — a
> deployment that forgets to set it still works, and a laptop that forgets to set
> it points at localhost rather than at the internet.
> …
> NEVER fall through to the production host in development — that is precisely
> the leak above.

`accountUrl()` in `@piggles/config` was written the way `auth-handoff` was told
not to be.

## How to reproduce

Every time, no data needed:

1. `pnpm dev`, then open `http://localhost:3020`.
2. Click **Start free**.
3. The address bar reads `https://getpiggles.com/...`.

## Why it matters

Two reasons, and the second is why this is a blocker rather than an annoyance.

1. **The persona spine cannot be walked locally at all.** Act 1 is "start on
   3020, follow a CTA into signup". That click leaves localhost, so P01 through
   P10 cannot verify signup, onboarding, furnish or handoff the way the script
   requires — the run would either stop or silently switch to typing URLs, which
   is the thing CLAUDE.md forbids because it skips attribution and the
   first-touch payload.
2. **The next click creates a real tenant on the live product.** The signup form
   on the other side of that link is production's. A developer testing signup
   locally, or an agent working the persona script, signs up a fake bakery on
   the real Piggles — with real rows, a real subdomain, and a real trial. Nothing
   on the screen says which product you are on.

## Where it lives

`piggles/packages/config/src/product.ts` — `accountUrl()` built
`https://${PRODUCT.hosts.account}/${path}` unconditionally.

The account app's outbound links did the same inline, in six files
(`app/signup/page.tsx`, `app/account/page.tsx`, `components/assurances.tsx`,
`components/auth-shell.tsx`, `components/consent-choice.tsx`,
`components/signup-form.tsx`).

## The fix

One origin resolver in `@piggles/config`, with `accountUrl()` and a new
`marketingUrl()` both going through it — the same three-step shape
`auth-handoff` already uses, and for the same stated reason:

1. an explicit `NEXT_PUBLIC_PIGGLES_*_ORIGIN` override wins,
2. else a production BUILD uses the production host,
3. else localhost.

`NEXT_PUBLIC_`, because these are read in client components (the header is one) —
a bare `process.env` name is not inlined into the browser bundle and would have
silently resolved to production there while working on the server.

The six inline `https://${PRODUCT.hosts.marketing}/…` links in the account app
now call `marketingUrl()`.

**Deliberately NOT changed:** `metadataBase`, `sitemap.ts`, `robots.ts` and the
prose that names a host as a word ("your business lives at mypiggles.com").
Those are canonical addresses and identity, not navigation — a canonical URL
pointing at localhost is a different bug.

## Confirmed by

> Re-ran P01 act 1 from scratch. `http://localhost:3020`, clicked **Start free**
> in the hero → `http://localhost:3021/signup?from=home-hero`, the local signup
> form, still signed out. Clicked **Sign in** in the header → `localhost:3021/sign-in`.
> From the local signup form, clicked **Terms** → `localhost:3020/terms`. Round
> trip never left the laptop.

## Rating effect

None on its own — it unblocks scoring the signup panes at all.
