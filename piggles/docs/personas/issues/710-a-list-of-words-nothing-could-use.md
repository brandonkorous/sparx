# 710 — A list of words nothing could use

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 250
**Surface:** mypiggles + sparx — Stock › Units, and Selling › a product's Stock panel
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: CS now reads "1 item"
**Blocked on:** —

## What happened

Devi opened **Units**. Twelve rows, one per unit she can count in. The "Used on"
column read **Nothing yet** on every single one.

The sentence at the bottom of the pane explains why that would change:

> **Where the numbers come from.** A unit is only a word until an item says what
> it contains. **Open any product's stock panel to say that a case of THAT thing
> is twelve**, and from then on you can order, receive and count in cases, while
> your stock figures stay in singles.

There is no such screen.

## Why it matters

"Nothing yet" was not a description of Devi's account. It was structural. Nothing
anywhere in either console could attach a unit to an item, so that column read
"Nothing yet" for every tenant, on every row, permanently.

Everything else was built:

| Layer                                  | Built? |
| -------------------------------------- | ------ |
| `GET /v1/inventory/variants/:id/units` | yes    |
| `PUT /v1/inventory/variants/:id/units` | yes    |
| `getVariantUoms` / `setVariantUoms`    | yes    |
| `useVariantUoms` / `useSetVariantUoms` | yes    |
| a screen that calls either hook        | **no** |

Both hooks sat in `inventory/assembly-data.ts` with **zero callers** in either
console. A finished pane over a write path nobody could reach, plus a sentence
telling her where to go and pointing at nothing.
[[feedback_screen_over_a_function_nobody_calls]]
[[feedback_a_promise_in_copy_is_a_contract]]

## What was done

**The screen the sentence promises now exists.** `PackSizesForm`, on a product's
Stock panel, one per version, beside "Record a count" — exactly where the copy
says to look.

It asks three things, in her words:

- **One of these is called** — the word for a single one. Display only: the
  ledger holds base units whatever this says, so a business that stocks fabric
  reads "12 meters" instead of "12 each" and no stored number moves.
- **Pack sizes** — a unit, and how many singles are in one of it. Live under each
  row: _"Two of them reads as 2 cases (24 each)."_
- **Usually ordered by / Usually sold by** — one dropdown each.

Three decisions behind that shape:

1. **The pack size lives on the ITEM, not the unit.** A case of belt buckles is
   twelve and a case of linen is one roll, and both are "CS". The unit row
   carries the name; this carries the arithmetic.

2. **The defaults are dropdowns, not a checkbox per row.** The database stores
   `isPurchaseDefault` on each conversion with a partial unique index allowing
   exactly one. As a checkbox per row, that invariant is something Devi has to
   maintain by unticking the old one first, and the first time she forgets, the
   save is refused for a reason that reads like a bug. One dropdown can only hold
   one answer, so the shape of the control IS the rule.

3. **The preview sentence uses the real formatter.** `describeQuantity` from
   `@wizeworks/commerce-schemas` is what every other screen says a quantity with,
   so a wrong factor looks wrong in the editor exactly as it will look on the
   purchase order.

**Two more things this turned up on the same pane.**

_The editor warned about unsaved work before anything was typed._ The leave-guard
was keyed on "the form has loaded", so the status bar said **Not saved** the
instant the panel opened. A warning that is on by default is a warning people
learn to click past. It now tracks whether anything actually changed.

_The delete button was dead with the reason off-screen._ A unit in use cannot be
deleted, and the count that explains it lives in the "Used on" column — which is
`hidden` below `@md`. This pane is BUILT to dock narrow. MEASURED at 360px: the
column was gone, the button was `disabled`, its accessible name was just
"Delete CS", and nothing on screen said why. The note at the top of that very
file says:

> A disabled button with no explanation is how someone concludes the software is
> broken.

The row now carries **"Set up on 1 item, so it cannot be deleted"** at the widths
where the column is not there, and the button's name says the same.

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/product-pack-sizes.tsx` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/product-stock.tsx` — the button
  and the panel
- `piggles|sparx/apps/workbench/surfaces/inventory/assembly-data.ts` —
  `meta: { writing: "this item's pack sizes" }` on the mutation
- `piggles|sparx/apps/workbench/surfaces/inventory/units-list.tsx` — the refusal,
  visible at every width

## Proof

Set **case (CS) holds 12** on `ASH-OVERSHIRT`, usually ordered by cases. Saved.
Reopened: reads back exactly. **Units** now shows **1 item** against CS and its
delete button is refused. The promise in the footer is true.
