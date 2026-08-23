# 132 — The diary on a phone never says what day it is

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Bookings › Calendar, at 390px
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Act 10 was "open tomorrow's appointments" on a phone. The diary opened on an
empty toolbar — a blank capsule with one hamburger — above three columns headed
**Mon 17 · Tue 18 · Wed 19**. No month. No year. Today was Saturday the 22nd.

Four things, all of them the same failure: the diary would not say where in time
you are.

1. **The date was hidden.** `<Text className="hidden … @sm:block">` on the label,
   whose own comment says "in the day view especially — whose columns are
   resource names, not dates — this is the ONLY thing naming the day." In Day
   view the columns are "Dara Bell" and "Nia Okafor", so nothing on the screen
   named the date at all.
2. **Today was off-screen.** Seven columns at their floor width are wider than a
   phone, so a week is a horizontal scroll — and it opens on Monday. On a
   Saturday, today sat three columns to the right, past the edge. Pressing
   **Today** did nothing visible, because the anchor was already inside this week.
3. **Two chairs did not fit.** Day view gives each resource a 12rem floor; two of
   them plus the gutter is 440px in a 357px pane, so the second chair's name was
   cut in half and half its column was off the edge.
4. **Scrolling sideways took the clock with it.** The hour gutter was not sticky,
   so the moment the grid scrolled the time axis left with the leftmost column
   and the diary became blocks against nothing.

## Why it matters

A diary answers one question — what is on, and when — and the phone is where it
gets asked. Every one of these is that question refusing to be answered on the
device it is asked from. The console's own compact shell claims "full mobile
parity"; this is the pane where the claim fails hardest.

## Where it lives

- [surfaces/scheduling/calendar-toolbar.tsx](../../../apps/workbench/surfaces/scheduling/calendar-toolbar.tsx)
- [surfaces/scheduling/calendar-timegrid.tsx](../../../apps/workbench/surfaces/scheduling/calendar-timegrid.tsx)
- [surfaces/scheduling/calendar.tsx](../../../apps/workbench/surfaces/scheduling/calendar.tsx)

## The fix

**The date is never hidden.** PaneToolbar's `status` slot is documented in one
word — "Counts, totals, state — information rather than a control. Never hidden"
— and the call site had painted a `hidden` over it. The class is gone; it
truncates instead, which is what the slot was built to do.

**The grid opens on today.** `TimeGrid` takes a `revealNonce` the surface bumps
whenever it has moved you in time — stepping, switching view, or pressing Today
— and scrolls today's column to the middle of the pane, clamped at the ends so
Monday and Sunday never leave a band of dead grid beside them. A counter rather
than the anchor, because pressing Today while already inside this week changes no
state at all and still has to bring today back from wherever you scrolled to.

**The day's columns fit two.** `min-w-[9rem] @md:min-w-[12rem]` — the floor drops
on a narrow pane and the columns still stretch to fill a wide one. Two chairs and
the gutter come to 344px, inside a phone. Seven never fit at any readable width,
which is why the week scrolls and opens on today instead.

**The hour gutter is sticky.** Two elements rather than one, because `relative`
and `sticky` are the same CSS property and stacking them in one class string
would leave which of them applies to whatever order Tailwind happened to emit.

Fixed alongside on the same screen: the "nothing booked" card was `max-w-sm`,
wider than a phone pane, so it overhung both edges and lost its first word.

## Confirmed by

> Re-ran act 10 as Nia at 390px. The bar reads **Aug 17 – 23, 2026**; Sat 22 is
> centred and lit; the hour labels stay pinned while the week scrolls under them;
> the completed 3 PM booking is legible. Switched to Day and stepped to Sunday:
> **Sunday, August 23, 2026** in the bar, **Dara Bell** and **Nia Okafor** side by
> side with no horizontal scroll at all.
