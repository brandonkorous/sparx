# 029 — Searching the Add list could quietly drop the thing she was looking for

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7 — building the Wholesale page
**Surface:** mypiggles › My Site › Page — Insert, while searching
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

A red **1 Issue** badge appeared in the corner of the console while Marisol was
searching the Add list. Opening it:

> Encountered two children with the same key, `timeline`. Keys should be unique
> so that components maintain their identity across updates. **Non-unique keys
> may cause children to be duplicated and/or omitted** — the behavior is
> unsupported and could change in a future version.

There are two different things in the Add list both called **Timeline**: one in
**Data** (a bare component) and one in **How it works** (a whole composed
section, "Dated stages — your history, or how a project will run"). Both are
legitimate; they are not duplicates of each other.

## What should have happened

Searching should list everything that matches, every time. React being free to
_omit_ a row means a search can silently not show something that is there —
and the person concludes the builder cannot do it.

## Why it matters

This is a search that can lie by omission, in the one place a person goes when
they are looking for something they cannot find by browsing. Nothing on screen
says a row was dropped; it simply is not in the list.

It also blocks a real workflow: the Add list is how every section gets onto every
page, so anything unreliable there is unreliable everywhere.

## How to reproduce

Every time, before the fix.

1. Open any page in the builder, go to **Insert**.
2. Type `timeline`.
3. The console reports the duplicate key; the dev-tools badge shows **1 Issue**.

## Where it lives

[wizeworks/packages/studio/src/react/palette/palette.tsx](../../../../wizeworks/packages/studio/src/react/palette/palette.tsx)

Rows were keyed on the item's own key:

```tsx
<PaletteRow key={item.key} … />
```

An item's key is unique **inside its group**, and browsing renders one list per
group, so it holds there. **Search flattens every group into one list**, where
two groups' items become siblings — and `timeline` exists in two of them.

The palette merges two catalogs (`mergeCatalog(paletteGroups(), host.catalog(…))`),
so keys were never globally unique to begin with; browsing just never exposed it.

## The fix

Pair the group with the key, which is unique in both shapes at once:

```tsx
export function rowKey(group: string | undefined, item: PaletteItem): string {
  return `${group ?? ''}:${item.key}`;
}

<PaletteRow key={rowKey(group, item)} … />
```

One change at the point of flattening, in `@wizeworks/studio` — so sparx's
workbench gets it too. Deliberately NOT "rename one of the Timelines": both names
are right for their group, the group chip beside each row already tells them
apart, and renaming would leave the underlying collision for the next pair.

Four tests in
[row-key.test.ts](../../../../wizeworks/packages/studio/src/react/palette/row-key.test.ts).
Suite: **154 tests / 18 files pass**; typecheck and lint clean.

## Confirmed by

Re-ran it as Marisol, 2026-08-20. Reloaded the builder, opened **Insert**, typed
`timeline`. Both rows now render — **Timeline · Data** and **Timeline · How it
works** — the dev-tools badge is gone, and the console has no key warning.

## Rating effect

None recorded — the pane's score already reflects the Add list working; this
removes a way it could have failed silently.
