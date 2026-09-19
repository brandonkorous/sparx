# 577 — Told my emails are counted as opened, when nothing counts opens

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, on Customers → Email templates
**Surface:** `piggles|sparx/apps/workbench/surfaces/crm/templates-list.tsx` · `piggles/apps/workbench/lib/console/copy.ts` · `wizeworks/packages/crm/src/services/sales-template-service.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_never_present_absence_as_measurement]] · [[feedback_screen_over_a_function_nobody_calls]]

## What she saw

> **Write the email you keep retyping**
> A saved subject and message your team can pick when they email a customer, so
> the fourth follow-up this week reads as well as the first. **We then count how
> many were sent, opened and answered**, which is how you find out which of your
> own words work.

Three things counted, and the sentence puts the whole point on them: this is how
you find out which words work.

## Measured

`SalesTemplate` has three counters, all `@default(0)`:

```prisma
sendCount  Int @default(0) @map("send_count")
openCount  Int @default(0) @map("open_count")
replyCount Int @default(0) @map("reply_count")
```

Grepping for every writer, across the whole tree:

```ts
engagement-service.ts:221  if (input.templateId) await bumpTemplate(tx, input.templateId, 'sendCount');
engagement-service.ts:505  if (input.inReplyTo)  await bumpTemplateForReply(tx, input.inReplyTo);   // replyCount
```

**Two of the three are written. `openCount` has none.** `bumpTemplate` accepts
the field in its signature, so the shape is there and nothing fills it: a
one-to-one sales email carries no open beacon, so there is nothing to record.

The list itself is fine — it shows **sent** and **answered** and never draws an
open figure, which is why this survived. The lie is in the sentence.

## The second half, in the service

```ts
openRate: row.sendCount >= floor ? row.openCount / row.sendCount : null,
```

Over a counter nothing increments, that is `0 / N` — a confident **0%**, "nobody
opened it", for a template that may well have been read by everyone. A floor of
five sends hides it on a quiet account; a busy business clears the floor in its
first week.

Nothing renders `openRate` today. It is in `TemplatePerformance`, it is in the
console's own `engagement-data.ts` type, and it is one surface away from being
drawn on every row as a measurement nobody took.

## The fix

**The sentence says what is counted**, in both consoles and in Piggles's copy
override:

> We then count how many were sent **and how many got an answer**, which is how
> you find out which of your own words work.

**And the absence is made structural**, not accidental. `openRate` is typed
`null` and returned `null`, with the reason written where the next person will
read it before reaching for it:

> _Kept in the shape, and kept NULL, deliberately. `openCount / sendCount` over a
> counter nothing increments returns a confident `0` … A value nobody measured
> must never render as one, so the absence is stated here rather than left for a
> future surface to discover by drawing 0% on every row._

## Proven

**`engagement.test.ts`** — its own tenant, a template sent six times so it clears
the floor of five, then `templatePerformance` is asked for its rates. Restoring
the division:

```
× never reports an open rate, because nothing measures opens
    AssertionError: expected +0 to be null
```

The defect in its plainest form. The test also had to take its own tenant: a busy
template sorts to the top of `listTemplates` (sendCount desc), which the
neighbouring archive test reads as `[0]`.

|                 |                           |
| --------------- | ------------------------- |
| crm             | **523 pass** (56 files)   |
| piggles console | **437 pass**              |
| sparx console   | **349 pass**              |
| typecheck       | crm, both consoles exit 0 |

## Still open, and not mine to decide

Open tracking for one-to-one sales email is a **new capability**, not a defect:
it means putting a tracking beacon in a personal message a salesperson writes to
one customer, which is a product and privacy choice with real arguments on both
sides. The three counters, the `bumpTemplate` signature and the `openRate` field
are all still there ready for it. The copy no longer promises it in the meantime.
