# 011 — The picture said nine apps, the rail gave her thirteen

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · act 4
**Surface:** getpiggles › Set up your business › "What you will see"
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-opened onboarding — with nothing ticked it now reads **12 apps** (it said "Just Home for now"), ticking "I sell things" takes it to **13**, and 13 is exactly what is on Marisol's rail
**Blocked on:** —

## What happened

Onboarding puts a live preview beside the questions, headed **"What you will
see"**. Marisol ticks website · sell · invoice and it says:

> **9 apps, ready to go.** The rest are one tap away whenever you want them.

— with nine tiles coloured in and the other six plain. Before she ticked
anything it said **"Just Home for now — tick anything on the right and it lands
here."**

Her actual rail has **thirteen** apps. Customers, Messages, Bookings and My Team
are all on it, and the preview had shown all four as _not_ starting there —
she left "I deal with customers" and "I work with a team" unticked on purpose.

Nothing is broken and she got more, not less. But the two halves of one decision
disagreed, on the one screen built specifically to be believed.

## What should have happened

The picture matches the result. Its own source file says why it exists:

> This is the stronger half: the apps you did not tick are RIGHT THERE, named, in
> the same list, visibly present rather than visibly missing.

A preview that does not match the rail you get is worse than no preview, because
the next thing it says has to be checked too.

## How to reproduce

Every time:

1. `localhost:3021/onboarding`, tick nothing → "Just Home for now".
2. Tick "I need a website", "I sell things", "I invoice people" → "9 apps".
3. Finish. Count the rail in the console: **13**.
4. Or read it back: `select settings->'rail'->'apps' from tenants where …` — 13 ids.

## Why it matters

Small in effect, and it is on the screen that is doing the most important job in
Piggles' whole positioning: convincing somebody that an unticked box has not
taken anything away from them. Every person using this has been trained by module
pricing to read a checklist as a purchase. A preview that turns out to be wrong
is a bad first lesson in whether this product's screens can be trusted.

## Where it lives

Two implementations of one rule, in two files, neither aware of the other:

```
apps/account/app/onboarding/actions.ts   railApps()  →  app.defaultEnabled || groups.includes(app.group)
apps/account/components/rail-preview.tsx isOn()      →  group === 'home'   || picked.includes(group)
```

The saved answer honours `defaultEnabled` — twelve of the fifteen apps are on for
everybody, so ticking nothing still leaves a usable product, which is deliberate
and right. The preview never knew about `defaultEnabled` at all, so it drew only
the ticked groups plus Home.

## The fix

The rule moves into the registry that owns the data — `railAppIds(groups)` and
`railHasApp(app, groups)` in `@piggles/config/apps.ts` — and both callers use it.
One rule, one file, and a third caller cannot invent a fourth answer.

The "Just Home for now" branch is deleted rather than corrected: there is no such
state. Twelve apps are on before anybody ticks anything, and the count starting
high is the point — a tick ADDS to a working rail rather than unlocking one.

## Confirmed by

> Re-opened `localhost:3021/onboarding` as Marisol. Nothing ticked: **"12 apps,
> ready to go"**, with Home · My Site · Content · Get Found · Sell · Stock ·
> Customers · Messages · Bookings · Invoices · Money · My Team coloured, and
> Partners · Automations · Connections plain. Ticked "I sell things" → **13**,
> Partners lights up. Ticked website and invoice as well → still 13.
>
> Thirteen is exactly what her rail holds, and exactly what
> `settings.rail.apps` contains for her tenant.

## Something the fix made visible, for Brandon

Once both sides use the same rule, the numbers say something about the question
itself: **three of the five answers change nothing at all.**

| Ticking               | Adds                            |
| --------------------- | ------------------------------- |
| I need a website      | nothing — all three are default |
| I deal with customers | nothing — all three are default |
| I invoice people      | nothing — both are default      |
| I sell things         | Partners                        |
| I work with a team    | Automations, Connections        |

Marisol answered a three-part question and moved one app. That is not a bug — it
follows directly from "ticking nothing must still leave a usable product", which
is the right call — but the screen currently implies more than it delivers, and
the lede ("This only decides what you see first") is doing a lot of work.

Two ways to close the gap, and it is a product decision:

1. **Fewer defaults.** Let the groups genuinely compose the rail, with Home plus
   a small floor always on. The unticked apps are still in All apps, one tap
   away, so nothing is taken from anybody — this is what the copy already
   describes.
2. **Say less.** Keep the defaults and make the question honestly about
   ORDER and emphasis rather than membership — "what should be at the top?"

Not attempted here: either changes what every new business walks into, which is
not a call to make inside a test run.

## Rating effect

getpiggles › Set up your business — Ease 8, unchanged; the row's gap to 10 now
names the question-vs-outcome gap above rather than the mismatch.
