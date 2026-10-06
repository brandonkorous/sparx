# 374 — Every tab inside a product forgets itself on reload

**Status:** fixed (act 323)
**Severity:** minor
**Found by:** P03 · Juniper Row · the standing "reload, deep link, restore" check
**Surface:** mypiggles › Sell › a product › the seven tabs
**Blocked on:** —

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

## What changed (act 323)

The three missing pieces, built once in the pane model of both consoles:

1. **View params.** A surface declares `viewParams: ['tab']`. They ride in the
   address and the saved layout, and `paneIdentityKey` leaves them out, so
   product X on Pricing and product X on SEO are one pane.
2. **A pane can re-address itself.** `ctx.setViewParams({ tab })` changes only
   declared params (anything else throws: those are what the pane IS). The
   address bar follows through the existing sync, as a replace, so Back does not
   step through tabs. `SurfaceBody` now subscribes to its own descriptor, so a
   link to an open record moves it to the tab asked for.
3. **The saved layout remembers the tab**, because the tab is part of the
   descriptor that is saved. Decided this way because the address and the
   layout must not disagree about where a pane is.

`useViewParam` / `useViewParamHandle` (`lib/workbench/view-param.ts`) hold the
tab in the address with no local copy. A value the pane cannot show (an old
link to a tab or language that has gone) reads as the default, and the default
removes the param, so the plain address stays plain.

Every tabbed pane, both consoles: the product (`tab`), product reviews and
questions (`tab`), the customer (`tab`; Sparx falls back to Overview for
Bookings at a business without bookings), both translation editors (`lang`),
and the configurator's builds (`build`, an old link to a deleted build opens
the first).

Opening a record that is already open now focuses it and moves it to the tab
asked for, where it used to open a second copy. That also fixes the links that
already passed a tab (Cost vs plan to Pricing, core choices to Options).

## Proof

- Devi on the Ash Overshirt: Pricing put `?tab=pricing` in the address; F5
  came back on Pricing; a link with `?tab=seo` moved the one open pane to SEO
  (one Ash tab, not two); Overview cleared the param.
- `/crm/customers/<Mara>?tab=orders` opened her customer pane on Orders.
- `view-params.test.ts`, 8 tests in each console. Putting the old identity check
  back reddens exactly the 2 "already open" tests. Both consoles: typecheck,
  lint, and 2145 and 1850 tests green.

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
