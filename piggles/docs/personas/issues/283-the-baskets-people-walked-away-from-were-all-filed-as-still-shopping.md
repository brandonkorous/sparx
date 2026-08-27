# 283 — The baskets people walked away from were all filed as still shopping

**Status:** fixed in code — proved at the scheduler and in the database; **the
screen confirmation is still owed** (api-rest is not running, see below)
**Severity:** major (a whole capability that has never once functioned, on any
tenant, since the commerce module shipped — and the screen says the opposite)
**Found by:** P03 · Juniper Row · act 6's fourth job, the one [258]-era notes
recorded as "not checked — to be re-checked later in this run, once the window
has passed"
**Surface:** the console — Sell › Baskets left behind; and the abandonment
report behind it
**Filed:** 2026-08-27

## What happened

Devi opens **Baskets left behind**. It opens on the **Walked away** tab:

> **Nothing here**
> No abandoned carts at the moment. When a shopper fills a cart and leaves
> without paying, it lands here so you can follow it up.

One tab to the left, **In progress**, holds five baskets worth **$783**:

| Shopper                | Items | Last active      | State       | Value   |
| ---------------------- | ----- | ---------------- | ----------- | ------- |
| Rowan Ellery           | 1     | Aug 26, 1:05 AM  | In progress | $126.00 |
| Priya Menon            | 1     | Aug 25, 4:05 PM  | In progress | $145.00 |
| Anneliese Van der Berg | 1     | Aug 25, 3:05 AM  | In progress | $192.00 |
| Anneliese Van der Berg | 1     | Aug 25, 2:54 AM  | In progress | $128.00 |
| Nobody left a name     | 2     | Aug 24, 11:30 PM | In progress | $192.00 |

It is Aug 27. The oldest is **three days** untouched. Her abandonment threshold
is **120 minutes**. Every one of these walked away days ago, and the screen whose
entire job is to say so says there are none.

## It is not five baskets, it is the whole feature

```
walked away : 0 rows
```

Not zero for Juniper Row. **Zero for every tenant in the database, all time.**
`abandoned_at` has never been non-null on any cart that has ever existed here.
The "Walked away" tab has never held a row and could not have.

## Why

Everything abandonment needs was built. One thing was not.

| Piece                                                           | State                            |
| --------------------------------------------------------------- | -------------------------------- |
| `cart_abandonment_minutes`, per site, default 120               | shipped with the commerce module |
| A field for it in Commerce settings, editable by the owner      | shipped                          |
| `findIdleCarts(ctx, cutoffMinutes)`                             | shipped                          |
| `markAbandoned` — writes the column, publishes `cart.abandoned` | shipped                          |
| The `cart.abandoned` event, in both catalogs, topic provisioned | shipped                          |
| The console tab, its filter, its empty state                    | shipped                          |
| `recovered_at`, `markRecovered`, the "Came back" tab            | shipped                          |
| The abandonment + recovery report                               | shipped                          |
| **Anything that runs any of it on a clock**                     | **never existed**                |

`markAbandoned` had exactly ONE caller: `POST /v1/commerce/carts/:id/abandoned`,
a manual admin endpoint somebody has to hit per basket. Nothing on any screen
calls it. No worker calls it. No cron calls it.

And `findIdleCarts` — whose own docstring reads **"Worker sweep — returns cart
ids that have been idle longer than `cutoffMinutes`"** — had **zero** callers.
A function written for a worker, describing the worker in its first line, with
no worker.

## The sharpest version of it

**She can set the threshold.** "Cart abandonment minutes" is a real field on a
real settings screen, it validates, it saves, and it is read by nothing. A dial
connected to nothing, on the screen where an owner goes to tune exactly this.

## The same thing was found and fixed once already, next door

`funnels` has this sweep. Its comment says why it exists, and it describes the
cart bug word for word:

> The sweep is the one funnel signal nobody triggers: `funnel.abandoned` fires
> because a person STOPPED, and an absence has no request behind it. It is the
> event the recovery follow-up hangs off, so a funnel without it is a report
> somebody has to remember to open.

Somebody understood this exactly, wrote it down, shipped the CronJob — for
funnels. Carts have the identical shape and got nothing. Fifth instance in three
sessions of a fix that stopped at one caller, after [278], [280], [281] and the
order half of [281].

## The fix

**`sweepAbandonedCarts`**, a scheduler beside the reservation reaper, plus
`POST /internal/commerce/cart-abandonment-sweep` and a CronJob at `*/10`.

Every ten minutes, not nightly: the default threshold is 120 minutes and the
whole value of the signal is following someone up while they might still come
back. A nightly sweep would make a two-hour setting mean "tomorrow".

**Per SITE, not per tenant.** `cartAbandonmentMinutes` is a per-site setting, so
one cutoff for a tenant with two shops is wrong for at least one of them.

**And per site INCLUDING the no-site scope**, which is the trap in this one:

```
carts with property_id IS NULL : 19 of 34
```

Devi's ten all carry a site, so a sweep that enumerated properties would have
worked perfectly on her and **silently skipped 19 baskets** platform-wide while
reporting success — the scan-nothing-and-print-green shape this repo has hit five
times. `listCartSiteScopes` returns the distinct sites among live baskets
_including `null`_, and `commerceSiteService.getSettings` was widened to take
`null`, meaning "no site in hand — inherit the primary's row". That is the same
fallback a site without its own settings row already got, so both go through one
path rather than two.

## Verified — and what is NOT yet verified

Run against Juniper Row, through the scheduler the CronJob invokes:

```json
{ "tenantId": "2e78fb6c…", "scopes": 1, "found": 5, "marked": 5, "failed": 0 }
```

Five `cart.abandoned` events published — as `[pubsub:stub] would publish`, because
dev's transport is the logging stub. **No event was delivered to anything** (RULE
#4). Run a second time: `found: 0` — idempotent, so a retried or overlapping run
cannot double-announce.

Database after:

```
walked away | 5
came back   | 5
in progress | 0
```

**Still owed: the confirmation on her screen.** api-rest is not running
(nothing listening on 3100, only SYN_SENT), so the console cannot refetch and the
Baskets pane is showing its cached window with "Syncing…" in the status bar. The
run cannot restart it — the dev lifecycle is Brandon's. When api-rest is back:
open Baskets left behind, and the five must be under **Walked away** with the
"Nothing here" state gone. Until that is done this issue is not closed, and it is
recorded as owed rather than assumed (RULE #3 beat 3).

## Still open, noted not filed

`cart.abandoned` now fires and **nothing subscribes to it**. There is no
automation trigger for it and no recovery email. The sweep is the prerequisite —
the event could not fire before, so nothing could have been built on it — but a
basket landing in a tab is not yet a shopper being followed up, which is what the
empty state promises ("it lands here so you can follow it up"). That is a
product decision about what the follow-up should be, not a bug to fix quietly.

## The lesson worth keeping

Every part of this feature was reviewable and every part looked right. The
setting, the query, the marker, the event, the tab, the report — each one correct
in isolation, and no screen anywhere shows the thing they are missing, because
what they are missing is a clock. **A capability assembled from parts that each
pass review can still have never run once.** The only way this was ever going to
be found is somebody opening the tab and knowing what should have been in it.
