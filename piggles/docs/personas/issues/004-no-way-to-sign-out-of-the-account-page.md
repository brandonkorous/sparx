# 004 — It says who is signed in, and gives her no way to sign out

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · act 1
**Surface:** getpiggles › Your account
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran act 1 — clicked "Sign out" on `getpiggles.com/account`, landed on the signed-out sign-in screen, and `getpiggles.com/account` then bounced to sign-in instead of showing the previous account
**Blocked on:** —

## What happened

`getpiggles.com/account` says, in its second sentence:

> Signed in as bkorous@gmail.com. This is where you deal with Piggles — your
> business itself lives at mypiggles.com.

It then offers exactly two controls at the top — a theme toggle and **Go to my
business** — and nothing anywhere on the page ends the session. Scrolled to the
bottom: plan, capacity, payment, cookie choices, end of page.

The only **Sign out** in the whole of Piggles is in the console's topbar account
menu (`apps/workbench/components/topbar.tsx`, and its mobile twin). So the way
to leave getpiggles.com is to enter the business you were trying not to be in.

## What should have happened

The account app is the auth authority — piggles/CLAUDE.md: _"getpiggles.com is
the auth authority and mypiggles.com has no sign-in UI at all."_ The screen that
owns signing IN owns signing OUT. Naming the signed-in address and then offering
no way to change it is the gap.

## How to reproduce

Every time:

1. Sign in at `getpiggles.com`.
2. Land on `/account`.
3. Look for a way to sign out. There is none, at any width.

## Why it matters

Someone who signed in on a borrowed or shared machine cannot get out of it from
the screen that told them they were in. Small, but it is the one control a person
looks for by reflex, and its absence reads as "this page is not finished".

## Where it lives

`piggles/apps/account/app/account/page.tsx` — the header row at the top of
`<main>`, beside `AppearanceControl` and the `/handoff` anchor.

The console's route already does the work properly
(`apps/workbench/app/sign-out/route.ts`: revokes the Better Auth row, then clears
the cookie), and both brands' cookies address ONE session row, so revoking from
either origin ends both. The account app had no equivalent route.

## The fix

Two files, both in `apps/account`:

- **`app/sign-out/route.ts`** (new) — a POST route that calls
  `auth.api.signOut`, then redirects to `/sign-in`. Modelled on the console's,
  including the "revoke the row, do not just drop the cookie" reasoning: dropping
  the cookie alone leaves a live session that the OTHER domain's cookie still
  addresses, which is the specific way a cross-domain sign-out goes wrong here.
- **`app/account/page.tsx`** — a `<form method="post" action="/sign-out">` with a
  colourless ghost `<button>` beside the appearance control. A form, not a link:
  signing out is a state change and must not be reachable by a prefetch or a
  crawler.

Colourless deliberately — `neutral` on that bar is what issue #003 was.

## Confirmed by

> Re-ran P01 act 1. Opened `getpiggles.com/account` signed in as bkorous@gmail.com,
> saw **Sign out** beside **Go to my business**, clicked it. Landed on
> `/sign-in` signed out. Typed `getpiggles.com/account` back into the address bar
> — bounced to `/sign-in` rather than showing the old account, so the session row
> really was revoked and not just the cookie dropped.

## Rating effect

getpiggles › Your account — Ease 6 → 8 (recorded in [rating.md](../rating.md)).
