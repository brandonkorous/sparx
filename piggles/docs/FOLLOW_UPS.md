# Piggles — follow-ups

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-08-14

Things found while building that need a **decision** or **work outside the slice
that surfaced them**. One line per item in the register, detail below it.

This is not a bug list and not a backlog:

- **Known defects in what is built** live in [STATUS.md](../STATUS.md) — they are
  facts about the current tree, not open questions.
- **What to build next** lives in STATUS.md's `Next` section.
- **This file** holds the things that would otherwise be forgotten because they
  are nobody's current task: a decision deferred, a mechanism that is right today
  and wrong at a known future point, a deliberate omission somebody will later
  mistake for an oversight.

**When you close one, delete it and say so in the commit.** A register of
resolved items stops being read.

| #   | Item                                             | Kind     | Bites when                            |
| --- | ------------------------------------------------ | -------- | ------------------------------------- |
| 1   | Stripe module line items vs the one flat plan    | Defect   | The first Piggles tenant pays         |
| 2   | The console shows no trial or lifecycle notice   | Gap      | A trial ends                          |
| 3   | The module vocabulary is re-declared elsewhere   | Defect   | A module is added to the platform     |
| 4   | Piggles activations are absent from the WW board | Decision | Someone asks what Piggles tenants use |
| 5   | The console declares deps it does not import     | Decision | The first Piggles Dockerfile          |
| 6   | "Is Google configured" is asked in two places    | Defect   | A second social provider is added     |
| 7   | "Keep me signed in" stops at the domain boundary | Defect   | A customer restarts their browser     |
| 8   | Every passwordless path is dead in local dev     | Gap      | Anyone forgets a dev password         |

---

## 1. Stripe module line items vs the one flat plan

**Kind:** defect · **Bites when:** the first Piggles tenant enters a card

`syncModuleItems` (`packages/billing`) keeps a tenant's Stripe subscription in
lockstep with their EXPLICIT module flags — one line item per active module.
That is exactly right for sparx, which sells modules. **Piggles sells one flat
plan with every app included**, so the same code would add up to fifteen
priced line items to a $49/month subscription.

It is dormant rather than solved. `syncModuleItems` returns early when the
tenant has no `stripeSubscriptionId`, and a subscription is born at checkout —
so a Piggles business on its card-less trial is untouched no matter how many
apps it adds. **The moment one subscribes, every subsequent "Add app" starts
billing them.**

The reason to fix it is the pricing model, not the timing. Two shapes worth
weighing:

