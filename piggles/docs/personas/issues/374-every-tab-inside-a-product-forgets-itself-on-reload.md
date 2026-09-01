# 374 — Every tab inside a product forgets itself on reload

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · the standing "reload, deep link, restore" check
**Surface:** mypiggles › Sell › a product › the seven tabs
**Blocked on:** scope

## What happened

A product has seven tabs: Overview, Options, Variants, Media, Details, Pricing,
SEO. Devi is on Pricing, checking what the Ash Overshirt costs her per colorway.
She presses F5.

She lands on Overview.

The same three ways:

| What she does                              | What happens      |
| ------------------------------------------ | ----------------- |
| Reload while standing on Pricing           | back on Overview  |
| Copy the address bar and open it elsewhere | opens on Overview |
| Open `/commerce/products/<id>?tab=seo`     | opens on Overview |

The address bar never changes when she moves between tabs, so the third row is
not a broken parameter — there is no parameter. The pane itself restores
correctly; it always restores onto the first tab.

For a product with fifteen variants, Pricing and Variants are long screens. Losing
your place on them is the difference between checking one number and finding it
again.

## Why it happens

The tab is local component state and nothing else:

```ts
const [tab, setTab] = useState('overview');
```

Nothing writes it to the address and nothing reads it back. This is not an
oversight in one file — the console has no concept for it. A pane's address is
built from `surface + params`, and `params` is also its **identity**:

```ts
export function descriptorKey(descriptor: PaneDescriptor): string {
  // ... every param, sorted, joined
}
```

`descriptorKey` is what "re-focus rather than duplicate when the exact same
surface+params is already open" runs on. So putting `tab` in `params` would make
`product?id=X&tab=seo` a **different pane** from `product?id=X&tab=pricing`, and
clicking a tab would open a second window on the same product. And `SurfaceContext`
is read-only on `params` — a surface can read them and cannot change them — so
even setting that aside, a tab click has no way to update its own address.

Note this is not a general gap in the console's addressing. Several product
PANELS already have real addresses — `/commerce/products/:productId?/stock`,
`/fitment`, `/reviews`, `/listings` — because each is a pane in its own right. It
is specifically state INSIDE one pane that has nowhere to live.

## Why it is not fixed here

The fix is a change to the dock's pane model, which every pane in both consoles
shares. It needs three things that do not exist:

1. **A declared set of view-only params per surface** — carried in the address,
   ignored by `descriptorKey`, so a tab change re-addresses a pane instead of
   forking it.
2. **A way for a live pane to update its own params** — a `setParams` on
   `SurfaceContext`, feeding the same address sync `nav-history.tsx` already runs.
3. **A decision about the saved layout**: whether a restored workspace remembers
   which tab each pane was on, or opens them all on their first.

That is a shared-plumbing change with a design decision inside it, which is
larger than the surface this run was testing. Filed rather than attempted, with
the design named so it is a work item and not a shrug.

**A per-product "remember the last tab" in browser storage would fix the reload
half in an afternoon and is deliberately NOT proposed**: it would make the pane
appear to have an address it does not have, and the link somebody sends would
still open on the wrong tab while looking like it worked.

## Where it lives

- `piggles/apps/workbench/surfaces/commerce/product-detail.tsx` — the `useState`
- `piggles/apps/workbench/lib/surfaces/descriptor.ts` — `descriptorKey`
- `piggles/apps/workbench/lib/surfaces/registry.ts` — `SurfaceContext.params`
- `piggles/apps/workbench/lib/workbench/nav-history.tsx` — the address sync
- `wizeworks/packages/links/src/routes.ts` — where a `tab` segment or param would
  be declared

## Not only this pane

Any pane with tabs has the same shape. Product is where it was found because it
has seven of them and two are long. The fix, if made, should be made once in the
pane model rather than seven times in seven surfaces — which is most of the
argument for doing it properly rather than quickly.
