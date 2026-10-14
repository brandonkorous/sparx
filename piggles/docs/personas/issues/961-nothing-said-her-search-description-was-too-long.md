# 961 — Nothing said her search description was too long

**Status:** fixed (act 8)
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 8
**Surface:** mypiggles › Content › a piece › Search engine listing (both consoles)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 8, the barley piece
**Blocked on:** —

## What happened

She wrote a search description of 161 characters. Most results print about 155, so its
last words would not show. Under the box: "The gray summary shown under the link." Nothing
told her.

The product editor's search tab says "Usually shown in full up to about 155 characters"
and shows a warning past it. The piece editor said neither. Its search title box also did
not say the site's name is added on the end, the mistake issue 373 found an owner making
on five pages.

## The fix

`surfaces/cms/content-detail.tsx`, both consoles:

- Search title: "Your site’s name is added on the end, so you do not need to type it."
- Search description: "Usually shown in full up to about 155 characters.", and past
  155 the product editor's warning, "Longer than most results show: the end will be cut
  off".

## Proof

On screen: at 161 the warning showed; she cut it to 144, the warning went, and she saved.
Both consoles typecheck and lint clean; console copy tests pass (piggles 213, sparx 110).
