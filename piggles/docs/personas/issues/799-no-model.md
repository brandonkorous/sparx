# 799 — "No model"

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 280
**Surface:** mypiggles + sparx workbench — `commerce.fitment.domain.detail`
**Filed:** 2026-09-24
**Blocked on:** —

## What happened

Inside a compatibility list, each entry wears a badge counting what sits under
it. With something under it, the badge reads correctly:

```
Ford        4 models
Chevrolet   11 models
```

With nothing under it:

```
Peugeot     No model
```

## Why

Two branches of one badge, three lines apart, and only one of them counted:

```tsx
{
  node.childCount === 0
    ? `No ${nextLevel?.label.toLowerCase() ?? ''}`.trim()
    : `${String(node.childCount)} ${pluralize(nextLevel?.label.toLowerCase() ?? 'entry', node.childCount)}`;
}
```

The zero branch never reaches `pluralize`, which sits in the same file and
already handles y / s / x / z / ch / sh. Act 279 found the same shape in the
same folder (issue 794's naive `+ "s"` three lines from a working `pluralize`),
and act 280 had already fixed its sentence twin in this very file — this badge
is what the sweep walked past.

Juniper Row's own list is one level deep, so every entry is a leaf and this
badge never renders for her. It is anyone with a two-level list who reads it.

## What was done

One function, beside the sibling it should always have shared:

```ts
export function childCountLabel(levelLabel: string, count: number): string {
  const word = pluralize(levelLabel.toLowerCase(), count === 0 ? 2 : count);
  return count === 0 ? `No ${word}` : `${String(count)} ${word}`;
}
```

```
No models      1 model      4 models
No bodies      No classes   3 finishes
```

## Proof

`surfaces/commerce/fitment-count-words.test.ts`, 5 cases, in both consoles.
Proved red first by putting the singular-on-zero back: **3 of 5 failed**.

## The grey that came with it

These screens were walked for `color="neutral"` while the badge was open, and
**16 call sites came out** across the two consoles. None of them was carrying a
meaning:

| where                                                                   | was                                 | now                                                                                   |
| ----------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| move up / move down / rename / cancel icon buttons (8)                  | `variant="ghost" color="neutral"`   | `variant="ghost"` — a bare ghost already resolves to readable ink, and names no color |
| the count badge on an entry, and the count in the list toolbar (2)      | `color="neutral" variant="soft"`    | colorless                                                                             |
| the badge naming which kind a detail is (2)                             | `color="neutral" variant="soft"`    | colorless — there is no meaning for a hue to carry across fifteen kinds               |
| "Add a level" and "Add a range" (2)                                     | `variant="outline" color="neutral"` | `color="module" variant="soft"` — they are the actions those sections exist for       |
| sparx's "Start from a ready-made list" and "Build one from scratch" (2) | `variant="outline" color="neutral"` | `variant="outline"` — mirroring what Piggles' copy of the same list already did       |

Status badges were left alone: "Retired" on an archived row is the console's
settled status pattern, not a choice made here.

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/fitment-data.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/fitment-nodes.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/fitment-domain-detail.tsx`
- `sparx/apps/workbench/surfaces/commerce/fitment-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/configurator-template-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-type-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/fitment-count-words.test.ts` (new)
