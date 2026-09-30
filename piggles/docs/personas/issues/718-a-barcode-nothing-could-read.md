# 718 — A barcode nothing could read, under two sentences saying it works

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 251
**Surface:** mypiggles + sparx — Stock › Print a label, Scanner mode, and the scan API
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: typing PICK-000001 into Scanner mode now opens the walk
**Blocked on:** —

## What happened

Found while scoring **Print a label**. Its copy reads:

> Stick one on the paperwork and one on the pallet. Scanning it in warehouse
> mode opens this **{document}** straight away.

That pane prints for five documents. It is reached from a purchase order, a
delivery, a transfer, a stock count — and a **pick list**, where the button
beside it says "Print the sheet".

Scanning the walk sheet returned:

> **Nothing matches PICK-000001**
> If this is something you stock, add the code to the item and it will scan from
> then on.

## Why it matters

`pick_list` was not one of the kinds the scan resolver knew. It knows a product,
a shelf, a purchase order, a delivery, a transfer, a count, a batch and a serial
number. Not a walk sheet.

So we printed a Code 128 on a piece of paper, told a picker to scan it, and the
answer was that it did not exist — with advice that makes no sense for a walk
sheet. Two causes, one message: a code that is genuinely unknown and a code the
software was never taught to look for read identically.
[[feedback_one_outcome_two_causes]]

**Two files said in their own headers that this worked.** Not in copy — in the
comments written to explain a design decision:

> `warehouse-mode.tsx`, on why the Pick job is a list rather than a scan box:
> A picker arriving for a shift does not have a walk sheet in their hand yet …
> **Scanning a printed walk sheet still works: it resolves through the
> Look-it-up job like any other document.**

> `document-label.tsx`, on why one surface serves them all:
> **A purchase order, a receipt, a transfer and a count** all need exactly the
> same thing.

The second one is the tell. The header names **four** documents; the pane is
opened by **five**. The fifth was added later, the header was not, and neither
was the resolver. A design decision was made ON a claim about the code, and the
claim was never true. [[feedback_verify_capability_in_code_not_docs]]

**The list lived in three places.** `ALL_KINDS` in the service, a hand-typed
`SCAN_KINDS` in the REST route's `z.enum`, and another in the MCP tool's. Three
copies, and `pick_list` reached none of them.

## What was done

**`pick_list` is a scan kind.** One more row in the table-driven documents block
(`inventory_pick_lists`, matched on `number` like the other four), one more
label, one more case in the console's match card, which opens the walk.

**Two of the three copies are gone.** The REST route and the MCP tool now import
`SCAN_KINDS` from the service. The two consoles keep theirs — they reach the
service over HTTP and depend on no package that could hold nine strings, and
taking a dependency on a server package to share them would be the wrong trade —
so a source-reading test holds each console's copy to the server's file, in
order, and requires every kind to carry a word a person can read.

**A test that would have caught it.** `scan-kinds.test.ts` in the inventory
package asserts every kind the resolver ADVERTISES has something that actually
looks it up, plus the denominator (nine kinds, five of them documents) so it
cannot go green over an empty scan. [[feedback_structural_checks_go_blind]]

The MCP tool's own description listed "purchase orders, transfers, counts" and
skipped deliveries; it now names all five.

## Files

- `wizeworks/packages/inventory/src/services/scan.ts` — the kind, the query, the header
- `wizeworks/packages/inventory/src/services/scan-kinds.test.ts` — new
- `wizeworks/packages/inventory/src/index.ts` — `SCAN_KINDS` exported
- `wizeworks/packages/inventory/src/mcp/scan-tools.ts` — reads the one list
- `wizeworks/services/api-rest/src/routes/v1/inventory/barcodes.ts` — reads the one list
- `piggles|sparx/apps/workbench/surfaces/inventory/scan-data.ts` — kind + label
- `piggles|sparx/apps/workbench/surfaces/inventory/warehouse-mode.tsx` — opens the walk, and the header it falsified is corrected
- `piggles|sparx/apps/workbench/surfaces/inventory/scan-kinds.test.ts` — new

## Proof

Take the pick-list row back out of the documents block: **2 of 4 tests fail**,
naming the kind that has nothing to look it up. Take `pick_list` out of the
console's union: **4 of 4** fail. Restored: 4 and 4 pass, 148 in the inventory
package, 999 + 873 in the two consoles.

On screen, in Scanner mode under **What is this**, typing `PICK-000001`:

| what came back                                         |
| ------------------------------------------------------ |
| **Pick list** · PICK-000001 · picked, with **Open it** |

Pressing it opens the walk, which is what the sticker promised.
