# 570 — "Every request has been answered", over a queue nobody has ever used

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, on My Team → Time off
**Surface:** `piggles|sparx/apps/workbench/surfaces/staff/time-off.tsx` · `wizeworks/services/api-rest/src/routes/v1/staff/schedule.ts` · `wizeworks/packages/staff/src/schedule.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

My Team → Time off. The pane opens on "Waiting on you":

> **Nothing waiting on you**
> Every request has been answered. **Switch to Everything to see what has already
> been decided.**

She has never had a time-off request. Nothing has been answered, nothing has been
decided, and the sentence sends her to a second pane that is also empty.

## Measured

```sql
select t.name, r.status, count(*)
from staff_time_off_requests r join tenants t on t.id = r.tenant_id
group by 1, 2;
```

| tenant        | status   | count |
| ------------- | -------- | ----- |
| WizeWorks LLC | approved | 1     |

**One request on the entire platform.** Every other business has been told every
request has been answered.

"All answered" and "nobody has ever asked" are the same empty list and opposite
facts. Only a total across the whole queue can tell them apart, and nothing was
sending one.

## The second defect, on the same endpoint

Reading the route to add that total turned up a comment describing a bug it
still had:

```ts
const rows = await listTimeOff(auth.tenantId, query);
return ok({
  items: rows.map(timeOffView),
  // The queue's badge count. Sent rather than counted client-side because a
  // filtered list would otherwise report "0 waiting" whenever someone had
  // narrowed it to approved requests.
  requestedCount: rows.filter((row) => row.status === 'requested').length,
});
```

`rows` **is** the filtered list. `listTimeOff` applies `query.status` in its
`where`. So narrowing to Approved returns approved rows, none of which are
`requested`, and `requestedCount` comes back 0 — which is the case the comment
was written to prevent.

What that costs: the console shows a banner, "3 requests waiting · Review them",
whenever `waiting > 0 && filter !== 'requested'`. On Everything it works, because
the query is unfiltered. On Approved — the view an owner opens to check who is
off next week — the banner is silently absent. The one place the nudge was for is
the one place it never fires.

Not visible today, because only one request exists anywhere. It would have been
the moment a second one did.

## The fix

**A count that cannot be narrowed by the thing it exists to see past.**
`countTimeOff` in `@wizeworks/staff` groups by status over the whole queue.
`staffMemberId` still narrows it — a page about one person should count that
person — but `status` never does, by construction rather than by care.

The route runs the list and the counts side by side and sends both
`requestedCount` and a new `totalCount`.

**Three sets of words for three states**, in `time-off-empty.ts` — branches, not
ternaries inside a sentence, so singular and plural each get their own:

| state                      | now says                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nothing ever asked         | **No time off asked for yet** — "Nobody has asked for time off, and none has been logged for anyone. When someone asks, or you log it for them, it appears here, and approved dates show on the schedule." |
| waiting view, 1 on record  | **Nothing waiting on you** — "The one request on record has been answered."                                                                                                                                |
| waiting view, N on record  | **Nothing waiting on you** — "All N requests on record have been answered."                                                                                                                                |
| approved view, N on record | **Nothing approved** — "None of the N requests on record were approved."                                                                                                                                   |

The zero state no longer offers "Switch to Everything", because there is nothing
there to switch to.

Her screen now reads, verified in the browser:

> **No time off asked for yet**
> Nobody has asked for time off, and none has been logged for anyone. When
> someone asks, or you log it for them, it appears here, and approved dates show
> on the schedule.

Ported to both consoles.

## Proven

**`time-off-empty.test.ts`** — 6 tests, both consoles. The last is a property:
a total of zero may not produce a sentence asserting anything HAPPENED to a
request. It matches phrases, not bare words, because the empty state legitimately
says approved dates show on the schedule — a fact about the future, not a claim
about a request.

Removing the zero branch:

```
× says nobody has asked when nobody has asked
× does not offer a second empty screen to look at
    expected 'All 0 requests on record have been answered…' not to contain 'Switch to Everything'
× never claims an answer on a queue with nothing in it
```

3 of 6 red, and "All 0 requests on record have been answered" is the sentence in
its plainest form.

**`schedule.integration.test.ts`** — 2 cases added against real Postgres. One
builds a queue with one waiting and one approved, asks for the approved list, and
asserts the count still sees the waiting one. Making `countTimeOff` honor a
status filter:

```
AssertionError: expected +0 to be 1
```

The other asserts a member nobody has filed anything for totals zero.

|                 |                                             |
| --------------- | ------------------------------------------- |
| staff           | **124 pass**                                |
| api-rest        | **525 pass** (90 files, DB suites included) |
| piggles console | **419 pass**                                |
| sparx console   | **331 pass**                                |
| typecheck       | staff, api-rest, both consoles all exit 0   |
