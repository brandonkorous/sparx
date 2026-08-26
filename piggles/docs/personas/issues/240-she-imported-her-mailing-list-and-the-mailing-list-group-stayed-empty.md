# 240 — She imported her mailing list, and the mailing-list group stayed empty

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 8 — re-running her import to close [238]
**Surface:** mypiggles › Move in from somewhere else › Move in — what happened
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 8 — a one-person import lands in both groups it matches, with nothing pressed

## What happened

With [238] fixed, Devi re-imported her mailing list. It went perfectly:

```
Your business is here
Everything below is now in your account.

Customers   25
            of 25 brought over
```

And in her records, exactly what the file said: **22 with marketing consent**,
all stamped `source: 'import'`, **0** with an invented `grantedAt`, and the
**3** who said no marked do-not-contact.

Then she opened Groups of customers:

```
Newsletter Subscribers    No members yet    Subscribed to marketing is yes
```

Twenty-two people had just told her yes, in writing, and the group whose entire
job is to hold those people was empty.

Pressing **Update all** filled it with **22 customers** immediately. That is what
proves the diagnosis: the rule was right, the projection was right, the consent
was right. Nobody had re-cut the group.

## What should have happened

Importing people who match a group puts them in it.

## Why it matters

This is the same failure as
[234](234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md)
and [235](235-she-imported-twenty-five-people-and-they-joined-nothing.md), one
layer further out, and it is the one that actually bites: **the mailing list is
imported precisely so it can be mailed.** An audience that silently contains
nobody is a campaign that reaches nobody, and every screen involved reports
success.

It also means [235] did not finish the job its own title describes. [235] added
`crm.customer.created` to the evaluator's watched topics, which fixed a contact
added THROUGH THE API. An import is not that.

## Where it lives

`customerService.create/update` publishes `crm.customer.created/updated`. The
segment evaluator subscribes to exactly those topics. They never meet, because
**they are not in the same process**:

- `registerCrmConsumers()` is called in **api-rest**, api-graphql and api-mcp —
  its own comment says "wire the **in-process** CRM consumers".
- Imports run in **import-worker**, a separate service, which registers none.

So the CRM→platform bridge asks `bus.consumes('crm.customer.updated')` inside
import-worker, correctly finds nothing subscribed, and forwards nothing. The
bridge is not wrong; there is genuinely no consumer in that process.

And nothing carries it across, either. The Pub/Sub bridge is **outbound** (a tee
on publish), event-worker's subscription list has no customer consumer, and
`platform-crm-worker` — the closest-sounding name — handles `tenant.*` and
`module.*` for the platform's own CRM, not tenant customers.

**Nothing anywhere consumes `crm.customer.created/updated` across processes.**

## The fix

The import knows it just changed a batch of customers, so it reconciles once
when the job finishes — `segmentService.recomputeFull(tenant)`, the same call
the nightly CronJob makes, in a new
[reconcile-segments.ts](../../../../wizeworks/services/import-worker/src/reconcile-segments.ts).

Three things it deliberately does:

- **Once per job, not per row.** A 9,000-row file would otherwise evaluate every
  segment 9,000 times.
- **Only for entities that can move membership** — `customers`, `orders`,
  `companies`, `b2b_accounts`. A redirects import does not pay for a tenant scan.
- **Never throws.** The rows are already written and the import already
  succeeded; failing to re-cut groups must not mark the job failed or trigger a
  redelivery that imports everything twice. It logs at error, and both the
  nightly recompute and [239]'s **Update all** are still there behind it.

Guarded by three tests driving the real seam, proven red first — without the
reconcile the group comes back `[]` instead of the two who opted in.

## What this does not fix, and is not yet proven

An **orders** import is reconciled by this too, but a segment rule reads a
customer's spend from the rollup COLUMNS, and those are maintained by another
in-process consumer (`order.created` → customer stats) in api-rest. If that
consumer is equally unreachable from import-worker, an orders import would leave
the rollups stale and this reconcile would faithfully re-cut against stale
numbers. **That is a suspicion, not a measurement — it has not been tested**, and
it is the same shape as [232](232-jo-kim-paid-147-dollars-and-her-record-said-zero.md).
Worth its own run.

## What it looked like once fixed

One new contact, Nadia Okonjo, `Accepts Marketing: yes`, imported through the
same screen. Nothing else touched — no **Update all**, no recompute:

```
                       before   after
New Customers            29   →   30
Newsletter Subscribers   22   →   23
```

She is in both, and the consent record behind it is the one the file justified
and no more:

```
{"scope": ["marketing"], "source": "import"}
```

No invented `grantedAt`. The import filled the groups by itself, which is the
repair.

## Related

[238](238-she-imported-a-mailing-list-and-got-contacts-instead.md) is what
uncovered this: fixing consent is what finally made the group's emptiness a
question about the group rather than about the data.
[239](239-eight-groups-were-out-of-date-and-the-only-fix-was-one-at-a-time.md)
is the manual remedy, and pressing it is what proved the rule was never at fault.

## Rating effect

`Move in › Run` and `Customers › Groups` in [rating.md](../rating.md). Recorded
in the run log of [03-juniper-row.md](../03-juniper-row.md).
