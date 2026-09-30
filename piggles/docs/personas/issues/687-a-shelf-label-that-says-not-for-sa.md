# 687 — A shelf label that says "NOT FOR SA…"

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 242
**Surface:** mypiggles — Stock › Shelf labels
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen, at both sizes — see below
**Blocked on:** —

## What happened

Devi opened **Shelf labels** to print stickers for the shelves. Five labels, and
the one for her overstock shelf read:

> **BULK-1**
> Overstock
> Fulfillment Center · Bulk
> **OVERSTOCK: NOT FOR SA…**

Above the sheet, in the pane's own words: _"What you see here is exactly what
prints."_

## Why

Every line on the label carried `truncate`, including this one:

```tsx
<span className="truncate text-[10px] leading-tight font-bold text-black">
  {binTypeLabel(bin.type).toUpperCase()}: NOT FOR SALE
</span>
```

`truncate` is `white-space: nowrap` with an ellipsis, and it applies to print as
well as to screen. So the sentence was true: the sticker really did come out of
the printer saying "NOT FOR SA…".

Truncating the code, the shelf name or the location is a nuisance — somebody
reading them is already standing at the shelf. This line is the label's whole
job. It is there to stop a picker taking an order off a shelf the stock cannot be
sold from, and at small size even the shortest of them ("GOODS IN") clipped.

`product-labels.tsx`, the sibling surface, already had this right. Its
meaning-carrying line is not truncated:

```tsx
{
  row.packSize > 1 ? (
    <span className="text-center text-[9px] leading-tight font-bold text-black">
      CASE OF {row.packSize}
    </span>
  ) : null;
}
```

while the title and the SKU beside it are. Same rule, one surface behind.

## What changed

The warning line drops `truncate` and takes `break-words`. It is the last line on
the card, so wrapping costs a few millimetres inside a fixed-height label that
had room for them.

## Confirmed

At medium (70mm × 38mm): **OVERSTOCK: NOT FOR** / **SALE**, on two lines, inside
the card.

At small (45mm × 25mm): **GOODS IN:** / **NOT FOR SALE**, with the shelf name and
location still truncating around it — which is the right trade. The nice-to-haves
clip; the thing that stops somebody selling quarantined stock does not.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/bin-labels.tsx`
