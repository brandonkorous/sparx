# 369 — On her phone, nothing said the trial was ending, and then the site goes dark

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · working the register (FOLLOW_UPS #1)
**Surface:** mypiggles › everywhere · the account's own lifecycle
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** Devi's own account, 5 days left on a real trial, at 1261px collapsed, 1261px expanded and 360px, in both themes

## What happened

Juniper Row's trial ends on 6 September. Devi has a shop, a year of orders and
seven sites. When that date passes without a payment the public site goes
offline.

On her phone, the console said nothing about it. Not a quiet line, not a chip:
nothing. Home said "Good morning, Devi. 2 things are waiting for you", and
neither of the two was this.

Collapse the rail on a laptop and it is the same silence.

## Why it happened

The warning exists and is good. `components/rail/plan-card.tsx` renders **Free
trial · 5 days left · Set up payment**, escalates through grace to suspended,
and hands off to getpiggles for anything involving money. It is mounted like
this:

```
{expanded ? <PlanCard accountOrigin={accountOrigin} /> : null}
```

Two populations never see it:

- **anyone who collapsed the rail**, which is an ordinary thing to do for screen
  space, and
- **everybody on a phone**, because the compact shell has no rail at all. It
  mounts `components/mobile/*`, and `PlanCard` is not among them.

Piggles' own audience is named in `personas/CLAUDE.md` as including a
61-year-old on a phone in a workshop. That person could not have found this out.

The code that hides it says why, and the reason is not true:

> Only when the rail is showing words. Collapsed, a plan card would be an
> unreadable smudge; **the same information is one click away in the account
> menu.**

The first half is right. The second is not: the account menu carries **"Your
plan and billing"**, an unchanging link, on both desktop and mobile. It has no
phase, no countdown, no tone, and it reads identically whether the trial has
twelve days left or the site is already offline. A door is not information.

**The register's version was wrong in the other direction.** Item 1 said "The
console shows no trial or lifecycle notice" and that neither piece of lifecycle
chrome "is mounted in the Piggles console". The card is built, mounted and
working, and it was rendering **Free trial · 5 days left** on this very account.
The item also parked itself on an open question, "does Piggles have a 14-day
trial at all?", which the approved source pack already answers:

> **Trial.** Recommended initial posture: 14 days, no card required unless unit
> economics dictate otherwise. — `docs/initial/docs/commercial/BILLING_RULES.md`

`provisionTenant` stamps `TRIAL_PERIOD_DAYS = 14`. There was no decision
outstanding, only a gap nobody had looked at.

## The fix

**A band in the slot both shells already mount.** `HeaderNotice` sits above
everything in `desktop-shell.tsx` and in `compact-console.tsx`, renders nothing
when there is nothing to say, and cannot be collapsed away. The account's own
state belongs in exactly that slot.

`components/lifecycle-band.tsx` renders there, on both shells. It steps aside
when the rail's card is on screen **and** the news is still calm, so an open rail
does not get told twice about a trial with a fortnight left. Anything past calm
shows in both places, because a site going offline is worth saying twice.

**The words moved into `lib/billing/lifecycle.ts`**, shared by the card and the
band. They were inline in the card, which is precisely how one surface came to
be the only thing that said any of it.

Three things the words now get right that the inline version did not:

- **Grace never says "trial".** `grace` covers a trial that ended without payment
  AND a renewal that failed, and the two are different stories. Telling a
  customer of a year that their trial has ended sends them looking for a trial
  they never had. What is true either way is what happens next: _"Your site
  stays online for 2 more days. After that it goes offline until a payment goes
  through."_
- **A countdown nobody measured is not printed as a number.** `daysLeft` is
  nullable, and the old line read `daysLeft ?? 0` — which would have rendered
  **0 days left** on the one screen that must not invent a measurement. A missing
  count now drops the number and keeps the warning: _"Ending soon"_.
- **An unknown countdown is never the calm one**, because "you have plenty of
  time" is a claim about a length we do not have.

The console still never knows a price (piggles/CLAUDE.md RULE #2). Only
`bill.billing` is read — a phase, a countdown and two dates, with no money in it
— and every sentence ends at a door to getpiggles.

## Confirming it

On Devi's real account, `trial_ends_at 2026-09-06`, `subscription_status
trialing`, five days out:

| Where                   | Before                             | After                                                                                           |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| Desktop, rail expanded  | card: **Free trial · 5 days left** | unchanged — the band stays out of the way                                                       |
| Desktop, rail collapsed | **nothing**                        | band: _"Your free trial has 5 days left. Set up payment now and nothing changes when it ends."_ |
| Phone, 360px            | **nothing**                        | the same band, wrapping to three lines with the button under it                                 |
| Account menu, either    | "Your plan and billing"            | unchanged, and no longer load-bearing                                                           |

Checked in dark and in light: the band is a `bg-info` / `text-info-content` pair,
the same table `@piggles/ui`'s `HeaderNotice` uses, so it is legible in both by
construction rather than by luck. The button carries no `color` — a colored
button on a colored fill paints over it and stops being readable on one theme.

**Fourteen tests** on the words, including the three corrections above.

## Still open

- **`grace` gates paid module features in the dashboard** (`@wizeworks/billing`'s
  own comment). Piggles RULE #1 says a user is never blocked from an ordinary
  business capability because of what they bought. Those are about different
  things — one is not paying at all, the other is tiering — but the interaction
  has not been looked at and is not this issue.
- **The band reads `/v1/finance/bill`**, which returns amounts the console then
  refuses to touch. The discipline holds by convention (read `billing`, never
  `bill`). The right shape is a narrow account-service endpoint that returns only
  the phase, so the console cannot fetch an amount even by accident. Carried over
  from the plan card's own note, unchanged.
