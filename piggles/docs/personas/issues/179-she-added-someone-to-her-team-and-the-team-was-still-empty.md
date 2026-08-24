# 179 — She added someone to her team and the team was still empty

**Status:** fixed — confirmed
**Severity:** blocker (the roster cannot see the people on it)
**Found by:** P03 · Juniper Row · confirming [120](120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md)
**Surface:** mypiggles › My Team › People
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Devi Raman

## What happened

My Team was empty, so I added the first person: **Priya Nandakumar**, repotting and
plant care. The toast said **"Added to your team"**. The pane retitled itself to her
name, her record loaded, every section on it worked, and the Appointments switch put
her on the booking page.

Went back to the roster. **"No one on the roster yet."**

Pressed **Everyone** — the filter that exists to show people who have left, been
suspended, or not started. Still nothing. One person in the database, one person with
an open pane two tabs away, and a roster insisting nobody works here.

Then added a second person from the OTHER door — Bookings › People and equipment —
and **that** one appeared on the roster immediately. Two people added minutes apart,
one visible and one not.

## Why it happened

`listMembers` scopes the roster to a site:

```ts
...(query.propertyId ? { siteLinks: { some: { propertyId: query.propertyId } } } : {}),
```

A person with **no site links matches nothing**. And the person form only shows the
"Which business they work for" picker when the owner has more than one business —
correctly, because with one business there is no choice to make. So the form sends
`siteIds: []` every time, `replaceSiteLinks` had:

```ts
if (siteIds.length === 0) return;
```

and wrote no rows. **Every person a single-business owner added disappeared on save.**

Piggles sells one business, one location, one primary site as the whole plan (RULE #2).
So this was not an edge case. It was the default.

The second person survived because she came through the pairing added for
[120](120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md), which
writes the links itself.

## Why it hid

The record was correct in every other way. The person existed, loaded, saved, held a
pay rate, could be clocked in and could be booked. Only the LIST was wrong, and a list
with nothing in it renders exactly like a list of nothing — which is
[the shape that hides best](../rating.md), and the same one
[120](120-her-two-stylists-are-staff-in-bookings-and-nobody-in-my-team.md) is about.

The empty state made it worse by being encouraging: _"Add the people who work for you
and we can keep their hours"_ — an invitation to do the thing she had just done.

## The fix

**Nobody is nowhere.** An empty site list means every business, never none:

```ts
const ids = siteIds.length > 0 ? siteIds : await everySite(client);
```

`everySite` orders the tenant's properties with the main one first, and the first link
is flagged primary — a person always has somewhere their cost lands when a shift names
no business of its own.

This is deliberately not a fix to the FILTER. `StaffMemberSite.isPrimary` is where a
wage lands, so a person genuinely needs at least one row; treating "no rows" as
"everywhere" at read time would leave that question unanswered.

`wizeworks/packages/staff/src/members.ts`.

## Confirmed

Re-saved Priya. She is on the roster, above Tomas, with her job title under her name.
Both were added through different doors and both are on one list.

## How to reproduce (before the fix)

1. A business with one site — every Piggles tenant by default.
2. My Team › People › Add someone. Fill in a first name. Save.
3. Toast says added. Roster says empty. Every time, including under **Everyone**.
