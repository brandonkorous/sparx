# 661 — The report on who is picking named a UUID

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 233
**Surface:** Stock — How fast you pack
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 233

## What she saw

Devi opened **How fast you pack** straight after working her first walk. The
whole point of the screen is in its second heading — **By picker** — and the
column under it read:

| Picker                                 | Units/hr | Lines | Scanned | Short |
| :------------------------------------- | -------: | ----: | :------ | ----: |
| `db9c1296-1ed4-4109-90ba-adfc090adf50` |      0.0 |     1 | 0%      | 50.0% |

That string is her. `pick_lifecycle` stamps a picked line with
`ctx.userId ?? list.assignedTo ?? null`, so the ordinary case — a walk worked by
somebody signed in — stores a login id, and `pick-analytics.ts` groups by it and
hands it to the screen as a label.

It is a perfectly good IDENTITY. It is not a name, and the one report that exists
to say who is quick and who keeps coming up short printed thirty-six characters
of hex where the person goes.

Same shape as the transfer refusal in
[656](656-i-could-not-move-58-buckles-that-are-on-my-shelf.md): the only part of
the exchange the owner could not read.

## What names one now

Two places, both read under the tenant's own row-level security, so an id
belonging to somebody else's business resolves to nothing rather than leaking a
name:

- the **logins** on this account (`users`, whose RLS policy is
  `tenant_id = current_tenant_id()`), and
- anybody on the **Team** screen linked to one, whose staff record wins, because
  that is the name the business actually uses for them.

A value that is not a uuid is already a name — it is the text the walk was
assigned to — and is shown as itself.

Where nothing can name it, the row says **"Somebody this account cannot name"**
rather than falling back to the hex. A business owner reading a UUID learns
nothing and can act on nothing; the raw value stays on the row as its `title` for
whoever is chasing it down.

Devi's row now reads **Devi Raman**.

## And the rate beside it was a measurement of nothing

The headline card read:

> **Units an hour**
> **0.0**
> 1 unit over 0 hours of picking

`activeMinutes` is the span between a walk's first and last confirmed line, so a
walk done in twenty seconds measures as zero minutes — and zero minutes divided
into one unit was reported as **0.0 units an hour**, which is a measurement of
somebody being infinitely slow, printed for work that actually happened. "0 hours
of picking" said the same thing twice.

A rate nobody could work out now says so:

> **Units an hour**
> **—**
> 1 unit picked, too close together in time to work out a rate.

Under an hour it counts in minutes, because "0 hours" is a rounding of real work
down to nothing. The per-picker column follows the same rule.
[[feedback_never_present_absence_as_measurement]]

## What is good here, and was already good

- The screen refuses to draw at all when nothing was picked in the window, rather
  than four zeroes and three empty tables.
- Each headline figure carries its own color, because a short rate of 14% and one
  of 0.4% are not the same news.
- **Shelves that keep coming up empty** said **"No shelf recorded"** for a
  location with no shelves, which is the honest heading rather than a blank.
- **Why things were not there** groups the shorts by the reason the picker gave,
  biggest first, which is where the story is.

## Files

- `wizeworks/packages/inventory/src/services/pick-analytics.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/{pick-throughput.tsx,picking-data.ts}`
- `piggles|sparx/apps/workbench/surfaces/inventory/picking-words.test.ts` (new)
