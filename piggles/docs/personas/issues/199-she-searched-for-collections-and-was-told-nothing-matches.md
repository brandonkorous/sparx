# 199 — She searched for "collections" and was told nothing matches

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › the search bar (and every app panel's own filter)
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen

## What happened

Act 5 opens with three collections to build. Devi has spent four years on a
marketplace that called them collections, so that is the word she typed:

```
collections
    Nothing matches that. Try a different word.
    Nothing in your orders, customers or products matches "collections".
```

The screen exists. It is **Sell › Groups of products**, four rows down the panel
she already had open.

## What should have happened

The word she arrived knowing takes her to the screen, and the screen is still
called what Piggles calls it.

## Why it matters

Piggles renames roughly 220 screens on purpose, and it is right to: nobody should
have to learn "collections", "fitment" or "price lists" to run a shop
(piggles/CLAUDE.md RULE #3). But renaming is only half the job. **Everyone
arriving from another product arrives with the old vocabulary**, and search is
the one place the old word costs nothing to accept — the result still reads
"Groups of products", so she learns the new name at the moment she needs it
rather than being told her word is wrong.

"Nothing matches that" is also an actively misleading sentence. It does not say
"we call that something else"; it says the thing is not here. A person who
believes it goes looking for a feature the product has.

## Where it lives

Not a missing synonym for one screen. **The rename itself deletes the old name
from search**, everywhere, for every renamed screen.

A surface carries a platform `title` and an optional Piggles override.
`resolveTitle` returns the override when there is one, and both search paths
matched on exactly that plus the hand-written `keywords`:

```ts
// components/launcher-entries.ts — the command bar
label: resolveTitle(s, {}),
keywords: [...(s.keywords ?? []), s.module],

// components/app-panel.tsx — an app panel's own filter
if (resolveTitle(surface, {}).toLowerCase().includes(needle)) return true;
return (surface.keywords ?? []).some((k) => k.toLowerCase().includes(needle));
```

So `title: 'Collections'` became `'Groups of products'` and the word
"collections" stopped existing. Some screens were saved by luck: Products
happens to list `'inventory'` and `'sku'` in its keywords, and Discounts lists
`'coupons'`, which is why those two searches work and made the gap look like one
missing word rather than a rule.

## The fix

One helper, at the point the vocabulary is already applied, so every renamed
screen gets its old name back without a synonym list to keep in step:

```ts
// lib/surfaces/registry.ts
export function surfaceKeywords(definition: SurfaceDefinition): readonly string[] {
  const keywords = definition.keywords ?? [];
  const platform = definition.title;
  if (typeof platform !== 'string' || resolveTitle(definition, {}) === platform) return keywords;
  return [...keywords, platform];
}
```

Both search paths now call it. A screen whose name Piggles did not change adds
nothing, and the platform name ranks as a keyword rather than a label, so the
Piggles name still wins the ordering.

Hand-written keywords stay useful for words that were never a screen's name at
all — "coupons", "sku", "sale". This only covers the ones the rename ate.

## What it looked like once fixed

```
collections   →  Sell › Groups of products
price lists   →  Sell › Special prices
fitment       →  Sell › What fits what · What it fits
```

Three renames from three different parts of the lexicon, all reached by the word
somebody would arrive with, all still displaying the Piggles name.

## Rating effect

The search bar in [rating.md](../rating.md), and it lifts every renamed pane's
findability rather than one.
