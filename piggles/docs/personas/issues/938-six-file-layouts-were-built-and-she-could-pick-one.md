# 938 — Six file layouts were built, and she could pick one

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P03 · Juniper Row · act 325, re-walking Accounting (Ease 5)
**Surface:** mypiggles › Money › Accounting (both consoles), `@wizeworks/finance`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, all seven layouts under Laid out for, and account codes kept for Xero with its sync off
**Blocked on:** —

## What happened

Accounting held at Ease 5 "until a persona connects a package and posts a cost
through it". That half needs a QuickBooks or Xero developer app registered for
this installation, which is not something a persona can do. So Devi re-walked
the half she can use: the file for her accountant.

**Laid out for** offered one choice: **Spreadsheet / your accountant**.

Under it, every row in **Sending it automatically** said the opposite:

- QuickBooks Online and Xero: "The spreadsheet export on this screen already
  imports into QuickBooks today."
- QuickBooks Desktop and Sage 50: "**A one-click layout is not ready yet.** The
  spreadsheet export on this screen works with it today."
- FreshBooks and Wave: the same as QuickBooks Online.

All six layouts were finished. `export.ts` has the column set for each
(QuickBooks wants an account name, Xero a code, Sage 50 both), and the export
route builds whichever one it is asked for. Nothing asked: the picker listed
catalog entries whose `availability` was `available`, and `availability` is
about DIRECT SYNC. On an installation with no QuickBooks app, that left the
generic file. Desktop and Sage 50, which have no sync at all, were registered
as "coming soon" for a layout that existed.

The same flag blocked **Set up account codes** for any of them:
`upsertConnection` refused a provider that was not "available", so the account
codes and books-closed date, which the screen calls the whole reason the export
is worth anything to a bookkeeper, could be kept only for the generic file.

## The fix

- **`@wizeworks/finance`**: QuickBooks Desktop and Sage 50 are file layouts,
  `available`, with no "not ready" sentence. A sync that is not switched on now
  says where its file is: "Choose Xero under Laid out for, and the file from
  this screen imports into Xero today." A connection row may be kept for any
  provider in the catalog (`assertProviderKnown`), because the row holds the
  file's settings too. Signing in is still refused by the connect route when
  the adapter is not configured.
- **Both consoles**:
  - Laid out for lists every destination with a layout: Spreadsheet,
    QuickBooks Online, Xero, QuickBooks Desktop, Sage 50, FreshBooks, Wave.
  - Sending it automatically lists only the packages that sync. A file layout
    is chosen in one place.
  - A row kept for a file, whose sync is off, reads **Export layout** with no
    **Sign in** button. It offered Sign in, which the server would refuse. Its
    sync row reads **Connect** (disabled), not **Finish signing in**.
  - Three `color="neutral"` controls lost the color: the "Not yet" badge, the
    signed-in button and **Sign out**.

## Proof

- `catalog.test.ts`, 4 cases: every destination has columns; Desktop and Sage
  50 are ready; every sync that is not switched on names Laid out for; account
  codes can be kept for Xero and FreshBooks. Registering the file layouts as
  not ready again reddens 2.
- On screen, as Devi: Laid out for listed all seven. Choosing **Xero** and
  pressing **Set up account codes** made a **Xero** card with **Books closed
  on** and an account code box per category, and **Use the settings from:
  Xero** appeared above the download.
- Not done on screen: downloading a file. The download writes to disk, and the
  route that builds each layout did not change.

## Data this made

A Xero settings row on Juniper Row (no grant, no codes yet), kept.

## Still open

The direct-sync half has never run. It needs a QuickBooks or Xero developer app
registered for this installation, which a persona cannot do.
