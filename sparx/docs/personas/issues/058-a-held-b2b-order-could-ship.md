# 058 — A B2B order waiting for approval could be picked, packed and shipped

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3 (a code map made while building [057]; Doty's wholesale is act 5)
**Surface:** workbench › an order's ship and handover actions, Send to the warehouse, pick lists, the pack bench, pack-and-ship; REST and MCP for the same
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** sparx as Doty, 2026-10-17 (held order O-000020); service tests
**Blocked on:** —

## What happened

A wholesale order over a buyer's approval limit is held as `pending_approval` until
someone approves it. Its stock is not committed and it does not announce itself as
placed. But nothing that ships an order asked about it. Every way out (record a
shipment or a handover, Send to the warehouse, a pick list, a box, a pack scan,
pack-and-ship) checked only for "cancelled" or "refunded". So a held order could be
picked, packed and sent. Shipped in full, it was then marked delivered without ever
being approved.

## What should have happened

An order waiting for approval stays in the building until it is approved, and every
screen that would send it says so.

## The fix

- One rule, `orderShipRefusal` in `crm-schemas/src/ship-gate.ts`, says why an order
  cannot ship: cancelled, refunded, or "waiting for approval. Approve it before
  anything on it is sent."
- `createFulfillment` (the one function every way out ends in) refuses with it.
- The warehouse refuses early with the same words: pick list generation, opening a
  box (`inventory/src/services/pick-lists.ts`, `packing.ts`).
- The workbench order screen reads the same rule (built with [057]).

## Confirmed by

On screen, sparx as Doty, 2026-10-17, on O-000020 (Renée, $1,380.65, "Waiting for Teodora Vukić-Hale"). The order reads "Not to send yet" and offers only "Open Approvals" and "Cancel order": no shipment, handover or Send to the warehouse. Orders › To pack lists 16 orders and leaves it out. The pack bench refused a box: "Order O-000020 is waiting for approval. Approve it before anything on it is sent.", and the database holds 0 boxes for it. The bench had offered the box first ([293], fixed).

## Rating effect

Orders and the pack bench: to be scored in act 5.
