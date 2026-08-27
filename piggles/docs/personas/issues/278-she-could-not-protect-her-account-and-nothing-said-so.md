# 278 — She could not protect her account, and nothing said so

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · clicking through every menu in the console after
[277] made menus clickable for the first time
**Surface:** the console — Signing in and security (`/settings/security`), all of it
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

Devi opens her account menu looking for where to change her password. It offers
billing, cookie choices, and sign out — so she searches instead, types "password",
and finds **Signing in and security**. Good screen. Her password, the devices she
is signed in on, two-step verification, a record of what has been done in her
account.

She scrolls, and there is a red card:

> **Could not load your devices**
> This is a problem reaching the sign-in service. Your devices are unaffected.
> [Try again]

She presses Try again. Same. So she goes to the thing above it instead —
**two-step verification**, which is Off, with a paragraph explaining exactly why
she wants it and a button offering to turn it on. She presses it.

> You sign in without a password, so there is nothing to confirm here — carry on
> to set up your app.

That is not true. She signs in with a password. She presses Continue anyway.

> The setup code did not come back. Please try again.
> **That didn't save** — Something went wrong and that didn't save. Please try again.

**Every part of that screen was dead.** Not the display — the display was
excellent. The operations: reading her devices, ending one, ending the others,
changing her password, checking how she signs in, and all four steps of turning on
two-step verification. Nine calls, none of which could ever have worked.

## Why the messages were misleading

The device card said the problem was **reaching the sign-in service**. The service
was never reached. `/api/auth/list-sessions` answered **200 OK** — with 143,105
bytes of `Content-Type: text/html`: the Piggles console's own HTML app shell, Next
runtime and all.

The console mounts no Better Auth handler, so every `/api/auth/*` call fell
through to the catch-all page route and came back as a web page. Better Auth's
client could not parse a page as JSON and reported the only thing it knew how to
say. Then the UI translated that into advice — _"Please try again"_ — that could
never once have succeeded.

## Why the console has no auth handler (and why that is right)

Deliberate, and written down in `piggles/apps/account/app/api/auth/[...all]/route.ts`:

> THIS IS THE ONLY PLACE IN PIGGLES THAT MOUNTS IT. getpiggles.com is the auth
> authority; mypiggles.com deliberately does not mount a handler and has no
> sign-in UI, because two apps that can both mint sessions are two apps whose
> sign-out behaviour will eventually disagree.

The cookie is host-only to getpiggles.com and cannot be widened — the two are
different registrable domains, not sibling subdomains — which is why the console
receives its session through a one-time handoff instead.

So the architecture is correct. What was wrong is that the Security surface was
built on the shared auth CLIENT, which only works on an origin that mounts the
handler. It never could have worked here.

## This had already been found once

`app/api/businesses/route.ts` is the same bug, already caught and already fixed —
for the business switcher — and its comment even names the shape:

> those calls fell through to the catch-all page route, came back as an HTML
> document with a 200, and the client turned that into "no businesses" … Absent
> behaves exactly like fine; that is why this is a route and not a bug report.

It also settles the objection to the fix:

> Neither verb here can create a session. Both REQUIRE one and act within it.

The Security surface simply never got the same treatment. One surface was
repaired, and the identical failure two directories away was left standing.

## What it cost, beyond the operations

Four separate things on that screen stated something untrue, and every one of them
was a failed lookup rendering as a fact:

1. **"You sign in without a password."** `needsPassword` was
   `hasPassword.data === true`, and a failed query has `data === undefined`, so
   "we could not find out" and "she has no password" were the same branch.
2. **The two-step badge read "Off"** — on an account that had it switched on. It
   came from `useSession()`, the same dead client.
3. **No device was marked "This device"**, and the "other devices" count included
   the one she was sitting at, because the current session token came from that
   same call. She could have signed herself out believing she was ejecting a
   stranger.
4. **"A problem reaching the sign-in service"**, when nothing was ever reached.

## The fix

The console now owns the operations, on the pattern the businesses route already
established: `app/api/account/*` route handlers that call `auth.api.*` server-side
with the caller's own headers.

```
app/api/account/shared.ts                         relay + session guard + error mapping
app/api/account/sessions/route.ts                 GET list (marks the current device), POST revoke
app/api/account/password/route.ts                 POST change
app/api/account/sign-in-methods/route.ts          GET hasPassword + twoFactorEnabled
app/api/account/two-factor/route.ts               POST enable
app/api/account/two-factor/verify/route.ts        POST verify
app/api/account/two-factor/disable/route.ts       POST disable
app/api/account/two-factor/backup-codes/route.ts  POST regenerate
```

Not one of them can create a session. Every one requires a session and acts inside
it, on the caller's own account. **The allowlist is the file tree** — an operation
exists because somebody added a route for it, never because a handler exposed a
surface wholesale. Sign-in stays on getpiggles.com, alone.

Which row is "this device" is now decided by the server, which is the only thing
that can read the signed httpOnly cookie. And the three false statements are gone:
the badge shows `Checking…` / `Not known` until the lookup answers, and the
password step offers the field when it could not find out rather than asserting
she has none.

## Two more, found while verifying the fix

Both only reachable once two-step verification worked at all:

- **The backup codes file was named `sparx-backup-codes.txt`.** The file's
  CONTENTS were branded correctly through `security.backupCodes.file`; the
  filename was a hardcoded string. A Piggles owner saving the keys to her business
  got a file named after a product she has never heard of.
- **The file's first line ran into the first code**: `Piggles backup codes2oriZ-EU7fh`.
  The Piggles copy override was `'Piggles backup codes{codes}'` where the platform
  default had the blank line. It is a file somebody opens months later in a panic,
  and the first code in it was unreadable.

## Verified by doing it

As Devi, clicking:

- Devices signed in loads, and her own row is badged **This device** with no
  sign-out button on it.
- Turn on two-step verification → asks for her password (correctly, now) → QR
  code, typed key, and ten backup codes → typed a real 6-digit code → **on**.
  Badge reads **On** after a full reload.
- Create new backup codes → ten fresh ones, "Your previous codes no longer work."
- Download → `piggles-backup-codes.txt`, headed `Piggles backup codes`, blank line,
  then the codes.
- Sign-in is not stranded: `piggles/apps/account/components/sign-in-form.tsx`
  handles `twoFactorRedirect` and calls `verifyTotp` / `verifyBackupCode`, on the
  origin that does mount the handler.

## Still open, noted not filed

Her account menu — the place she looked first — offers billing, cookie choices and
sign out, but not the screen that holds her password and two-step verification.
Search finds it; the menu named after her does not link to it.

## The lesson worth keeping

The console had already learned this lesson once and wrote it down beautifully, in
a file two directories from the one still broken. A fix that stays a fix for ONE
caller is a note, not a repair — the question after fixing a transport bug is
always "who else talks this way", and the answer here was: the entire security
surface of the product.
