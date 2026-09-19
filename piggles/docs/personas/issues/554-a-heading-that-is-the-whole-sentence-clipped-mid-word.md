# 554 — A heading that is the whole sentence, clipped mid-word, above the same sentence

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, on the same screen as [553](553-every-unit-has-a-cost-behind-it-over-393-that-do-not.md)
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/gl-reconciliation.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_copy_edit_breaks_identity_lookups]]

## What she saw

Every row of "Where the difference comes from" said itself twice:

> **On your shelves with no supplier invoice yet: counted here,…**
> _On your shelves with no supplier invoice yet: counted here, but not in your
> books until the bill arrives_
>
> **Invoiced by a supplier but not yet booked in. Your books ha…**
> _Invoiced by a supplier but not yet booked in. Your books have it, your shelves
> do not_

The heading is the description, cut wherever the column ran out. On the narrow
rows it stopped mid-word.

## The cause

```tsx
{line.kind === 'sparx_value' ? … : line.description.split('—')[0]?.trim()}
```

The renderer made a heading by cutting the description at its em-dash. That
worked while the descriptions had em-dashes in them. Commit `bd4725e24`,
"remove em-dashes from copy, docs and catalog content", took them out — and
`split('—')[0]` on a string with no em-dash returns the whole string.

So the copy sweep silently turned a heading into a duplicate. Nothing failed:
`split` has no error case, `truncate` clips whatever it is given, and no test
renders this table. This is the shape [[feedback_copy_edit_breaks_identity_lookups]]
names — before editing user-facing text, find who reads it as an identity — with
a renderer rather than an installer doing the reading.

Swept the tree for the same fault elsewhere:

```
grep -rnE "(split|indexOf|slice|replace|match)\(\s*(/[^/]*—[^/]*/|'—')" --include=*.ts --include=*.tsx
```

No other hits. Every remaining `'—'` in the tree is the placeholder for an empty
value, which is a dash and not copy.

## The fix

The line carries its own label. A label a renderer has to guess is a label
nobody owns.

`ReconciliationLine` gains `label`, set beside each `description` in
`gl-reconciliation.ts`:

| kind                          | label                             |
| ----------------------------- | --------------------------------- |
| `sparx_value`                 | What we make it                   |
| `goods_received_not_invoiced` | On your shelves, not yet invoiced |
| `invoiced_not_received`       | Invoiced, not yet on your shelves |
| `non_owned_stock`             | In your building, but not yours   |
| `uncosted_units`              | Units with no cost behind them    |
| `in_transit`                  | Moving between your locations     |
| `ledger_value`                | What your books say               |
| `unexplained`                 | Unexplained                       |

Both consoles now render `line.label` and the three hardcoded special cases in
each renderer are gone. Piggles keeps one override, because
`productCopy('inventory.gl.ourFigure', …)` is how the brand says its own name.

## Proven

Her screen now reads a short heading over a full sentence on all eight rows, with
nothing clipped. Both consoles typecheck; 383 piggles tests and 295 sparx tests
pass.
