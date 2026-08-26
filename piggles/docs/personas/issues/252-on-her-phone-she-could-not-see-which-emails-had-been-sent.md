# 252 — On her phone she could not see which emails had been sent

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 10 — the 360px pass on the broadcasts list
**Surface:** mypiggles › Messages › Email campaigns (and the same shape in Automatic emails, Enrolled people)
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 10 — all three lists at 356px, Sent and Draft badges fully on screen, the table exactly fills its 338px pane instead of overflowing to 370px

## What happened

The broadcasts list at 360px, in dark. Three campaigns, and the Status column
sliced off down the right-hand edge:

```
Name                                     Statu│
Autumn drop announcement                   Sen│
{{customer.firstName}}, the autumn ...        │
Sale announcement                          Dra│
A little something for you                    │
Monthly newsletter                         Dra│
What's new at {{site.name}}                   │
◄──────────── sideways scrollbar ───────────► │
```

The table is 370px wide inside a 338px pane. The header reads "Statu", the
badges read "Sen" and "Dra", and the only way to see which is which is to drag
the list sideways.

## What should have happened

The one column that says whether an email has gone out is on the screen.

## Why it matters

**Sent and Draft is the whole reason to open this list.** Everything else on it
— the name, the subject, when — she already knows; what she comes here for is
which of these went to her customers and which is still a draft. That is the
column that fell off.

It is not merely truncated, it is _ambiguous_: "Sen" and "Dra" are both three
letters in a colored pill, and at a glance in a moving hand they read as the
same thing. A sideways scrollbar under a list is also the least discoverable
control on a phone — there is no affordance saying there is more to the right.

Piggles' own audience makes this worse than a desktop nit. This console is meant
to work for somebody standing in a workshop with a phone, and the responsive bar
is not a compliance exercise here.

## Where it lives

[broadcasts-list.tsx](../../../apps/workbench/surfaces/email/broadcasts-list.tsx):

```tsx
<td className="max-w-72">
```

`max-w-72` is 288px. The pane's other columns already collapse politely — Sent
to, When, Opened and Clicked are all `hidden @md:table-cell` and up, so at 360px
only Name and Status render. But 288 + 82 = 370, and the pane is 338. **The name
column's cap alone is wider than the phone.**

A fixed cap is a desktop number written as a constant. It was doing real work at
full width — without it a long subject line makes the name column swallow the
table — and no width below the one it was written at was ever looked at.

The same constant is on the identity column of two neighboring lists, both with
a badge as their last column: **Automatic emails** (`sequences-list`, `max-w-72`)
and **Enrolled people** (`sequence-enrollments`, `max-w-64` — 256 + 82 = 338,
exactly the pane width, so it clips the moment there is any padding).

## The fix

The cap becomes responsive, and it lives in one place. `IDENTITY_CELL` is
exported from [components/table.tsx](../../../apps/workbench/components/table.tsx)
— the workbench's existing Table composition, which was created for exactly this
kind of default:

```tsx
export const IDENTITY_CELL = 'max-w-40 @sm:max-w-56 @md:max-w-64 @2xl:max-w-72';
```

160px on a phone, widening with the container to the 288px it always had on a
desktop. The three email lists adopt it.

A constant rather than a per-list value because the number is not a property of
broadcasts — it is the answer to "how much room may an identity column take
before it pushes the status off the screen", and that answer is the same on
every list in the console. Changing it later changes it everywhere, which is the
point of putting it there rather than typing a ladder into three files.

## The rest of the console — named, not swept

Every list whose identity column has a fixed cap AND no `hidden` prefix is the
same shape. The ones found while fixing this, none of them opened as Devi and so
none of them verified at 360px:

| Surface                   | Cap        |
| ------------------------- | ---------- |
| Automations › Automations | `max-w-64` |
| Sell › Bundles            | `max-w-64` |
| Sell › Groups of products | `max-w-64` |

Not changed here: a cap adjusted on a screen nobody looked at is a layout change
made blind, and this run's rule is that a pane is not judged until it has been
seen. They are listed so the next run that opens one knows what to check, and
`IDENTITY_CELL` is waiting for them.

Columns carrying a `hidden @lg:table-cell` and up are unaffected — they do not
render at the widths where this bites.

## What it looked like once fixed

At 356px, all three lists: the table measures 338px inside a 338px pane — the
overflow is gone rather than merely smaller — no sideways scrollbar, and **Sent** and **Draft** render whole in their own colors.
The name still truncates, which is what a name column is supposed to do.

## Related

Found during the RULE #6 pass that also turned up
[251](251-nobody-opened-it-was-green-and-twenty-three-went-out-was-grey.md).
Both were invisible at desktop width in light, and both are on the pane
[246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md) had
just been fixed on.

## Rating effect

`Messages › Broadcasts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
