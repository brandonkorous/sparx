# 124 — An invited person landed in an empty business of their own, asked to buy a plan

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 8 (Mike Van Der Berg), reproduced with Kendra Ruiz and Alyssa Thompson (act 11's team)
**Surface:** workbench (sparx): invitation page, sign-in and sign-up, the toolbar, the full-window setup; shared sign-in (both products); Piggles account sign-in and sign-up
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Every account has a home business. Signing up makes one, even for a person who signs up only to accept an invitation ("Kendra's workspace"). Five things then went wrong, measured step by step with Kendra:

1. **Accepting.** Kendra pressed "Accept & enter Gillett Diesel Service Inc." and landed in "So, what's your story?", asked to build a salon for $186 a month. The window had fetched its pass (`/api/token`) on the invitation page, 0.4 seconds in, for her own workspace, and the accept moved her with a soft page change that kept it. A reload put her in Gillett. Mike hit the same thing.
2. **Every later sign-in.** A new session starts in the home business. So after any sign-out, an invited person opens on their empty workspace's setup, which covers the whole window.
3. **No way between businesses.** The sparx toolbar printed the business name and its note said there was "nothing to switch it to from here". Piggles has had a switcher for months; the parity check excused the gap with that same sentence.
4. **No way out of that setup.** Its only control, "Save & exit", signs the person out. It was also a hand-painted button with faded text.
5. **The words.** On someone else's computer, the invitation said "Sign in with that address", and "Switch account" led to "Welcome back. Sign in to pick up exactly where you left off". "Create account" said "Start your story. Your story, multiplied". Nothing named Gillett. Piggles' sign-up said "Let's get you started. Fourteen days free. No card needed."

Found on the way: the same soft move after sign-in and after "Switch account" kept the previous person's pass in the window. With Doty signed in, Kendra opening her invitation on the same computer and signing in could have been handed Doty's pass, owner and all.

## What should have happened

A person who accepts an invitation works in that business, from the first click and on every sign-in after. Their own empty workspace stays out of the way and is one choice in a switcher. Each screen on the way says which business they are joining.

## Why it matters

Inviting the team is how a business stops being one person. A service manager or bookkeeper who is asked to "build my salon" for $186 a month on day one concludes they were sent the wrong link, and the owner concludes the product cannot do teams.

## The fix

1. **A change of person or business loads the window fresh** (`sparx/apps/workbench`): accepting (`app/accept-invite/accept-invite-client.tsx`), signing in or up (`components/auth/auth-wrapper.tsx` `finish`), and the invitation's sign-out all use `window.location`, as switching sites already did. Piggles already did this.
2. **Where a new session opens** (`wizeworks/packages/auth/src/starting-business.ts`, hooked into `session.create.before` in `server.ts`, both products): a person whose home business never finished setup, and who belongs to another business of the same product, opens in the one they joined most recently. A person who runs their own business opens at home, as before. A failed read opens at home and never blocks a sign-in.
3. **A business switcher in sparx**: `app/api/businesses/route.ts`, `lib/api/businesses.ts`, `components/toolbar/business-switcher.tsx`, in the toolbar where the name was. One business stays plain text. The stale parity exceptions are removed.
4. **A door back from setup** (`surfaces/onboarding/onboarding-layout.tsx`): "Go to Gillett Diesel Service Inc." for each other business, beside "Save & exit", which is now a silicaui button.
5. **The words**: `lib/invite-joining.ts` reads the invitation from the return address. Sign-in reads "Sign in to join Gillett Diesel Service Inc.", sign-up "Create your account to join Gillett Diesel Service Inc.", both "Use alyssa.thompson@gillettdiesel.test, the address your invitation went to.", with the address filled in. Same in the Piggles account app. The invitation page shows what the role can do (the sentence from issue 120), and for the wrong person says "Sign out, then sign in or create an account with that address." Its "Sign out" comes back to the invitation, which offers both.

Tests, each proved red:

- `wizeworks/packages/auth/src/starting-business.test.ts`: the rule and its read (6). Ignoring an unfinished home reddens 3 of 6.
- `sparx/apps/workbench/components/auth/new-person-new-window.test.ts`: the sign-in and invitation files never move softly. Putting `router.replace('/')` back in the accept reddens 1 of 2.
- `sparx/apps/workbench/lib/invite-joining.test.ts`: reading the invitation (4). Dropping the page check reddens 1 of 4.
- `check:console-parity` green after removing the two stale exceptions.

## Confirmed by

On screen, 2026-10-06:

- Kendra, before: accepted and landed in a salon setup for $186/mo (reproduced).
- Alyssa Thompson, after: Doty invited her as Editor. With Doty signed in, the invitation showed the Editor sentence and "Sign out". After it: "Sign in to accept" and "Create an account". Sign-up read "Create your account to join Gillett Diesel Service Inc." with her address filled in. After verifying, "Accept & enter Gillett Diesel Service Inc." opened Gillett's workbench directly. Her analytics answer and tour stop saved.
- Kendra, after: the toolbar switcher lists "Kendra's workspace" and "Gillett Diesel Service Inc."; switching asks first, then reloads into the chosen one.
- Alyssa signing in again opened her own workspace's setup (the running dev server still holds the old sign-in code, see below). "Go to Gillett Diesel Service Inc." took her straight back to Gillett.

- The new-session rule, after a dev restart: Alyssa signed out and in, and opened in Gillett. Her new session row carries Gillett (`5944fe23-…`) as its business.

## Rating effect

—
