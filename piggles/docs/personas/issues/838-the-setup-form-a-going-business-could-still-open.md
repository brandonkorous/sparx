# 838 — The setup form a going business could still open

**Status:** fixed
**Severity:** data loss (potential) + a signup path with no setup in it
**Found by:** P03 · Juniper Row · act 284
**Surface:** getpiggles — onboarding
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** opened as Devi on screen before the guard and after it

## A month-old business, handed its own setup form

Devi finished setting up **2026-08-23**. On **2026-09-25** she opened
`http://localhost:3021/onboarding` and got the setup wizard, prefilled:

> **A few quick things.**
> Then you are in. Nothing here is a commitment. We set it all up for you and
> you can change your mind once you are inside.
>
> What is your business called? · Your web address — **`juniper-row`**`.piggles.site` is yours.
> · What kind of business is it? · What do you do? · Pick a look
>
> [ **Take me in** ]

There was no completion check on the route at all. Not in the page, not in a
layout, and the app has no middleware.

**Pressing that button is not a no-op on a going concern.** Three things happen:

- `saveOnboarding` **rewrites `settings.rail`** from whatever the tick boxes
  happen to hold, and renames the tenant and the primary site.
- It **claims a new web address** if the field is edited. This is the sharp
  one, because the file that does it says why the question is asked here:
  _"it can never be here again: an address is an identifier, identifiers do not
  change, and this is the last moment before the site is published on it."_
  That moment passed in August. Her seven sites hang off `juniper-row`.
- `furnishTenant` runs again, and its sample load **clears its own prior rows
  before writing fresh ones** (`clearSampleDataOnTx`). The clear is precise — it
  matches on sample markers and never touches a row the business made itself —
  but everything a Piggles account is _born_ with carries those markers, and
  picking a different trade on the way through swaps the lot for another
  vertical's.

Nobody has to be reckless to get there. A bookmark made during setup, the back
button, or the browser's own address bar suggesting the URL that was typed once
in August.

## The fact that would have stopped it was already being written

`settings.piggles.onboardedAt`, set by `saveOnboarding`. Read by **nothing**.

Measured on the dev database, 2026-09-25:

| Piggles businesses | Carrying `onboardedAt` |
| -----------------: | ---------------------: |
|                  8 |                  **6** |

Devi's says `2026-08-23T10:50:01.799Z`. It was in the row the page already
loaded, one field away from the name it was reading. [[feedback_fetched_but_never_rendered]]

## Why the guard runs in one direction only

The symmetric rule looks obvious: no marker, force them into setup. It is wrong,
and the measurement says so.

| Business          | Marker | Trade   | Address           |
| ----------------- | ------ | ------- | ----------------- |
| Marta's workspace | no     | —       | sunny-summit-1198 |
| Wildroot Flowers  | no     | florist | wildroot-flowers  |

The marker is written by this app's own action, so a tenant built by a seed or a
fixture never passes through it. **Wildroot Flowers is a working business with a
trade, a real address and a site, and has no marker.** Forcing it into a setup
form is the exact harm this issue is about.

So: a marker PRESENT proves setup finished, and the page bounces. A marker
ABSENT proves nothing, and the page opens. [[feedback_check_the_gate_before_accepting_it]]

(Marta's workspace is the other half of the picture — placeholder name,
generated address, no trade. A signup that never finished, sitting there since
August.)

## The marker now means what its name says

It was written inside `saveOnboarding`, in the same transaction as the rail
groups — **before** furnishing, which is the half that switches the modules on.
So it recorded that somebody pressed the button, not that their business was
ready. With the guard added, that gap bites: furnishing fails, the action says
_"We saved your details but could not finish setting things up"_, and a reload
would now bounce her out of the only screen that can finish it, with her modules
still off.

`markOnboardingFinished` is called after furnishing returns, and is best-effort:
the business is built and usable by then, and losing a signup over a
bookkeeping field would throw away the thing that just succeeded.

## And a whole signup path with no setup in it

`signup-form.tsx` passed `next="/"` to the Google button. `/` is a junction that
sends a signed-in person to `/account`. So **somebody who created their account
with Google was never shown setup**, and landed on the account home with the
tenant exactly as provisioning left it:

- the derived placeholder name (_"Brandon's workspace"_)
- a generated address (`quiet-haven-3783.piggles.site`)
- no trade, no sample data, no look
- **and no modules switched on**, because furnishing is what switches them on
  and furnishing only runs from setup

The password path beside it redirects to `/onboarding` on success. This one did
not. [[feedback_a_fix_leaves_its_neighbour_behind]]

**Latent, not live:** measured, all eight Piggles accounts were made with a
password, so nobody has been through it. Now `next="/onboarding"` — safe for
somebody who already has an account and presses it by mistake, because the guard
above bounces a finished business straight back to `/account`.

## What the screen itself gets right

Read once on screen before the guard landed, and then from source:

- **Three questions, and the file says why there are only three.** sparx fills
  this time by asking which modules you want, because modules are what it bills
  for. Piggles includes every app, so there is nothing to sell and nothing to ask.
- **The tick boxes hide, they never gate.** The copy says _"Everything is
  included either way, and nothing is switched off by leaving it unticked"_, and
  the action backs it: `modules` is deliberately not sent, which the platform
  reads as every module. An earlier version activated only the ticked groups,
  which made that sentence a lie and reinvented module pricing without charging.
- **The live rail preview counts what it shows.** _"12 apps, ready to go"_ is
  `apps.filter(...).length`, not a number typed into a sentence — which is the
  fault issue 835 found in 42 places elsewhere.
- **Every field is keyed on the attempt.** React resets a form's DOM after an
  action and writes back only what changed, so without the key a failed attempt
  leaves each field holding the reset's value instead of hers (issue 163).
- **A field error is shown on the field and not also above the form**, because
  two copies of one sentence read as two problems.
- Real checkboxes bound with `htmlFor`, the whole row a hit target, the hint
  text a direct child of the label so the accessible name is where a tool looks.

## Files

- `piggles/apps/account/app/onboarding/page.tsx`
- `piggles/apps/account/app/onboarding/actions.ts`
- `piggles/apps/account/lib/onboarding-save.ts`
- `piggles/apps/account/components/signup-form.tsx`

## Proved red before it was believed

Same URL, same session, same browser: before the change `/onboarding` rendered
the prefilled form; after it, `/onboarding` lands on `/account` showing
**Juniper Row**. The one-directional half could not be proved the same way —
lifting Devi's marker to watch the form come back is a write to the shared
database, and the sandbox refused it, correctly. [[feedback_a_test_that_cannot_go_red]]

## The thing to remember

**A screen that is correct once can be wrong forever after.** Nothing about the
setup wizard was badly built; it was simply never told that its moment had
passed. Any screen whose whole premise is "this is the first time" needs
something that knows whether it is — and here the something was already being
written, and was being read by nobody.
