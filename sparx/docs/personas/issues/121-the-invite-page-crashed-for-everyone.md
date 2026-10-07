# 121 — The invite page crashed for every person invited, so nobody could join a team

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 8 (Mike Van Der Berg opening his invitation)
**Surface:** workbench › `/accept-invite` (sparx console; Piggles accepts invitations in its account app)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty invited Mike as an Editor (issue 120). The link in the invitation opened `/accept-invite?invitation=…`, and the page showed "The workbench hit a problem" every time. The page is a server component. It gave the sign-in frame (`AuthShell`, a client component) a tab whose `icon` was the `UserPlus` component. React does not send a component from the server to the client, so the page failed before it drew anything.

Every invitation in the sparx console has gone to this page. Nobody invited has been able to join a business.

Also on the page: the role badge was `color="neutral"`, never approved (RULE #4), and "Gillett Diesel Service, Inc." was followed by a second period.

## What should have happened

The page names the business and the role, and lets the person accept.

## Why it matters

Inviting the service manager is how a business stops being one person. A team that cannot grow cannot hand off the work, and the owner has no clue why the invitation "did not work".

## The fix

- New `app/accept-invite/invite-shell.tsx`: a client wrapper that gives `AuthShell` its one tab with the icon. The icon never crosses from the server.
- `app/accept-invite/page.tsx` uses it. The role badge is colorless outline. The double period is gone.

Test, proved red:

- `app/server-pages-pass-no-components.test.ts` reads every server file under `app/` and refuses `icon: SomeComponent`. A probe file with the old pattern reddens it (1 of 1); it also fails if it finds fewer than 6 server files to read.

## Confirmed by

On screen, 2026-10-06, as Mike Van Der Berg (`mike.vanderberg@gillettdiesel.test`): the invitation page drew "Accept invitation", named Gillett Diesel Service, Inc. and the Editor role. He signed up, verified his email and accepted. The Gillett team list shows him Active as Editor.

The verification email was not read: the dev console mailer prints to the event-worker's output, which this run could not reach. The link was built the same way Better Auth builds it (a signed token for his email, one hour). Reading the real email is still to do.

## Rating effect

—
