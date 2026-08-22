# 002 — A Piggles business can still open sparx's bootcamp screen

**Status:** fixed
**Severity:** major
**Found by:** roster design · while generating the pane list for rating.md
**Surface:** mypiggles › (no rail entry) › `partner.bootcamp.detail`
**Filed:** 2026-08-18
**Fixed:** 2026-08-20
**Confirmed by:** P01 · Thistle & Rye, on the screen — `/partner/bootcamps/new`
opens nothing, while `/inventory/suppliers` (a real Piggles screen) still opens

## What happened

The whole of sparx's reseller programme is excluded from Piggles through
`hiddenSurfaces` in `piggles/apps/workbench/lib/console/product.tsx` — referrals,
clients, commissions, tier, resources, profile, and **`partner.bootcamps`**, the
bootcamps list.

`partner.bootcamp.detail` is not in that list. It is registered in
`piggles/apps/workbench/lib/surfaces/catalog/partner.ts` with `listed: false`,
which keeps it out of the launcher — and out of the launcher is not out of the
product. An unlisted surface is still reachable by:

- a deep link / the address bar
- a saved dock arrangement that had it open
- `createSurface: 'partner.bootcamp.detail'` on the hidden Bootcamps list, if
  anything ever resolves that

Opening it renders `BootcampDetailSurface` — a full create-and-manage screen for
another company's partner training programme, inside a Piggles console.

## What should have happened

Nothing about sparx's reseller programme should be openable in Piggles. The
hidden list and its detail pane are one screen in two states, and hiding half of
a pair is not hiding it.

## How to reproduce

1. Sign in to the Piggles console.
2. Put `partner.bootcamp.detail` in the address bar (or restore a layout holding
   it).
3. sparx's bootcamp editor renders.

Static and certain: the key is absent from `hiddenSurfaces` and present in the
catalog.

## Why it matters

**This exact defect has already been found and fixed once**, for a different
surface. STATUS.md records it under the 2026-08-14 session: `sparx_pay` was in
`hiddenFeatures` so the provider LIST filtered it out, while the DETAIL pane
stayed deep-linkable and rendered a full "Set up sparx Pay" form. The lesson
written down then was **"hiding a row and leaving its screen open is a door that
is only closed from the front."** The same door is open one module over.

It is also the rule in piggles/CLAUDE.md that has the sharpest wording — a sparx
PRODUCT is not a Piggles capability, and the default is exclude. A Piggles
customer looking at a bootcamp management screen is a support ticket.

## Where it lives

- `piggles/apps/workbench/lib/console/product.tsx` — `hiddenSurfaces`, missing
  the key
- `piggles/apps/workbench/lib/surfaces/catalog/partner.ts` — the definition, and
  the `createSurface` on the hidden list that points at it

Worth checking in the same pass: whether any **other** hidden surface has an
unlisted detail sibling. Two instances of one mistake is a pattern, and the check
is mechanical — every `hiddenSurfaces` key whose module has `listed: false`
surfaces still registered.

## The fix

Two changes, because the missing key was the symptom and not the fault.

**1. Hidden is checked where surfaces are RESOLVED, not where they are listed.**
`productHidesSurface` was only consulted by the nav — the one door somebody has
already come through. A deep link, a restored layout, a tab dropped from another
window and another surface's `open()` each arrive by their own route, and every
one of them goes through `getSurface(key)` first. So that is where the check
belongs:

```ts
export function getSurface(key: string): SurfaceDefinition | undefined {
  if (productHidesSurface(key)) return undefined;
  return registry.get(key);
}
```

Every caller already handled `undefined` — a hidden surface is now the same
not-here that a deleted one would be. `listed: false` means "not offered";
hidden means "not here", and the two are no longer confused.

**2. The reseller programme is hidden as a NAMESPACE, not as seven keys.**
Seven keys were written out; the eighth was missed. `hiddenSurfaces` entries may
now be `module.*`, so:

```ts
'partner.*',            // was seven keys, one of which was missing
'platform.settings.partner',
```

cannot miss the ninth. Checked before shipping it that no Piggles capability
lives under `partner.` — the Piggles **Partners** app (the reader's own
suppliers) is built entirely from `inventory.*` and `dropship.*` claims, listed
in `@piggles/config`.

## Where the fix lives

- `piggles/apps/workbench/lib/surfaces/registry.ts` — `getSurface`, `listedSurfaces`
- `piggles/apps/workbench/lib/product.ts` — `productHidesSurface`, namespace form
- `piggles/apps/workbench/lib/console/product.tsx` — `partner.*`
