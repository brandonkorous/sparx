# 104 — A two-chair salon could not let a client choose their stylist

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 6
**Surface:** mypiggles › Bookings › Services › a service — and the published booking page
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia and a client · on screen and on the live site 2026-08-22

## What happened

Nia's first reason for buying this software, in her own words, is **"clients book
themselves, without ringing me."** Her homepage says how that works:

> **You book a person, not a slot.** There are two of us, and we each keep our own
> diary. Choose Nia or Dara when you book, and that is who you get.

A client opened the booking page for **Cut and finish** and was offered: a date, a
grid of times, name, email, phone, and a notes box. **No stylist.** Nothing on the
page mentions Nia or Dara at all. Whoever the engine picked, she got.

## The picker exists. It was hidden from every service where the choice is real.

The public widget already supports this — `customer_choice` on a service draws a
"Choose your team member" row. And the console already has the setting, worded
well:

> **Let the customer choose** — The customer picks who they want when they book.

But the control that sets it was inside this condition
([surfaces/scheduling/service-requirements.tsx](../../../apps/workbench/surfaces/scheduling/service-requirements.tsx)):

```tsx
{requirements.length > 0 ? ( … the strategy select … ) : null}
```

`requirements` is the "Who or what it needs" list — the skill rules that NARROW a
service to particular people. So the setting appeared exactly backwards:

| Service              | Who can do it         | Strategy control                        |
| -------------------- | --------------------- | --------------------------------------- |
| Barbering, skin fade | Dara only (barbering) | **shown** — a choice between one person |
| Beard trim and shape | Dara only             | **shown**                               |
| Full head highlights | Nia only (colour)     | **shown**                               |
| **Cut and finish**   | **either**            | **hidden**                              |
| **Dry cut**          | **either**            | **hidden**                              |
| **Blow dry**         | **either**            | **hidden**                              |

Every service a client might actually want to choose a person for hid the setting;
the three where the answer is forced showed it.

**The label kept it hidden even when it showed.** "When more than one is needed"
reads as being about needing two things at once — a stylist AND a room — which is
what `collective` ("Everyone at once") means. Somebody looking for "let them pick
their stylist" has no reason to open it.

## Why it matters

This is the promise the persona exists to test, and it failed silently. Nia set up
two people with different hours and different skills, wrote "choose Nia or Dara"
on her own homepage, published it — and the booking page offered no such thing.
Her regulars, who come back to the same person, would have had to ring her, which
is the exact problem she bought this to solve.

Silent in the way that costs most ([[feedback_absent_behaves_like_fine]]): a
booking form with no stylist picker looks just like a booking form that does not
need one.

## How to reproduce

Every time, before the fix.

1. Bookings › Services › a service with nothing under **Who or what it needs**.
2. Look for a way to say who takes the booking. There is none.
3. Open that service on the published site: no picker.

## The fix

**The question is always live, so the control is always there.**

```tsx
<Field>
  <FieldLabel>Who takes the booking</FieldLabel>… the strategy select …
</Field>
```

Two details:

- **Relabelled** from "When more than one is needed" to **"Who takes the booking"** —
  which is the question it answers, in the words somebody would search for.
- **"Everyone at once" is filtered out when there are no requirements.** That one
  option genuinely needs listed roles to hold at once, so it only means something
  once something is listed. Hiding the whole control to hide one option was the
  original mistake; hiding the option is the precise version.

The file crossed 250 lines with the change, so the "who fits this requirement"
helpers (`parseSkills`, `whoFits`, `inWords`, `FitLine`) moved to
[service-fit-line.tsx](../../../apps/workbench/surfaces/scheduling/service-fit-line.tsx)
— one file, one responsibility (piggles/CLAUDE.md RULE #0.5).

## Confirmed by

Re-run 2026-08-22, as the owner and then as the client:

1. Bookings › Services › **Cut and finish** now shows **Who takes the booking** with
   Whoever is free · Share the work evenly · Let the customer choose. Set to
   "Let the customer choose", saved.
2. The published page for that service now opens with
   **Choose your team member — Any available · Dara Bell · Nia Okafor**, above the
   date, and the times reload when the choice changes.

## What this turned up next

Two things worth their own attention, recorded in act 6 rather than here:

- **Nothing stops Dara being booked for colour.** Root tint, Toner and gloss and
  Colour consultation carry no skill requirement, so the engine will hand them to
  whoever is free — and Dara has `cut, barbering, styling`, not `colour`. That is
  a setup gap in act 4, fixed as Nia rather than filed.
- **The default is "Whoever is free" for every new service**, which is right for a
  van or a table and wrong for a salon chair with a name on it. Whether the default
  should follow the trade is a product question, not a defect.

## Rating effect

`Bookings › Services › detail` is re-scored in [rating.md](../rating.md).
