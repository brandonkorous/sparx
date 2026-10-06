---
title: One shipping rule for every way out
node: features
type: rule
status: active
sources:
  - wizeworks/packages/crm-schemas/src/ship-gate.ts
  - wizeworks/packages/crm/src/services/order-fulfillments-service.ts
  - wizeworks/packages/inventory/src/services/pick-lists.ts
  - wizeworks/packages/inventory/src/services/packing.ts
  - sparx/docs/personas/issues/057, 058
---

Whether an order, and each line of it, may leave the building is ONE pure rule in
`crm-schemas/src/ship-gate.ts`:

- `orderShipRefusal(order)`: cancelled, refunded, or **waiting for B2B approval**
  (`pending_approval`) cannot ship. Returns the sentence to show.
- `shippableUnits(line)` / `unitsWaitingForCore(line)` / `lineShipRefusal(line, n)`: a
  line bought by sending the old part first ships one unit per old part that arrived,
  until the business releases it ([[core-charges]]).

`createFulfillment` is the bottleneck every way out ends in (record a shipment or
handover, pack-and-ship, a label purchase), and it refuses with these words. The
warehouse refuses EARLY with the same words, so nobody is sent to fetch something that
cannot go: pick list generation, opening a box, packing a unit (and the pack scan).
The consoles read the same functions to grey their buttons.

**Why:** every path used to ask only "was it cancelled?". A B2B order held for approval
could be picked, packed and shipped, then marked delivered without approval (issue
058). Spelling the rule once is what keeps the server, the pick list and the screen
from disagreeing.

**How to apply:** a new way to ship goods calls `createFulfillment`, never writes an
`OrderFulfillment` itself. A new kind of hold is a new case in `ship-gate.ts`, not a
check in one caller.

Related: [[core-charges]], [[features]]
