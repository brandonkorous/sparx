# 290 — She set the wait to fifteen minutes and the email still went at two and a half hours

**Status:** fixed
**Severity:** major (a setting the owner can see and edit governs half its
feature; the other half runs on a number nobody can reach)
**Found by:** P03 · Juniper Row · noticed while fixing [289], then asked about
directly
**Surface:** the console — Sell › Selling settings › _Count an unfinished cart as
abandoned after (minutes)_, and the **Abandoned cart nudge** automation that
ships turned on with Commerce
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

There were **two abandonment clocks**, and only one of them was hers.

| Clock                                                    | Where it lives                                             | Who can change it |
| -------------------------------------------------------- | ---------------------------------------------------------- | ----------------- |
| `cart_abandonment_minutes` — per site, default **120**   | Selling settings, a real field with a real save            | **the owner**     |
| a hardcoded **30 minutes**, plus a **7200-second** delay | `automation-actions/src/resolvers.ts`, `seeds/commerce.ts` | nobody            |

The first drives the console's **Walked away** tab and the abandonment report —
[283] built the sweep that reads it. The second drives **Abandoned cart nudge**,
a system automation that ships `active` on Commerce activation and emails the
shopper.

So the number she sets and the moment her customer is emailed have nothing to do
with each other. Last session I turned her threshold down to **15 minutes** to
prove the dial worked, and it did — a basket landed in Walked away at fifteen
minutes. The nudge email for that same basket was still scheduled for **two and a
half hours** (30 minutes cold + a 2-hour delay), and nothing on any screen said
so.

## Why this is the same defect as [283], not a new one

[283]'s sharpest line was that "Cart abandonment minutes" was **a dial connected
to nothing**. The sweep connected it — to the tab and the report. It was never
connected to the email, which is the part the shopper actually experiences and
the reason an owner sets the number at all.

A half-connected dial is worse than a disconnected one. Disconnected, nothing
happens and she eventually asks why. Connected to one of two things, the screen
confirms the setting took effect, and the behaviour she was actually buying
quietly does something else.

## The fix — delete the second clock rather than sync it

The scanner is **kept**: "Abandoned carts" is offered in the automation builder's
own list of scannable records (`SCAN_ENTITIES`), so removing it would take a
capability away from anyone who has built their own rule on it.

What is removed is its arithmetic. It used to decide "cold" itself:

```ts
const coldBefore = new Date(now - 30 * 60_000);
where: { updatedAt: { lt: coldBefore, gt: floor }, … }
```

and now it simply asks which baskets are **already flagged**:

```ts
where: { abandonedAt: { not: null, gt: floor }, … }
```

The sweep does the marking, at her per-site number. Keying the automation off the
mark means the email, the tab and the report are reading one fact, and cannot
drift apart again — there is no second threshold left to disagree with.

The seed's `delaySeconds` drops from **7200 to 0** for the same reason: she has
already said how long a quiet basket should wait, in the one field that says so,
and a delay stacked on top silently adds to her number. Its description now says
where the wait comes from, so the automation and the setting point at each other.

An event-driven trigger on `cart.abandoned` was considered and rejected for now:
it is the architecturally purer answer (the registry's own comment says scanners
are for predicates with **no** per-record event, and since [283] there is one),
but it would mean removing the scanner and with it the listed capability above.
Keying the scanner off the mark gets the single clock without that cost.
`cart.abandoned` firing with no subscriber stays open on [283].

## Confirmed on the clock, with her dial as the only variable

One basket — Rowan Ellery's, **165 minutes** idle and unchanged throughout — and
her setting moved twice. Nothing else was touched:

| She set           | Sweep, same basket    | Nudge                                    |
| ----------------- | --------------------- | ---------------------------------------- |
| **1,440** minutes | `found: 0, marked: 0` | nothing                                  |
| **15** minutes    | `found: 1, marked: 1` | fired, **Finished**, email step **Done** |

Under the old scanner the nudge would have gone out in **both** rows, because
165 minutes is past a hardcoded 30 either way. The number she can see is now the
only thing that decides it.

On her screen, **Abandoned cart nudge → Results**: _Started **1** — times this
rule picked somebody up_, and _Send a marketing email · Reached it 1 · Finished
it 1 · Failed —_. The run itself reads **Finished · every step ran to the end**,
with policy checks `tenant-active`, `kill-switch` and `module-active` all
allowed.

It fired at **7:30 PM**, the moment the tick reached it, rather than two hours
later — `delaySeconds: 0` visible as behaviour. Her automation's own **Setup
(JSON)** reads `{ "emailType": "marketing", "delaySeconds": 0, "builderEmailKey":
"abandoned-cart" }`, and its description now reads _"Emails a shopper once their
cart has been sitting long enough to count as abandoned — the wait is the one you
set in Selling settings."_ Existing tenants pick both up through
`reconcile-seeds`, which was run the way its CronJob runs it (37 commerce tenants,
851 automations reseeded).

**One thing found while confirming, and it is not a defect:** an interval
automation is only due on exact `everyMinutes` boundaries of the UTC day
(`minuteOfDayUtc(now) % everyMinutes === 0`), because the worker ticks every
minute in production. A one-off tick on any other minute does nothing at all,
which is worth knowing before concluding a rule is broken — the first tick here
looked like a failure and was a wrong minute.

## The sentence that was already promising it

The helper text under the field has said this the whole time:

> How long a cart can sit untouched before it counts as abandoned **in your
> reports and reminder emails**.

The screen named both halves. Only one of them was true, which makes this a false
sentence rather than a missing connection — and it is why the severity is major.

## The lesson worth keeping

[283] asked "is this dial connected?" and stopped at the first thing it moved.
The honest version of that question is **"is it connected to everything it
claims?"** — one setting, one sentence on screen, and every behaviour that
sentence promises. Finding the first connection is where this kind of bug hides,
not where it ends.
