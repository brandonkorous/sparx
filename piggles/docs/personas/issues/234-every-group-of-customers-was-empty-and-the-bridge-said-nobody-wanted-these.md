# 234 — Every group of customers was empty, because a bridge had been told nobody wanted these events

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 8 — building the "bought in the last 90 days" segment
**Surface:** mypiggles › Customers › Groups of customers
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 8 — the same segment now fills itself on save: **2 customers**, Tessa Wren and Ravi Naidoo, named on the screen

## What happened

Devi opened Groups of customers. Eight groups, and every one of them said the same
thing:

```
At Risk                  No members yet
B2B Fleet                No members yet
Early Access             No members yet
High Value               No members yet
New Customers            No members yet
Newsletter Subscribers   No members yet
Email engaged            No members yet
VIP customers            No members yet
```

She built a ninth. The rule builder counted as she typed — **"2 of 29 match"** —
she pressed Create, and the screen showed her both answers at once:

> **2 of 29 match** (in the bar)
>
> **In this segment now**
> The saved membership, refreshed after you save changes to the rules.
> Members: **0** · No members yet

The panel promising it refreshes on save had just not refreshed on save, and the
count beside it disagreed with it by the width of the pane.

## What should have happened

The group contains the people the builder counted.

## Why it matters

A group of customers is not a report — it is **who a marketing email goes to**. An
audience that silently contains nobody means a campaign that reaches nobody, and
the failure is invisible in the only place an owner would look: the group looks
made, it has a name, it has rules, and the number beside it is a number.

It was also every group, on every tenant, for as long as the code had been there.

## Where it lives

Three files, each individually reasonable.

**The consumer was right.** `segment-evaluator.ts` had already grown the
segment-driven pass, with a comment stating the problem exactly:

> A NEW SEGMENT HAS TO FILL ITSELF, and nothing made it. […] The builder counted
> "24 of 24 match" while you typed the rules, you pressed Create, and the list
> said "No members yet".

**The publisher was right.** `segmentService.create` publishes
`crm.segment.created` on the CRM bus.

**The bridge between them dropped it.** The two buses are separate, and
[platform-fanout.ts](../../../../wizeworks/packages/crm/src/consumers/platform-fanout.ts)
is the only thing joining them. It carried a hand-kept allowlist:

```ts
const FORWARD_TOPICS: ReadonlySet<string> = new Set([
  'crm.customer.updated',
  'crm.customer.subscribed',
  'crm.activity.recorded',
  'crm.b2b.account_updated',
]);
```

above a comment asking whoever came next to keep it in sync — and naming, as its
example of what to leave out, the very topics that later grew subscribers:

> Keep in sync with the evaluator's watched topics — forwarding a topic nothing
> consumes just burns a dispatch.
>
> so we don't double-dispatch the long tail (crm.deal.\*, **crm.segment.\***, …)
> that nothing consumes locally.

**Seven live topics were being dropped.** Two segment ones, and five belonging to
scoring — `crm.deal.created`, `crm.deal.updated`, `crm.deal.stage_changed`,
`crm.deal.closed`, `crm.engagement.received` — so **deal scoring had never run
either**. Nothing errored, because a bridge declining to forward is not a failure.

**And the test for this was written so it could not catch it.** There was already
a `segment-fills-itself.test.ts`. It passed. It called `recomputeFull` by hand and
explained why:

> What the consumer does on `crm.segment.created`. Called directly because the bus
> is not running in an integration test — the subscription itself is one line, the
> arithmetic underneath it is what can be wrong.

The one line was the wrong thing. The arithmetic was fine the whole time. (The bus
_does_ run in this package's integration tests — `consumers.test.ts` registers it.)

## The fix

**The allowlist is gone, and nothing replaced it.** The bridge asks the bus
whether anything in this process handles the topic:

```ts
if (!this.bus.consumes(event.topic)) return;
```

`PlatformEventBus` gained `consumes(topic)`; the in-memory bus answers from its own
handler map, and the Pub/Sub-backed wrapper delegates to the bus that owns the
subscriptions. **Subscribing is now what makes an event forwarded** — there is no
second list to remember.

The dispatch the allowlist claimed to save was never real: `publish` already
returns immediately for a topic with no subscriber, by the same Map lookup.
The set bought nothing except a way to be wrong.

**Two guards, both shown to go red first.** A unit test — which runs in CI, where
the integration suites do not — asserts the property rather than the topic list:
_a topic forwards because something subscribes to it_, including one case that
subscribes mid-test and watches forwarding begin. And `segment-fills-itself.test.ts`
now goes through the bus, exactly as pressing Create does.

**Two things fixed on the way.** `recomputeFull(segmentId)` was narrowing only its
_tally_ while still re-deriving every other group for every customer — on the one
path an owner waits on. And the consumer's comment claimed the owner does not wait
for the scan; on an in-process bus they do, which is why Create now returns with
the group already filled. That is the honest trade and it is now written down,
with the trigger for revisiting it.

## What it looked like once fixed

Same segment, same save:

```
2 of 29 match          ← the bar
Members: 2             ← the panel
  Tessa Wren    tessa.wren@example.com    Individual
  Ravi Naidoo                             Individual
```

The two numbers agree, which is the actual repair.

## What this does not fix

**Groups created before this landed stay empty until something touches them.**
Membership is derived by the rule engine in application code, so no migration can
re-cut it. The nightly `crm-segment-recompute` CronJob (05:00 UTC) walks every
dynamic segment for every active tenant, so production self-heals within a day;
an owner who wants it sooner has **Update membership** on the group itself, which
works and says what it does in its tooltip.

## Related

The other half of "the group is empty" is
[235](235-she-imported-twenty-five-people-and-they-joined-nothing.md) — a person
who is ADDED was never evaluated either. The count Devi was checking against was
itself wrong for a different reason,
[232](232-jo-kim-paid-147-dollars-and-her-record-said-zero.md), which reaches this
surface through the same rollup columns — and shares its mechanism, a consumer whose
failure nothing surfaces. The column that would have made this visible from the list
was itself broken: [237](237-nine-groups-and-the-same-three-words-beside-every-one.md).

## Rating effect

`Customers › Groups` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
