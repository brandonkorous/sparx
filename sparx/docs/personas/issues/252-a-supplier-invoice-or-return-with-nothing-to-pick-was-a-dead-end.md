# 252 — A supplier invoice or return with nothing to pick was a dead end

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 242's split screens (Piggles as The Marrow Review)
**Surface:** Stock › Enter an invoice, and Stock › Send something back, sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** Piggles as Thistle & Rye, 2026-10-13; sparx as Ines Varga (Quiet Bench Repair, a new business), 2026-10-17
**Blocked on:** —

## What happened

The Marrow Review had never placed an order with a supplier, and had no supplier at all.

**Enter an invoice.** The "Order to a supplier" picker held one line, "Choose an
order…", and nothing else. Under it a blue box said "Choose an order to start. Every
line, the agreed price and what actually arrived all come from the order." There was no
order to choose, and nothing said so or said what to do.

**Send something back.** The "Supplier" picker held only "Choose a supplier…". Nothing
said there were no suppliers, or offered to add one, and the button stayed off.

Both screens were written for the case where there is something to pick. An empty list
looked exactly like a list still loading or a list you had not opened.

## What should have happened

- No placed order: say so, and offer "New order" to place one.
- No supplier: say so, and offer "Add a supplier".

## How to reproduce

1. In a business with no orders to a supplier: Stock › Enter an invoice.
2. In a business with no suppliers: Stock › Send something back.

## Why it matters

A new business reaching these screens first gets stuck with no way forward and no
reason why.

## Where it lives

- sparx `surfaces/inventory/supplier-bill-new.tsx`, `supplier-return-detail.tsx`.
- Piggles: the split files, `supplier-bill-new-sections.tsx` and `supplier-return-new.tsx`.

## The fix

- Invoice: with no placed order, the box says "No order to enter an invoice against yet"
  and offers "New order". "Choose an order to start" still shows when orders exist and
  none is picked.
- Return: with no supplier, a box under the picker says "No suppliers yet" and offers
  "Add a supplier".

sparx `supplier-bill-new.tsx`, `supplier-return-detail.tsx`; Piggles
`use-supplier-bill-draft.ts` (a `nothingPlaced` flag), `supplier-bill-new-sections.tsx`,
`supplier-return-new.tsx`. Tests: `surfaces/inventory/nothing-to-pick.test.ts` in both,
red then green.

## Confirmed by

- Piggles, Marisol (Thistle & Rye has no supplier and no order): the invoice form shows
  "No order to enter an invoice against yet"; "New order" opened a new order form. The
  return form shows "No suppliers yet" with "Add a supplier".

sparx, 2026-10-17, as Ines Varga in Quiet Bench Repair, a business signed up for this check with no supplier and no order. Enter a supplier's invoice: "No order to enter an invoice against yet" with "New order". Send something back to a supplier: "No suppliers yet. A return goes back to a supplier, so add the supplier first." with "Add a supplier".

## Rating effect

Enter an invoice and Send something back, first use: a way forward instead of a dead end.
