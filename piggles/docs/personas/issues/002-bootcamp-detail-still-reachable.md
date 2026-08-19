# 002 — A Piggles business can still open sparx's bootcamp screen

**Status:** open
**Severity:** major
**Found by:** roster design · while generating the pane list for rating.md
**Surface:** mypiggles › (no rail entry) › `partner.bootcamp.detail`
**Filed:** 2026-08-18
**Fixed:** —
**Confirmed by:** —

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

—
