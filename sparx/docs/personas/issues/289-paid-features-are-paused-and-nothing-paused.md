# 289 — "Paid features are paused", and nothing paused

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming [261] (the trial ran out on Oct 15)
**Surface:** workbench › every pane of a paid module, and the billing banner
**Filed:** 2026-10-16
**Fixed:** 2026-10-16
**Confirmed by:** sparx as the Everson owner and as Doty, 2026-10-16
**Blocked on:** —

## What happened

The day after Gillett's trial ended, every screen carried "Your trial has ended:
paid features are paused. Your public site stays live for 6 more days. Add a payment
method to switch everything back on." Doty opened Customers › Boards › "Monday
numbers" under it. It worked, as did every other paid module. Nothing was paused.

## What should have happened

docs/17 §6, the plan the banner was written from: "No card → modules pause. Paid
module features gate in the dashboard ('add payment to reactivate'). The public
site stays live." The ladder row for day 14 is "modules paused · site live for 7
more days + ModuleGate on each paused module". The banner's sentence is the
contract; the gate was never built.

Brandon chose (2026-10-16): build the pause, as docs/17 says, rather than change
the words.

## How to reproduce

1. A business on the standard plan, past its trial end, no card (Gillett on Oct
   16, before it was made Enterprise).
2. Read the banner. Open any paid module's screen. It works.

Every time.

## Why it matters

A sentence on every screen that is false. It also gives away every paid module
for free for the grace week.

## Where it lives

`sparx/apps/workbench/components/surface-mount.tsx` mounts every pane and already
asks one gate (module switched off). Nothing asked the bill.

## The fix

- `lib/billing/paused.ts` (new): one rule. In `grace` or `suspended`, the paused
  modules are exactly the lines on the bill (`planModules`). Free and included
  modules (Social, Campaigns, Inventory and Invoicing with the Online store) keep
  working; a custom plan is `exempt` and never pauses; a bill not loaded yet is
  never read as paused. "Your sparx bill" never pauses, even when Finance is a paid
  line, because it is where the card is added.
- `components/surface-module-paused.tsx` (new): the paused pane. "Customers is
  paused. Your free trial ended on Oct 15, 2026. Add a payment method to switch
  Customers back on. Nothing you made in Customers is lost. Your website keeps
  working until Oct 22, 2026." with "Add payment method", which opens the bill
  beside it. Somebody who may not pay reads "An owner or an admin can add a payment
  method…" with no button (issue 168). Past grace: "Your website is offline until
  then."
- `components/surface-mount.tsx`: the mount asks `moduleIsPaused` after the
  switched-off gate and before drawing the surface.
- Scope, stated: the pause is the console's, as docs/17 says. The API, MCP and
  the public site keep working (the site must, to take orders through grace).
- Piggles: its billing is getpiggles.com's and its lifecycle file carries another
  session's edits; not checked here.

Tests: `lib/billing/paused.test.ts` (6): which modules pause in each phase, free
modules, an unloaded bill, the bill screen under a paid Finance, and that the mount
asks before it draws (red before the mount edit, then green). ESLint and Prettier
clean. The workbench `tsc` ran out of memory: not checked.

Found on the screen check: once the site was offline, the pane said "Your sparx
bill has not been paid." Everson never had a bill; its trial ended. The phase view
drops the trial date once suspended, and the pane read it from there. The pane now
takes its reason from the bill screen's own rule, `lapseReason` in
`surfaces/finance/subscription-words.ts` (the words moved beside it, as
`pausedWords`): a failed payment, a canceled plan, or the trial's end date, and
only then "Your sparx bill has not been paid." A canceled plan used to read as an
old trial on the bill screen too; it now says "Your plan was canceled." Tests: 4
new in `subscription-words.test.ts`, 3 red with the old sentence put back, then 10
green with `paused.test.ts` 6. ESLint and Prettier clean.

## Confirmed by

sparx as the Everson Apparel owner (`e2e-apparel-staff@sparx.test`), 2026-10-16.
Everson's trial ended Jul 26, 2026 with no card, so it is past grace (site offline).

- Products: "Selling is paused. Your free trial ended Jul 26, 2026. Add a payment
  method to switch Selling back on. Nothing you made in Selling is lost. Your
  website is offline until then." with the warning button "Add payment method".
  Before the wording fix the first sentence was "Your sparx bill has not been paid."
- "Add payment method" opened "Your sparx bill" as the next tab: $392.00 per month,
  "Your free trial ended Jul 26, 2026. Your website is offline, and your paid
  features are paused, until a card is added." The bill itself is not paused.
- Content: "Content is paused", the same sentences.
- Counting schedules (Inventory, included with the Online store): works, "No
  counting schedules yet" and "Set one up".

- Then as Doty: Gillett's bill reads "Your plan is agreed with the sparx team" and
  "Custom plan", with no banner. Products opened with its full list (14 pages, "On
  sale" rows). A custom plan does not pause.

Grace week. Everson's trial end was moved to two days back (`2026-10-15 02:10 UTC`) and put back to `2026-07-26 08:52:50+00` after. Banner: "Your trial has ended: paid features are
paused. Your public site stays live for 5 more days." Products: "Selling is paused.
Your free trial ended Oct 14, 2026. Add a payment method to switch Selling back on.
Nothing you made in Selling is lost. Your website keeps working until Oct 21, 2026."
The dates are in the browser's local time (Mountain), so a UTC end at 02:10 reads as the day
before. "Add payment method" opened the bill.

Not checked: the sentence for a person who may not pay (no such user on Everson).
It has a test.

## Rating effect

—
