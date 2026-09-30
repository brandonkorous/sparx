# 837 — The reset that left the other sessions signed in

**Status:** fixed
**Severity:** security + copy
**Found by:** P03 · Juniper Row · act 283
**Surface:** getpiggles — password reset (`/forgot-password`, `/reset-password`)
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** driven on screen as Devi, all four failure branches, plus the
stored token read back out of the database

## The one that matters: a reset does not end the other sessions

`emailAndPassword.revokeSessionsOnPasswordReset` was never set in
`wizeworks/packages/auth/src/server.ts`, and better-auth reads an unset value as
`false`. So completing a password reset stored the new password and left every
existing session for that user alive.

What makes it a defect rather than a preference is that **the product had
already decided the question, in the other place it comes up**:

| Path                                               | Other sessions                              |
| -------------------------------------------------- | ------------------------------------------- |
| In-console change, `api/account/password/route.ts` | ended (`revokeOtherSessions` defaults true) |
| The emailed reset                                  | **left signed in**                          |

Both workbenches carry that default. Changing a password while signed in, which
is the calm case, ended the other sessions. The emailed reset, which is the only
self-service path that exists for _somebody else knows my password_, did not.

The window is long. Sessions are configured `expiresIn: 30 days` with
`updateAge: 1 day` (same file), so the row slides forward every time it is used:
a session that keeps being used never expires on its own. The owner's one remedy
did nothing to it. [[feedback_a_fix_leaves_its_neighbour_behind]]

Nothing is lost by the person doing the reset. better-auth's `/reset-password`
mints no session, and the form sends them to `/sign-in` either way.

One line, in the shared auth server, so both products get it.

## "Then we will sign you back in."

The reset page's lede, and it has never been true. The endpoint returns
`{status: true}` and creates nothing; the form's success path is
`router.push('/sign-in')`. So the sentence promised to do the work and then
handed her a sign-in form, where she types the password she has just chosen, and
a six-digit code as well if two-step is on.

Now: **"Then sign in with it."** [[feedback_a_promise_in_copy_is_a_contract]]

## The screen that told her to do what she had just done

Sending the link produced this, in this order:

> **Let's get you back in.**
> Tell us the email you sign in with and we will send you a link to set a new password.
> _[green]_ If that address has a Piggles account, a link to set a new password is on its way.

The heading and the lede lived on the server page; the client form swapped only
**itself** for the green box. So the standing instruction survived the thing it
was instructing, with no field left to carry it out in.

And the way back was missing, which is worse than untidy here. This form's
accepted cost is written into its own comment: it gives the same answer for a
known and an unknown address, so **a mistyped address looks exactly like a
correct one** and the person waits for an email that is never coming. The sent
screen offered no way to try another address. The one person the design
knowingly fails was the one person it stranded.

The shell moved into the client component so the heading can answer to the
state. The sent screen is now its own screen:

> **Check your email.**
> If that address has a Piggles account, a link to set a new password is on its
> way. It is good for the next hour.
>
> It can take a minute to arrive, and it is worth a look in your spam folder.
> Sent it to the wrong address? Go back and fix it.
>
> [ Use a different address ]

The address is **kept in state rather than cleared**, so going back shows what
was typed and she edits the typo instead of retyping it.

## Advice with no control to act on it

An expired or already-used link rendered:

> That link has expired or has already been used. Please request a new one.

on a screen holding two password boxes, a Save button, and **no link to
anywhere**. The no-token branch, on the same route, gets a real button. So the
same page answered the same need two ways depending on which way the link was
broken, and the commoner way got the dead end. [[feedback_one_outcome_two_causes]]

`/reset-password` now carries a standing aside — _Link not working? Send me a
new one._ — rather than a conditional one, because expiry is not the only way to
arrive holding a link that will not work, and the line costs nothing otherwise.

## "under 128 characters" refused a password the server would take

The check is `newPassword.length > maxPasswordLength` and `maxPasswordLength`
defaults to 128, so **128 is allowed**. Now: "Use 128 characters or fewer."

## What this surface gets right, measured rather than assumed

Worth recording, because it is a lot for one small screen:

- **The same answer either way, and it says "if" out loud.** Not "we've sent
  you an email" — which would turn the form into a free tool for testing which
  of a list of stolen addresses bank here.
- **The address is normalised with the function that stored it.** Measured:
  `  P03.Devi@Piggles.TEST  ` produced a live token for `p03.devi@piggles.test`.
  Without that, a stray capital is a silent no-op on a form that cannot tell her.
- **"Good for the next hour" is true.** The stored row's window is exactly
  `01:00:00` (better-auth's 3600-second default, unoverridden), and the email
  says 60 minutes. Three statements of one fact, all agreeing.
- **A too-short password does not burn the link.** better-auth checks both
  lengths BEFORE it looks the token up, and deletes the token only after the
  password is stored. So the careful error mapping on this form can afford to be
  precise: being sent back to think again costs a moment, never the link.
- **Four distinct failures, four distinct sentences**, all four driven on
  screen: too short, not matching, too long, bad token.
- **The no-token screen names the real cause** — email clients cutting long
  links in half — instead of blaming the person.
- **No sideways scroll at 360px** in any of the three states.

## Files

- `wizeworks/packages/auth/src/server.ts`
- `piggles/apps/account/components/password-reset-forms.tsx`
- `piggles/apps/account/app/forgot-password/page.tsx`
- `piggles/apps/account/app/reset-password/page.tsx`

## The happy path was not driven, and why

Completing a reset needs a password typed into a field, and the only account
available to drive it is the persona's own. Changing it would take the
credential out of the hands of the person who owns it. The four failure branches
were driven on screen against a real, live token; the success branch is
better-auth's own endpoint, read in `dist/api/routes/password.mjs`, and the only
line this repo adds after it is the redirect.

## The thing to remember

**A product can answer the same question twice and give the weaker answer on the
scarier path.** Session revocation was decided, correctly, on the screen where
somebody calmly changes a password. Nobody asked the same question about the
screen that exists for a break-in. When a setting has a right answer in one
place, grep for every other place the same act happens before assuming it was
carried across.
