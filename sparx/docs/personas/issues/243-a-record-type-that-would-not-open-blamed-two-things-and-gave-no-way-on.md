# 243 — A record type that would not open blamed two things and gave no way on

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming issue 242 (Customers › Record types, as Doty)
**Surface:** Customers › Record types › one record type, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Two things on the one record type screen.

**It could not open, and it did not say why.** Opened on a record type that is not
there (`/crm/record-types/fleetcontract`), the pane showed a bare message in the middle
of an empty pane: "Could not open that record type. This is a problem reaching the
server, or the record type has been removed." That is one message for two causes with
different fixes. The server had answered: the type is not there. There was no Try again
button for the case where the server really was out of reach.

Issue 240 fixed this exact state on the records list and on one record, with the shared
`PaneLoadError`: a missing type says "That record type is no longer here", and a server
that cannot be reached gets Try again. The record type screen itself was left behind.

**Save stayed live with nothing to save.** Right after Doty saved "Rebuild job", the
Save button was still lit. It is lit whenever the name is valid, so it cannot tell an
owner whether there is unsaved work. One record (`record-detail.tsx`) turns Save off
until something changes; this screen did not.

## What should have happened

- A missing record type says it is no longer here. A server that cannot be reached says
  so, with Try again. Both in the shared shape every other pane uses.
- Save is off until there is something to save.

## How to reproduce

1. Open `/crm/record-types/fleetcontract` (any key that does not exist).
2. Open a record type that does exist. Look at Save before you change anything.

## Why it matters

"A problem reaching the server" sends an owner to check their internet for a record type
that was simply removed. A Save button that is always lit cannot say "you have changes".

## Where it lives

`surfaces/crm/object-type-detail.tsx` in both consoles: the `!isNew && isError` branch
(a bare `EmptyState`), and the Save button's `disabled`.

## The fix

`surfaces/crm/object-type-detail.tsx` (sparx) and the split Piggles screen
(`object-type-detail.tsx`, `object-type-toolbar.tsx`, `use-object-type-editor.ts`):

- The `!isNew && isError` branch now uses the shared `PaneLoadError` with
  `noun="record type"` (Piggles: "thing you track"), its own error and a Try again. A
  404 says the type is no longer here and offers no retry; anything else says the server
  could not be reached and offers Try again.
- The editor exposes `dirty`, and Save is `disabled` when `!isNew && !dirty`.

Tests: `surfaces/crm/object-type-load-error.test.ts` in both consoles. Red on the old
files (2 of 2 failed in each), green on the new.

## Confirmed by

- sparx, Doty: `/crm/record-types/fleetcontract` showed "That record type is no longer
  here. It has been deleted, or the address points at something that is not in this
  business. Nothing of yours has been lost." On "Rebuild jobs", Save was off at rest, on
  after typing a description ("An engine or transmission we take apart and rebuild for
  a fleet customer."), and off again after saving. The description is in the database.
- Piggles, The Marrow Review: `/crm/record-types/printrun` showed "That thing you track
  is no longer here". After saving "Galley proof", Save was off.

## Rating effect

Record type (one): Design was held down by a bare message floating in an empty pane,
and Ease by a Save that could not say whether there was work to save. Both lifted.
