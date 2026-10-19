# 293 — The pack bench offered a box for an order it would not let him pack

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · confirming [058] (a held B2B order)
**Surface:** workbench › Stock › the pack bench, opened on an order; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty, 2026-10-17; Piggles as Rosalind (The Marrow Review), 2026-10-17, in part
**Blocked on:** —

## What happened

Doty opened the pack bench on O-000020, Renée's $1,380.65 order held for Teodora's
approval. The bench said "No box open yet. Start one, then scan each item into it.
Anything that is not on this order will be refused." with a "Start a box" button.
He pressed it. The bench then said "Order O-000020 is waiting for approval. Approve it
before anything on it is sent." No box was made ([058] holds), but the screen had
invited the press it then refused.

The same bench, opened on an order that is not in the business (Piggles, as
Rosalind, with another business's canceled order), also said "No box open yet" and
offered "Start a box".

## What should have happened

The bench says first that the order cannot be packed, and why, in the words the
server refuses with. It does not offer a box. An order that is not there says so.

## How to reproduce

1. Open an order waiting for approval, canceled or refunded.
2. Open the pack bench for it (`/inventory/packing/<order id>`).

## Why it matters

A packer stands at the bench and presses what it offers. A button that is always
refused teaches them the bench is broken, and it reads as permission until it is
pressed.

## Where it lives

`surfaces/inventory/pack-bench.tsx` (both consoles) never read the order: it knew the
order's id only. The rule it needed is `whatCanShipNow` (`commerce/order-ship-gate.ts`,
over `orderShipRefusal` in `@wizeworks/commerce-schemas`), which the order pane already
reads. Its own header says "the screen that greys a button" gives the same answer;
this screen did not ask.

## The fix

Both consoles:

- `pack-bench.tsx` reads the order (`useOrder`) and asks `whatCanShipNow(order).refusal`.
  With a refusal and no box open, it shows a warning, "Not ready to pack", with the
  refusal as its sentence and "Open the order" (`commerce.order.detail`); "Start a box"
  in the toolbar is off. An order that fails to load (not in this business, or not
  reached) shows `PaneLoadError` with noun "order" instead of the bench.
- `useOrder` (`commerce/data.ts` in sparx, `commerce/order-queries.ts` in Piggles) waits
  when no id is given, because the bench can open on a box alone.

Checked beside it: the order pane shows no ship action for a held order ("Not to send
yet", only "Open Approvals" and "Cancel order"); Orders › To pack leaves O-000020 out;
Walks (pick lists) start only from an order.

Prettier clean; `check:pane-breakpoints` green. ESLint and the workbench `tsc` run out
of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Pack bench on O-000020: "Not ready to pack. Order O-000020
is waiting for approval. Approve it before anything on it is sent." with "Open the
order"; "Start a box" is off; 0 boxes on the order in the database. On O-000031, an
ordinary order to send: "No box open yet" and "Start a box", as before.

Piggles as Rosalind, 2026-10-17, in part: the bench on SO-91009 (canceled, in another
business) reads "That order is no longer here". Not checked in Piggles: a held,
canceled or refunded order of her own (The Marrow Review has no orders).

## Rating effect

—
