# 784 — "What happens when" showed no stages on a phone

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 276
**Surface:** mypiggles + sparx workbench — `invoicing.workflows`
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

At a 360px pane the list is four columns down to one:

```
Name
─────────────────────
Invoice   Default
invoice

Commission weave
commission-weave

Service / Repair
service-repair
```

Six names, six reference names, and nothing about what happens. The screen is
called **What happens when**; at phone width it answered none of it.

The file knows this is the point. Its own header says so:

> The stage chain is the column that matters — "Service / Repair · 5 stages"
> says nothing an operator came here to learn, whereas Estimate › Approved ›
> Invoiced › Paid answers "which of these do I want" without opening anything.
> **It is the widest thing here, so it discloses at @xl.**

The chain was also on each row's `title`, as a tooltip. A phone has no hover.

## The other half: a column that never varied

The filter defaults to **Active**, the server filters on it, and the table then
printed a **State** column reading "Active" on all six rows. A badge that cannot
differ is noise wearing a component, and it was holding width that the stage
chain needed. RULE #4: if every row says it, it cannot be a column.

## What was done

**The chain moves under the name below @xl**, the same way the Business column
folds under the name in the print-templates list next door. Plain text rather
than the badges: at 360px a wrapped row of pills is three times the height and
says the same thing.

```
Invoice   Default
invoice
Invoice › Receipt › Canceled

Commission weave
commission-weave
Deposit due › Final bill
```

**`chainText` stopped returning an empty string** for a workflow with no stages.
A blank line there reads as "we failed to load it" rather than "nothing can be
created on this", which is what the wide column already said. It now says the
same sentence in both places.
[[feedback_never_present_absence_as_measurement]]

**The State column appears only when it can differ** — under Archived or All,
never under Active. A sort on State is cleared when the filter returns to
Active, so the sort can never outlive the header that undoes it.

## Proof

360px, both consoles, host width set on the pane rather than by resizing the
window:

```
scrollWidth === clientWidth === 360     no horizontal scroll
every row carries its chain             Invoice › Receipt › Canceled
Active                                  Name + chain, no State column
All                                     State column back, Active / Archived badges
```

The editor at the same width was checked with it and is fine as built: the two
panes stack behind a Flow / Properties switch, the stage cards wrap their badges
and their effect sentences, and Add a stage stays reachable.

## Files

- `piggles|sparx/apps/workbench/surfaces/invoicing/workflows-list.tsx`
