# 892 — A task was overdue before anyone could read it

**Status:** fixed
**Severity:** **moderate** — a to-do arrived on her list already wearing a red
"Overdue" badge, because its deadline was the millisecond it was created. Where
the deadline was not zero it was no better, just quieter: it fell at whatever
hour of the night the triggering event happened to fire
**Found by:** P03 · act 316, sweeping Customers by data weight
**Surface:** mypiggles › Customers › Things to do — written by any automation
that opens a task, in both consoles and every tenant
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 9 tests, every case pinned against two timezones, proved red
three ways; and a real automation fired on her own console, before and after

## What she saw

Three things to do, all three red:

```
What to do                                         Status     Due
Onboard new B2B account: Loom and Larder           Overdue    Sep 20, 2026
Advance to next stage: Q-000017                    Overdue    Sep 22, 2026
Q-000016 was approved: take it to the next step    Overdue    Sep 30, 2026
```

The last one is dated **today**. It is 12:10 in the afternoon and it says she
has already missed it.

## Measured

```
title                                              created_at      due_at
Advance to next stage: Q-000017                    19:49:50.840    19:49:50.836
Q-000016 was approved: take it to the next step    08:07:28.297    08:07:28.290
```

Created and due within **seven milliseconds**. Both tasks were late before they
existed. Of 566 tasks on the platform these two are the only ones, and both are
hers, because she is the only business whose billing documents have reached the
stage that fires the automation that writes them.

## The chain

The seeded automation in `seeds/invoicing.ts`:

```ts
{
  type: 'crm.create_task',
  config: {
    title: '{{invoice.number}} was approved: take it to the next step',
    dueInDays: 0,
  },
}
```

And what `dueInDays` meant, in **two** call sites, identically:

```ts
new Date(Date.now() + cfg.dueInDays * MS_PER_DAY);
```

With `0` that is exactly `Date.now()`. And `0` is not an unusual value to pass:
`CreateTaskConfig` in `crm-depth.ts` **defaults** it to `0`, so any create-task
step that does not mention a due date gets one of "right now".

## It is not only the zero

A deadline on a to-do list is a **day**. "Get to it today" means by the end of
today; "by tomorrow" means by the end of tomorrow. Twenty-four hours from the
firing of an event is neither.

So `dueInDays: 1` on a quote approved at 2am makes a task that turns red at 2am
the following morning, hours before the shop opens, and the first anyone knows
of it is a red badge over breakfast.

And it has to be the **business's** day. The SLA clock in the same package had
already learned this, and its comment is the argument in full:

> _"In the business's OWN hours, not UTC. 'Open 9 to 5' is the only thing a
> person means by it, and a promise bootstrapped in UTC quietly counts those
> hours somewhere else — for a shop in Denver every deadline lands six hours
> early, and the first anyone hears of it is a request that went red
> overnight."_

The task deadline two files away had never been told.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What it does now

One rule, in `taskService`, where both automation call sites and the Today
query can read it:

```ts
export function dueAtForDays(dueInDays: number, timeZone: string, now = new Date()): Date {
  let day = localCalendarParts(now.getTime(), timeZone);
  for (let i = 0; i < Math.max(0, Math.trunc(dueInDays)); i += 1) day = nextLocalDay(day);
  const after = nextLocalDay(day);
  return new Date(localWallToUtc(after.year, after.month1, after.day, 0, timeZone) - 1);
}
```

**Nothing here is new arithmetic.** `@wizeworks/time` already exists, describes
itself as "the platform's wall-clock math", and already carries
`localCalendarParts`, `nextLocalDay` and `localWallToUtc` — the last of which
resolves the zone offset twice so a day containing a clock change comes out
right instead of an hour off. `@wizeworks/crm` already depended on it. The job
was to find the rule, not to write one.

`crm.ts` and `crm-depth.ts` now both call `taskService.dueAtIn(ctx, days)`,
which looks up the business's zone the same way `ticket-service` does for an
SLA. Their duplicated `MS_PER_DAY` constants are gone.

**A second one fixed while there.** `getTodayForUser`, which drives Today's
Tasks, built its window with `new Date().setHours(0, 0, 0, 0)` — midnight where
the **server** stands. In production that is UTC, so for a Denver shop "today"
began at 6pm yesterday and an evening task drops out of Today while she is still
working. It now uses the business's zone too.

## Proved

**9 tests**, and three wrong versions:

```
now + N × 24h (the original)                 →  9 of 9 fail
the day computed in UTC, not her zone        →  7 fail
the START of the day rather than its end     →  8 fail
```

The second is the one that matters. **This machine is in Denver**, so a test
that asserts one Denver answer passes with the timezone argument deleted. Every
case here pins ONE instant against TWO zones that disagree about which day it
is — Denver and Tokyo — which no zone-blind version can satisfy anywhere on
earth. [[feedback_a_test_that_cannot_go_red]]

Two cases sit on Denver's clock changes, in March and November, because adding
86,400,000 milliseconds to a 23-hour day lands an hour into the next one.

A last case sweeps all 24 hours of a day across four zones and asserts the one
thing the whole issue is about: a deadline a task has just been given is in the
future.

## Verified through the real thing

Not only the unit. I added a wholesale customer on her console, which fired the
seeded `New wholesale customer: set-up task` automation (`dueInDays: 1`) through
the event worker and into the database:

```
title                                                created_at             due_at
Set up prices and terms for Thornbury Haberdashery   2026-09-30 18:19:39    2026-10-02 05:59:59.999
                                                                            = Oct 1, 23:59:59.999 Denver
```

The end of tomorrow, in her own calendar. On her screen it reads **To do**,
where the row above it still reads **Overdue** for a task due seven
milliseconds before it was written.

## Checks

`@wizeworks/crm` 29 files / 286 tests, `@wizeworks/automation-actions` 3 / 25,
both fully green. Typecheck 0 on both packages. ESLint and prettier clean.

## Files

- `wizeworks/packages/crm/src/services/task-service.ts`
- `wizeworks/packages/crm/src/services/task-deadline.test.ts` (new)
- `wizeworks/packages/automation-actions/src/crm.ts`
- `wizeworks/packages/automation-actions/src/crm-depth.ts`

## Test data left in place

The wholesale customer **Thornbury Haberdashery** and its task "Set up prices
and terms for Thornbury Haberdashery". They are the proof, and the standing rule
is to leave what testing creates.

## What I got wrong on the way

My first DST case asserted a 13-hour gap from "11am Denver" and went red. The
code was right and my arithmetic was not: 18:00 UTC on 8 March is **noon** in
Denver, because the clocks had already gone forward that morning. The fix was to
the test's expectation, not to the rule it was testing.
[[feedback_a_fix_leaves_its_neighbour_behind]] cuts both ways — when a
measurement and the code disagree, check which one you actually wrote down.

## Not changed

The two tasks already in her list keep their bad deadlines. A fix to how
deadlines are calculated is not a licence to rewrite what a record says
happened, and both are open tasks she can complete or re-date herself.

## The thing to remember

**"In N days" is not "in N times twenty-four hours", and zero is where the two
come apart completely.** The arithmetic is the first thing anybody writes, it is
approximately right for every value except the one the platform's own seed data
uses, and its error for the other values is an hour of night rather than a
visible wrong answer.

The measurement that finds it is not "is this deadline in the future" — for
`dueInDays: 1` it always is. It is **"what does this field mean at zero?"** A
count of days that means an instant at zero is not counting days.
