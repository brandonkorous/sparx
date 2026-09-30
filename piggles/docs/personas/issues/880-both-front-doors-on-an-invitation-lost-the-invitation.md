# 880 — Both front doors on an invitation lost the invitation

**Status:** fixed
**Severity:** **major** — the only way onto a team, and it completed for exactly
one kind of visitor: somebody already signed in, on the right address, at the
moment they clicked. Everyone else was signed in successfully and put somewhere
else, with nothing on screen saying the invitation had been dropped
**Found by:** P03 · act 313, inviting a Saturday assistant
**Surface:** getpiggles › You've been invited › both buttons; and the OAuth
consent screen behind them
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 8 tests, every rule proved red four different ways; and the
same two doors walked end to end on screen, before and after

## Measured

```
tenants on the platform                                      113
invitations ever sent                                          3
  · accepted                                                   1
  · revoked                                                    1
  · pending                                                    1
non-owner members on the platform                              3
```

Three invitations across a hundred and thirteen businesses. A team feature that
nobody uses looks the same from the outside as a team feature that does not
work.

## The two doors

The invitation page offers exactly two ways in, and builds both correctly:

```tsx
<Link href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}>Sign in to join</Link>
<Link href={`/signup?callbackURL=${encodeURIComponent(callbackURL)}`}>
  I&rsquo;m new: create an account
</Link>
```

And then:

```ts
// sign-in/page.tsx
const next = safeInternalPath(one(sp.next));
```

`sp.next`. The link says `callbackURL`. So `next` fell to `/`, the person was
signed in, and they landed on the account home. The invitation was still
outstanding and no screen mentioned it.

The signup page is worse, because it reads **neither**:

```ts
const from = one(params.from);
const attribution = one(params.a);
// ...and nothing else
```

`signUpMerchant` creates a user **and a tenant**, and the action ended
`redirect('/onboarding')` unconditionally. So somebody invited who did not yet
have an account was walked through setting up a business of their own. They
finish onboarding owning an empty shop, still not on the team that asked them.

## Four writers, one reader, two spellings

```
accept-invite/page.tsx:93            → /sign-in?callbackURL=…
accept-invite-client.tsx:88          → /sign-in?callbackURL=…    "Sign in as someone else"
oauth/consent/page.tsx:82            → /sign-in?callbackURL=…
oauth/consent/submit/route.ts:122    → /sign-in?callbackURL=…

sign-in/page.tsx                     ← reads `next`
signup/page.tsx                      ← reads nothing
```

The account app writes `next` (`handoffEntryUrl`, `sameOriginRedirectWithNext`).
Better Auth writes `callbackURL`. The console writes `callbackURL`. Every one of
those four links was written in the console's spelling by somebody who had just
been reading console code, and nothing anywhere reconciled the two.

The package that owns the handoff had already learnt this lesson about a
different guard:

> _"a guard that is stricter on one end than the other is a guard with a hole in
> the middle."_

Same shape, one level up: a parameter written under one name and read under
another is a parameter with a hole in the middle.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

**Readers accept either spelling. Writers keep the house one.**

`returnPath` lives in `@piggles/auth-handoff` beside `internalPath`, because
that package already owns the question "where do we land this person" and is
the one place both the account app and the console can reach.

Reading both is not untidiness. It is the only honest reading available: the
parameter is already out in the world on invitation emails sent before today,
and no rename reaches a link somebody was emailed last week. The four writers
are left as they are; they now work.

- **Sign-in** resolves `next` or `callbackURL`, and its "Create an account" link
  carries the destination onward.
- **Signup** does the same with `/onboarding` as its fallback, threads the
  destination through a hidden field into the server action, and its "Sign in"
  link carries it back. The two links are one loop, and a loop that drops its
  payload at one end drops it.
- Everything still goes through `safeInternalPath`, because this value arrives
  in a URL anybody can edit and it becomes a redirect. An absolute one would
  make the account app an open redirector. It falls back rather than failing, so
  a tampered link still signs the person in.

## Proved

**8 tests** in `piggles/packages/auth-handoff/src/return-path.test.ts`, each
rule proved red by breaking it:

```
read only `next`                  →  2 fail  (the callbackURL cases)
prefer callbackURL over next      →  1 fail  (the "both present" case)
drop safeInternalPath             →  2 fail  (the open-redirect cases)
take the LAST repeated value      →  1 fail  (`?next=/a&next=/b`)
```

**Walked on screen, both doors.**

_The new person._ `/signup?callbackURL=<invitation>` → filled the form → landed
back on **the invitation**, showing the verify-your-email step. Before this
change that same click ended in onboarding for a business she was not trying to
create.

_The person who already has an account._ `/sign-in?callbackURL=<invitation>` →
signed in → landed on the invitation reading **"Join Juniper Row"**. Clicking it
made her an editor of Juniper Row and moved the invitation to `accepted`.

The email-verification step in the middle is correct and was left alone; the
address was marked verified directly for this run, because dev email is written
to the server's own log and there is no inbox to open.

## Two smaller things found on the way

**The page title said the brand twice.** Every other page in the account app
passes a bare title and lets the root layout's template append the product name.
This one spelled it out as well, so the browser tab read **"You've been invited ·
Piggles · Piggles"**. Fixed; the `openGraph` and `twitter` titles elsewhere that
look like the same mistake are not, because those do not go through the
template, and were left alone.

**"anonymised".** The account app's assurance panel, the home page's questions,
the trust page, the terms, the privacy policy and the data-processing record all
carried _"Not a model, not anonymised, not ever."_ British spelling, in the six
most carefully worded sentences on the site. `check:american-spelling` already
knew `organise` and `authorise`; it had never been told this verb. The whole
`anonymise` family is on the list now, the guard was run and went **red on six
real files**, and then green. [[feedback_american_spelling]]

## Files

- `piggles/packages/auth-handoff/src/origins.ts`
- `piggles/packages/auth-handoff/src/index.ts`
- `piggles/packages/auth-handoff/src/return-path.test.ts` (new)
- `piggles/apps/account/app/sign-in/page.tsx`
- `piggles/apps/account/app/signup/page.tsx`
- `piggles/apps/account/app/signup/actions.ts`
- `piggles/apps/account/components/signup-form.tsx`
- `piggles/apps/account/app/accept-invite/page.tsx`
- `scripts/british-words.mjs`
- `piggles/apps/account/components/assurances.tsx`
- `piggles/apps/web/components/marketing/home/questions.tsx`
- `piggles/apps/web/app/trust/page.tsx`
- `piggles/apps/web/app/terms/page.tsx`
- `piggles/apps/web/app/privacy/page.tsx`
- `piggles/apps/web/app/data-processing/page.tsx`

## The thing to remember

**A redirect that goes somewhere plausible is the hardest kind of broken to
see.** Nothing failed. No error, no 404, no log line. The person signed in, saw
a working page, and the thing they were doing was gone. The only way to notice
is to walk the flow with the intent you arrived with, and check you are still
holding it at the end.

The measurement that finds it is not "does sign-in work" — it works. It is
**"who writes this parameter, and does the same name appear where it is read?"**
Grep the writers and the readers separately and lay the two lists side by side;
the flows that break are the ones whose name appears on only one list.
