# 239 — Eight groups were out of date and the only way to fix them was one at a time

**Status:** fixed and confirmed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 8 — after the segment fixes landed
**Surface:** mypiggles › Customers › Groups of customers
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 8 — one press moved two groups to the counts predicted in advance

## What happened

Three repairs landed together — the bridge that was dropping segment events
([234](234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md)),
the arrival nobody watched
([235](235-she-imported-twenty-five-people-and-they-joined-nothing.md)), and a
built-in rule that contradicted its own description
([236](236-new-customers-meant-people-who-had-bought-recently.md)) — plus a
migration repairing the spend rollups
([232](232-jo-kim-paid-147-dollars-and-her-record-said-zero.md)).

Every one of those changes the ANSWER a group should give. None of them changes
the answer a group is currently STORING, because membership is materialised: it
is re-cut when a person changes or a rule changes, and nothing had done either.

So Devi's list read:

```
At Risk                     No members yet
B2B Fleet                   No members yet
Early Access                No members yet
High Value                  No members yet
New Customers               1 customer
Newsletter Subscribers      No members yet
Bought in the last 90 days  2 customers
Email engaged               No members yet
VIP customers               No members yet
```

The true answers, computed against the repaired data, are **4** and **29**.

The remedy existed: **Update membership**, on a group's own screen. But it is
only there. Nine groups meant opening nine panes and pressing nine buttons, and
the list — the one screen where "these are all out of date" is visible — had
nothing to press.

## What should have happened

The remedy is reachable from where the problem is visible.

## Why it matters

This is not really about clicks. Staleness does not arrive one group at a time:

- built-in groups are **seeded**, so they all sit at zero **together** — which is
  the state every new business starts in;
- anything that stops events reaching the evaluator stops them for **every**
  group at once, which is exactly what [234] was;
- a data repair like [232] changes what **all** the rules see.

Every real cause is tenant-wide, so a per-group remedy is the wrong shape for
the problem. An owner who has just been told her customer records are now
correct, and whose groups still say otherwise, has no way to reconcile the two
short of a nightly job she cannot see and does not know about.

## Where it lives

Nowhere, which is the point — this is an absent capability, not a broken one.
`segmentService.recomputeFull(ctx)` **already** re-cuts every group for a tenant
when called with no `segmentId`; that is exactly how the nightly CronJob calls
it (`routes/internal/crm-cron.ts`). Only the HTTP surface and the UI were pinned
to one group:

```ts
app.post('/v1/crm/segments/:id/recompute', ...)   // the only way in
```

## The fix

A tenant-wide sibling of the route that already existed, declared before the
`:id` one so the static path wins the match, exactly as `preview-count` is:

```ts
app.post('/v1/crm/segments/recompute', ...)   // segmentService.recomputeFull(ctx)
```

and an **Update all** button in the Groups list toolbar, beside New segment,
reporting what moved: _"4 people moved in or out. Checked 29 customers against
every group."_ Or, when nothing did, _"Every group was already up to date"_ —
which is a real answer, not a silent no-op.

## The thing that had to be true first

A whole-tenant re-cut walks **every** group, and a hand-picked list has no rules
to re-derive membership from. Evaluating one would match nobody and remove
everybody — emptying a list somebody built by hand.

The evaluator already guards it, with one clause:

```ts
kind: 'dynamic',   // STATIC LISTS ARE NOT THE EVALUATOR'S BUSINESS
```

**Nothing tested it.** If that clause ever slipped, the nightly CronJob would
have quietly emptied every hand-picked list on the platform, and nothing would
have errored — the lists would simply be empty, which is what an empty list
looks like. So the guard is now asserted: a hand-picked list with three members,
carrying rules that match nobody, survives `recomputeFull()` with its three.

Proven red before being trusted green — with the `dynamic` clause removed it
fails `expected +0 to be 3`.

## What it looked like once fixed

One press of **Update all**, and the two counts written down in advance:

```
                            before   after
Bought in the last 90 days     2   →    4
New Customers                  2   →   29
```

The detail pane agrees with the bar — "4 of 29 match" over "Members: 4" — and
names them: Jo Kim, Anneliese Vogt, Tessa Wren, Ravi Naidoo. Jo Kim and
Anneliese are the two that [232]'s rollup repair let in.

The same button later filled "Newsletter Subscribers" with exactly the 22 people
who had opted in, which is what proved
[240](240-she-imported-her-mailing-list-and-the-mailing-list-group-stayed-empty.md)
was about the evaluator never running and not about the rule.

## Related

[234](234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md)
is the cause this remedy exists for, and its "What this does not fix" section is
what this closes. [232](232-jo-kim-paid-147-dollars-and-her-record-said-zero.md)
and [236](236-new-customers-meant-people-who-had-bought-recently.md) are the
other two repairs whose answers this is how an owner collects.

## Housekeeping done alongside

`segments-data.ts` was 312 lines and this touched it, so under RULE #0.5 it split
by responsibility: `segments-types.ts` (shapes + query keys), `segments-data.ts`
(reads), `segments-mutations.ts` (writes), `segments-lists-data.ts` (hand-picked
lists). The dependency runs one way — types ← mutations ← lists — and the reads
file re-exports all three, so every call site is unchanged.

## Rating effect

`Customers › Groups` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
