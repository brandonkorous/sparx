# 304 — Late orders said the news went to other software when nothing listened

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Inventory › Late orders, and the purchase order page; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

The late orders page said each late order was "passed to your other software". Gillett has no webhook listening for that event, so nothing was passed anywhere.

## What should have happened

The sentence shows only when a webhook listens for `inventory.purchase_order.late`.

## How to reproduce

1. Have no webhook for late purchase orders.
2. Open Inventory › Purchase orders › Late.

## Why it matters

A promise that something happens next is a contract. An owner who trusts it stops chasing the supplier.

## Where it lives

`surfaces/inventory/late-order-listeners.ts` (new), `late-orders.tsx` (sparx), `late-orders-table.tsx` (Piggles), `purchase-order-procurement.tsx`.

## The fix

`useLateOrderListened()` reads the webhooks and answers whether any listens for that event. The words show only when one does.

No test: the hook reads one list.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. Late orders reads "$1,760.00 of stock is late across 2 orders" with PO-000001 and PO-000002, and the page no longer says "other software" (Gillett has no listener).

Not checked: the words appearing when a webhook does listen.

## Rating effect

See the pane's row in `rating.md`.
