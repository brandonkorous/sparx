# 703 — A green tick from a check that stopped running

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 246
**Surface:** mypiggles + sparx — Stock › Things that do not add up
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — both states
**Blocked on:** —

## What happened

Devi's pane, at the top, in green, under a tick:

> ✅ **Everything adds up**
> Every change ever recorded was added back up and compared with 74 stock
> records 3 days ago.

The check runs nightly:

```yaml
# k8s/cronjobs/inventory-integrity-sweep.yaml
schedule: '30 4 * * *'
```

Three days is three missed nights. The pane said so, quietly, in the middle of a
sentence, and still wore the tick.

## Why it matters

"Everything adds up" is a claim about **now**. It was being made from whatever
the last pass happened to find, at any age.

A nightly job stops for ordinary reasons — a failing pod, a tenant flag turned
off, a cron that never fired — and every one of them leaves this exact screen:
green, reassuring, and answering a question nobody has asked since Tuesday. The
one surface whose entire job is to say whether the numbers can be trusted becomes
the least trustworthy thing on it.

The date was already on screen. It read as provenance, not as a warning.
[[feedback_never_present_absence_as_measurement]]

**The pane already knew how to do this.** Four sections further down it checks
exactly this about a connected system, and says why:

> A connection whose last update worked but was days ago looks perfectly healthy
> everywhere else, and its numbers are worthless.

Word for word the problem with its own headline. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was changed

The age is part of the verdict. Past 48 hours a clean result stops speaking for
today:

> ⚠️ **Nothing has been checked lately**
> Every change ever recorded was added back up and compared with 74 stock records
> 3 days ago.
> The check runs every night, so this answer is older than it should be. Run it
> now to see where you stand today.

48 hours is the first threshold a single missed night cannot trip: a 04:30 job
skipped once tops out at 47 hours and change. It takes two.

Age never downgrades a **finding**. Drift stays `danger` however old it is; the
fix for it is the same stock count it always was.

The warning also gets the alert triangle it was missing — `warning` fell through
to the neutral module shield, which is the same tone a healthy pane wears.

## Also on this pane: a list that was not there

The Connected systems section read:

> Each one below promises how often it will report; this is whether it has kept
> that promise.
>
> 1 other connection has not been given a schedule to keep.

Nothing was below. Devi has exactly one connection, her Lyon workshop
spreadsheet, and the pane called it an "**other**" connection — other than none —
while refusing to say its name. A count is strictly less than what she already
knew.

Now: the promise sentence only appears when there is a list to promise about, and
the connections are named.

> Lyon workshop spreadsheet has not been given a schedule to keep, so nothing is
> checked for it.

## Guarded

`integrity-verdicts.test.ts`. Removing the age branch:

```
× stops claiming the present once two nights have been missed
    AssertionError: expected 'Everything adds up' not to be 'Everything adds up'
```

Restored: 14 passed.

## Confirmed

Both states, on Devi's own tenant. Stale: amber triangle, "Nothing has been
checked lately". Pressed **Check now**: green tick, "Everything adds up",
"compared with 76 stock records now", "Clean 2 checks in a row."
