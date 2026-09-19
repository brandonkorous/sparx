# 576 — A reply clock with no rule behind it

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, on Customers → Response times
**Surface:** `wizeworks/packages/crm/src/services/ticket-service.ts` · `wizeworks/packages/db/src/sample-data/engine/support.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_never_present_absence_as_measurement]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Customers → Response times, on a tenant with no requests:

> **No response times set up yet**
> A response time is your promise about how quickly you will get back to
> someone, and it is counted only during the hours you are open, so a message
> that arrives on a Sunday night is not late on Monday morning. **One is created
> for you the first time a support request comes in.**

That last sentence is a contract. Help requests makes the same promise from the
other side: "Every one gets a reply time based on the hours you work."

## Measured

```sql
select t.name, count(distinct k.id) tickets, count(distinct p.id) policies …
```

| tenant            | requests | response times on file |
| ----------------- | -------- | ---------------------- |
| The Marrow Review | 5        | **0**                  |
| Wildroot Flowers  | 5        | **0**                  |
| WizeWorks LLC     | 1        | 1                      |

**10 of the 11 requests on the platform belong to a business with no promise at
all** — and every one of those rows still carries a `first_response_due_at`, so
their queues show live clocks, a breached badge and an amber badge, drawn from a
rule that does not exist on the one screen that would explain it.

Two separate causes, both real.

## Cause one: the bootstrap was nested one level too deep

```ts
if (!pipelineId || !stageId) {
  const fallback = await ensureTicketPipeline(tx, ctx.tenantId);
  …
  if (input.slaPolicyId === undefined) {
    await ensureDefaultPolicy(tx, ctx.tenantId, business?.timezone);   // ← inside
  }
}
```

A promise has nothing to do with WHICH queue a request lands in, but the call
that creates it sat inside the branch that resolves the queue. So a caller that
named a pipeline — the MCP tool, or any API client posting `pipeline_id` —
skipped the bootstrap. If that was the tenant's **first** request,
`resolveForTicket` then found nothing, `computeDueDates` returned `NO_DATES`, and
the request arrived with **no deadline at all**, silently, while Response times
went on promising one gets created.

The console's own New request form, the website-form intake, the customer portal
and the bulk importer all name no pipeline, so all four were fine. The hole is
narrow and it is on the API surface, which is the one nobody watches.

**Now:** the bootstrap runs for every create where the caller did not explicitly
name a policy. Explicit `null` still means "no promise on this one", which is a
deliberate choice somebody made and not an accident.

## Cause two: the sample data writes a clock and no rule

`applySupportRequests` in the sample-data engine writes five requests directly,
with hand-placed deadlines. Its own header explains why, and the reasoning is
good:

> _THE DUE DATES ARE WRITTEN DIRECTLY, not computed from the policy … because a
> demo has to show a breached request NOW rather than nine working hours from
> whenever someone happened to press Load._

That is a decision about the **dates**. It was silently also a decision about the
**policy**, which the slice never created. So loading sample data produced a
business state the product itself cannot produce: five live clocks and a Response
times screen saying none exist.

**Fourth time in two sittings** that a comment stated its own rule and missed the
consequence beneath it.

**Now:** the starter promise is created alongside the queue, the same way the
slice already creates the support pipeline "kept in step by hand" because
`@wizeworks/db` sits below `@wizeworks/crm`. The hand-placed dates are unchanged.
Every sample request names the policy, so the owner can find, read and edit the
rule they are measured against. It is not removed by Clear, for the same reason
the support queue is not: it is the setup a business keeps, and it is exactly the
row the product would have created on its own.

## Proven

**`tickets.test.ts`** — a fresh tenant, a request filed straight into a named
queue. Re-nesting the bootstrap:

```
× sets the promise up even when the first request names its own queue
    AssertionError: expected +0 to be 1
```

**`sample-support-promise.test.ts`** (new, api-rest) — loads the florist pack
with crm alone, then asserts one default policy with its targets, and that every
request showing a deadline names it. Removing the policy from the seeder:

```
× leave a promise on file that every one of them names
    AssertionError: expected [] to have a length of 1 but got +0
```

|           |                                             |
| --------- | ------------------------------------------- |
| crm       | **523 pass** (56 files)                     |
| api-rest  | **526 pass** (91 files, DB suites included) |
| typecheck | crm, db, api-rest exit 0                    |

## Still open

The two tenants already carrying sample requests keep their policy-less clocks
until somebody re-loads their sample data or files a real request, which now
creates one. Nothing is lost by leaving them; naming it here rather than running
a hand-written backfill over the shared database.
