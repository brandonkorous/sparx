# 235 — A deleted webhook had a "not found" state of its own

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · pane ratings (a webhook since deleted, still in Doty's saved layout)
**Surface:** Content › Webhooks › a deleted webhook; Content › Tags & topics › a deleted list, sparx console
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, the deleted webhook in Doty's workbench (light, dark, 360px)
**Blocked on:** —

## What happened

A webhook Doty had deleted reopened from his saved layout as a loud yellow box, "This
webhook no longer exists", with an outline Close button inside it. A deleted content
entry, discount or connection opens on the shared state every other pane uses: an icon,
"That discount is no longer here", and "It has been deleted, or the address points at
something that is not in this business. Nothing of yours has been lost." A deleted tag
list used a third design ("This no longer exists").

## What should have happened

One state for "this record is gone", everywhere, so it reads the same and says the same
reassuring thing.

## How to reproduce

1. Open a webhook, delete it elsewhere, reopen the pane (or a saved layout holding it).
2. Compare with a deleted discount.

## Why it matters

Small, but it is the one moment the owner may fear they lost something; the shared
state says plainly that nothing was lost, the yellow box did not.

## Where it lives

- `sparx/apps/workbench/surfaces/cms/webhook-detail.tsx`: its own `Alert color="warning"`.
- `sparx/apps/workbench/surfaces/cms/taxonomy-detail.tsx`: its own `EmptyState`.
- The shared state is `components/pane-load-error.tsx` `PaneLoadError reason="missing"`
  (used by `integration-detail.tsx`, and by both panes in Piggles already).

## The fix

Both panes use the shared state: `PaneLoadError reason="missing"`, "That webhook is no
longer here" and "That list of tags is no longer here" (with the tags glyph). Piggles
already did.

Test, red first: `surfaces/cms/gone-state.test.ts` (2, both red before). Content tests
84 pass. Lint clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13: the deleted webhook in Doty's saved layout opens on "That webhook is no
longer here. It has been deleted, or the address points at something that is not in
this business. Nothing of yours has been lost." in light, dark and at 360px. The tag
list is not checked on screen (Gillett has no deleted one).

## Rating effect

—
