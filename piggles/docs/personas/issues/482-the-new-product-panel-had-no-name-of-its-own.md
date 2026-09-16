# 482 — The new-product panel had no name of its own

**Status:** fixed
**Severity:** minor
**Found by:** Devi with seven panes open, being told something was unsaved
**Surface:** `commerce.product.detail` (new) — piggles
**Filed:** 2026-09-09

## What was wrong

Her tab read **"Product"**, and the unsaved chip in the status bar read:

> Not saved: **a panel**

`panelName` in `status-bar.tsx` falls back to `'a panel'` when a pane has not
named itself:

```ts
function panelName(pane: PaneDescriptor): string {
  return pane.title ?? 'a panel';
}
```

With seven panes open, "a panel" tells her something is unsaved and not which
thing. Every other create pane in the console says what it is: New supplier, New
purchase order, New cost, New bundle, New discount, New price list, New category,
New group, New gift card.

## Why

`product-detail.tsx` sets a title only once a product has loaded:

```ts
if (product) ctx.setTitle(product.title);
```

For `id === 'new'` there is no product, so nothing is ever set and the generic
surface title stands in. The split that moved the add form into its own file
(`product-add.tsx`) did not carry the naming with it — **the sparx twin, which
never split, still does `ctx.setTitle('New product')`.**

## The fix

```ts
useEffect(() => {
  ctx.setTitle('New product');
}, [ctx]);
```

## Proven

The tab reads **New product** before anything is typed, and the status bar reads
**"Not saved: New product"** once it is.