- Bill from the PLAN, not from the module set — `syncModuleItems` becomes a
  no-op for a tenant whose plan is flat-rate, decided from the tenant's own
  billing configuration rather than from `platformBrand` (a brand check in
  `packages/billing` is the fork this repo works to avoid — piggles/CLAUDE.md
  RULE #0).
- Or: module items exist but are priced at zero for a flat plan. Simpler to
  reason about in Stripe; noisier on an invoice a customer actually reads.

Related and NOT the same question: capacity billing (storage, email volume,
contacts, seats) is Piggles' actual variable axis and is item 3 on STATUS's
`Next`. This item is only about the module axis, which for Piggles must be
free.

## 2. The console shows no trial or lifecycle notice

**Kind:** gap (created deliberately, needs the Piggles version building) ·
**Bites when:** a trial runs out

The shared workbench carries two pieces of lifecycle chrome —
`components/billing/billing-banner.tsx` (the full-width escalation: trial
heads-up → countdown → grace → suspended) and `components/billing/trial-chip.tsx`
(the quiet always-there countdown in the toolbar). **Neither is mounted in the
Piggles console**, on purpose: both open sparx's bill surface, and the console
must never show a price (piggles/CLAUDE.md RULE #2).

But every Piggles tenant IS on a 14-day trial — `provisionTenant` stamps
`trialEndsAt` for both brands — and the console is where the person actually
is. As it stands they would find out the trial ended by the site going dark.

What is needed is the Piggles form of the same ladder: a notice in the console
that says what is happening in plain language and links OUT to getpiggles for
the part that involves money. RULE #2's split is the spec — "My Piggles carries
the quick path: one meter's state at the point of friction and the one-tap
action for that meter", and "the console never knows a price". So the console
renders a label it is handed; the account service decides what it says.

Open sub-question worth settling first: **does Piggles have a 14-day trial at
all?** It is inherited from `provisionTenant` rather than chosen, and the
source pack's commercial docs should be read before the notice is written —
building a countdown for a trial nobody decided on is the wrong order.

## 3. The module vocabulary is re-declared elsewhere

**Kind:** defect · **Bites when:** a module is added to the platform

`ALL_MODULES` in `packages/modules` is now THE list, and `api-rest`'s
`MODULE_SLUGS` derives from it rather than repeating it. That fixed one copy —
the one whose own comment recorded that `inventory` and `finance` had each
fallen out of sync, with the symptom that the module typechecks everywhere and
then **cannot be turned on at all** (the activation toggle refuses the slug as
"Request validation failed").

The same comment warned that there are others: _"several other lists re-declare
the vocabulary."_ They have not been found or fixed. Every one of them is the
same latent failure, and the failure is silent in exactly the way that costs the
most time.

Do this as a sweep: grep an existing slug (`dropship` is distinctive) across the
repo, and for each list that turns up, either derive it from `ALL_MODULES` or
write down why it legitimately differs.

## 4. Piggles module activations are absent from the WizeWorks board

**Kind:** decision (currently deliberate — recorded so nobody "fixes" it blind)

`api-rest`'s activation path publishes to two buses: the tenant's own event bus
(`module.activated`, which drives all the seeding) and the WizeWorks platform
bus via `publishPlatformEvent`, which feeds the internal CRM board.

The Piggles account app's onboarding publishes only the first. The reasoning is
in `piggles/apps/account/lib/activate-modules.ts`: the platform bus records
COMMERCIAL activity, and under Piggles a module going on is not commercial —
there is one flat plan and nothing has been bought.

That reasoning holds for **billing**. It may not hold for **growth**: "which
apps do Piggles businesses actually turn on" is one of the more useful things
the board could answer about a brand whose entire premise is a different
packaging of the same platform, and today it cannot answer it at all.

Note this is narrower than it sounds — the board DOES see Piggles tenants and
what kind of business they are (`brand:piggles` as a contact tag, plus the
story fields on the deal; see STATUS). What is missing is app-level adoption.

Decide: leave it (module activation is not commercial and the board is a
commercial instrument), or publish it with a payload that makes clear no money
moved.

## 5. The console declares dependencies it does not directly import

**Kind:** decision · **Bites when:** the first Piggles Dockerfile is written

`piggles/apps/workbench/package.json` mirrors `apps/workbench`'s dependency
list — `dockview`, `@dnd-kit/*`, `driver.js`, `qrcode`, `socket.io-client`,
`geist` and the schema packages — even though the console's own 24 files import
almost none of them directly. They arrive through the shared surfaces it mounts.

The argument for declaring them: this app renders that component graph, so its
runtime closure genuinely IS that dependency set; a standalone build has to
trace them; and `transpilePackages` entries must resolve from the app root.

The argument against: a dependency nobody imports reads as cruft, and the two
lists will drift the first time one app adds something.

This becomes a real decision at deployment, because
`scripts/check-dockerfile-deps.mjs` is the guard against a workspace dependency
missing from an app image, and it is currently blind to both Piggles apps (see
STATUS). Whatever is decided here has to be what that checker enforces.

## 6. "Is Google configured" is answered in two places

**Kind:** defect · **Bites when:** a second social provider is added, or the env
changes on one deployment and not another

`packages/auth/src/server.ts` registers the Google provider only when
`GOOGLE_CLIENT_ID` **and** `GOOGLE_CLIENT_SECRET` are both set, and adds the One
Tap plugin under the same condition. The account app now renders its "Continue
with Google" button only under that same condition, which it re-states in
`piggles/apps/account/lib/social.ts` — because a button that is certain to fail
is worst on the screen where a person can least tell a broken product from their
own mistake.

Two copies of one condition drift. The fix is a capability query on the shared
auth package — something like `configuredSocialProviders()` — which is a change
to shared code, and therefore one to make deliberately rather than in passing.

Worth doing together with the same latent bug on the sparx side: the shared
workbench's `auth-shell.tsx` renders its Google button **unconditionally**, so on
a deployment without those env vars it offers an entry that cannot work. That is
the platform-level version of this and it is live today.

## 7. "Keep me signed in" stops at the domain boundary

**Kind:** defect (mild) · **Bites when:** a customer closes their browser

Sign-in now carries a "Keep me signed in" checkbox, defaulted on, which is passed
to Better Auth as `rememberMe`. It governs the cookie on **getpiggles.com**.

`mypiggles.com` gets a separate cookie, minted by the handoff callback — and that
route passes no `maxAge`, so the console's cookie is a browser-session cookie
whatever the customer chose. It is not broken: when the console cookie is gone
the console bounces to getpiggles, whose cookie is still good, and a fresh handoff
lands them back. The cost is a redirect on the first visit after every browser
restart, and a checkbox whose promise is only three-quarters true.

The fix is to carry the choice through the handoff and set the console cookie's
`maxAge` from it. The helper already accepts `maxAge`
(`@piggles/auth-handoff/src/session-cookie.ts`); nothing passes one.

## 8. Every passwordless path is dead in local dev

**Kind:** gap · **Bites when:** anybody forgets a password on a dev account —
which has now cost real time once

The sign-in screen offers two ways past a forgotten password: "Email me a link
instead" and "Forgot your password?". **Neither does anything on a local
machine, and neither says so.**

The chain: both call into `publishAuthEmail`, which publishes `email.send`. In
dev the publisher is built by `localDispatchFromEnv`
(`packages/events/src/publisher.ts`), which reads `SPARX_DEV_WORKER_ROUTES` and
returns **null when it is unset** — and it is unset in this repo. So the publish
is a no-op. The only trace is a log line reading
`[pubsub:dev-dispatch] no local worker — skipping`, in a terminal nobody is
watching at the moment they are locked out.

From the person's side the button works: it says "Check your email — we have sent
a link", because the client got no error. Nothing was sent. That success message
is the actual defect — it reports a delivery that provably did not happen.

Two things to fix, and the first is cheap:

- **Do not claim delivery that did not occur.** The publish path knows it dropped
  the event; that knowledge does not currently reach the caller. Either surface
  it, or in dev say plainly that mail is not wired locally.
- **Wire the dev route.** Set `SPARX_DEV_WORKER_ROUTES` in the repo's env so
  `email.send` reaches a local worker and the console provider prints the link.
  That makes both recovery paths testable, which they are not today.

Until then, the only way back into a dev account with a lost password is to sign
up a fresh one.
