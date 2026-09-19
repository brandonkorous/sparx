# 582 — A team that has all left reads as a team I never had

**Status:** fixed and proven
**Severity:** medium
**Found by:** a sweep of directive copy, after [581](581-blamed-for-a-filter-i-never-touched.md)
**Surface:** `piggles|sparx/apps/workbench/surfaces/staff/{people.tsx,data.ts}`
**Filed:** 2026-09-16
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_one_outcome_two_causes]]

## How it was found

After the Questions pane turned out to be blaming a filter nobody set, I scanned
both consoles for every sentence that sends a reader to a named control —
"switch the filter to All", "set one up under Scheduling", "use the Grant credit
button". Each of those is a promise that the control exists, is reachable, and
will help.

**1,327 files, 13 candidate sentences.** Eleven belong to panes that open on a
neutral filter, so the sentence only ever appears when the reader really did
narrow something. One was the Questions pane, already filed. One was this.

## The defect

My Team → People opens filtered to `status = 'active'`:

```ts
const [status, setStatus] = useState<string>('active');
const { data } = useStaffMembers({
  ...(status === 'all' ? { includeArchived: true } : { status: status as never }),
```

With nothing in that view, the pane said:

> **No one on the roster yet**
> Add the people who work for you and Piggles can track their hours, what those
> hours cost, and when their tickets and licenses run out.
> **[Add someone]**

A business whose last employee has left is told it has never had one, and offered
the button it would press on day one. Every hour they worked, every cost, every
certificate is still on file and there is nothing on the screen to say so.

The search branch was already correct — it keys on `search.trim()`, which the
person really did type. It was only the roster-is-empty branch that took the
pane's own default as the whole truth.

## Measured, and stated plainly

```sql
select status, count(*) from staff_members group by 1;   -- active: 31. Nothing else.
```

**No tenant is in this state today.** Every staff member on the platform is
`active`, so the wrong sentence has never been shown to anybody. The path is
real, though — `archive` sets `status: 'former'` and the pane offers the control
— and the first business to let its last employee go would see it.

Filed as what it is: a reachable defect with zero instances, fixed because the
fix is four lines, not because the screen is on fire.

## The fix

> **Nobody is working for you right now**
> Everyone on your roster has left, so this view is empty. Switch the filter to
> Everyone to see them, their hours and what they cost — none of it has gone
> anywhere.

The probe asks for everyone including the archived, and only when the answer
could matter: this view is empty, nothing was typed, and it is not already
showing everyone. `enabled` is deliberately OUTSIDE the query key — it says
whether to ask, not what was asked — so it shares the cache entry with the
caller that wants the rows.

## And a spelling drift, found on the same screen

The sparx console said **"Tickets and licences"** in a pane title, a section
heading, a field description and a nav entry; Piggles said "licenses". Also
"fulfilment" in an inventory hint.

Corrected, and guarded — see [583](583-a-spelling-guard-that-could-not-see-a-spelling.md),
which is the more interesting half of this.

## Proven

Layout and copy over a state no tenant is in, so it is proven by the branch and
by the sweep rather than by a fixture: the roster-empty sentence now depends on a
count taken past the pane's own filter, and the search branch is untouched.

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **474 pass** (56 files) |
| sparx console   | **376 pass** (47 files) |
| typecheck       | both exit 0             |
| console parity  | PASS                    |
| lint / prettier | clean                   |

## Checked and cleared

The other eleven directive sentences. Automations, content types, redirects,
collections, discounts, product types and supplier products all open on `all`;
invoicing workflows (`active`), help requests (`open`) and booking series each
compare against their OWN default rather than against a neutral value, so none of
them reports the opening view as a filter.
