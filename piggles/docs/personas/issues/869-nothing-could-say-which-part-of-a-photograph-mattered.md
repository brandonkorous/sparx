# 869 — Nothing could say which part of a photograph mattered

**Status:** fixed
**Severity:** **major** — every picture is cut to four other shapes before it
goes out, and `media_assets.focal_point_x/y` decides what survives the cut. The
media worker bakes those four crops around it, the API republishes a recrop
event when it moves, the social composer positions every preview by it, and the
article serializer writes it into published HTML. **No screen in either console
could write it.** So a photograph whose subject stands to one side is cropped by
a guess, and the owner has no way to say otherwise
**Found by:** P03 · act 308, sweeping the Content surface with the dev ports
down, from the code and the database
**Surface:** mypiggles › Photos and files › a picture, in both consoles
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 23 tests, proved red by reinstating the naive rule

## Five layers read it. Nothing wrote it.

```
media_assets.focal_point_x/y   Float, DEFAULT 0.5, CHECK (BETWEEN 0 AND 1)

READ  media-worker/crop.ts          bakes 1:1, 4:5, 9:16, 16:9 around it
READ  media-worker/processor.ts     regenerateCrops, for when it moves
READ  api-rest media/assets.ts      republishes media.uploaded, reason 'recrop'
READ  social/post-preview.tsx       focalClassFor, 6 call sites, both consoles
READ  cms-editor/serialize.ts       object-position:X% Y% in published HTML

WRITE api-rest media/assets.ts      PATCH accepts focal_point_x / focal_point_y
                                    …and audits the before/after as `focalPoint`
WRITE  — nothing. Anywhere.
```

The console's own wire type has carried it the whole time, and the mapper threw
it on the floor:

```ts
interface MediaAssetWire {
  …
  focal_point: { x: number; y: number };   // ← arrives on every read
}

function toAsset(wire: MediaAssetWire): MediaAsset {
  return {
    …
    durationSec: wire.duration_sec,
    // and that is the end of the function. focal_point is not on MediaAsset.
  };
}
```

[[feedback_fetched_but_never_rendered]] — the value is in the function's hand and
discarded one line later.

The only caller of the update hook, in either console, sends two fields:

```ts
const save = () => {
  update.mutate({
    alt_text: draft.altText.trim() ? draft.altText.trim() : null,
    caption: draft.caption.trim() ? draft.caption.trim() : null,
  });
};
```

## Measured

```
3,224 media assets, 3,221 of them images, across 91 tenants
    0 with a focal point anywhere other than dead centre
   87 of them Devi's
```

Zero is what a column with no writer produces. No MCP tool writes it either, and
nothing in the builder or the site renderer does.

## Two documents said the control existed

The schema, on `media_variants.aspect`:

> …a focal-point-aware cover crop the media worker derives so a post's image
> arrives correctly framed on each platform without the tenant cropping it by
> hand. The composer previews these + **exposes the draggable focal point**
> (media_assets.focal_point_x/y)

And the social audit, in the entry whose whole job is to record the difference
between what was promised and what shipped:

> The composer's focal point is read-only. §15.2 promised a draggable focal point
> per target. What ships reads `focalX`/`focalY` off the media asset and quantizes
> to nine buckets. **The focal point is editable in the media library**, just not
> from the composer, and never per-target.

It was not editable in the media library. The audit caught the composer half and
asserted the other half as the consolation. Both sentences are corrected in this
pass. [[feedback_verify_capability_in_code_not_docs]]

The pane's own header comment explains why nobody built it:

> The bytes cannot be re-transcoded, so there is nothing to "edit" about the
> picture; what you own is its DESCRIPTION.

Which is a reasonable belief, and wrong: the crops are re-derived on demand, and
`regenerateCrops` exists for exactly the edit the comment says is impossible.

## The part that changes the design: centre is not the middle

```ts
const isDefaultFocal = (x, y) => Math.abs(x - 0.5) < 0.001 && Math.abs(y - 0.5) < 0.001;
…
const useAttention = isDefaultFocal(fx, fy);
if (useAttention) {
  // Subject-aware crop — libvips keeps the salient region in frame.
```

At dead centre the worker **ignores** the stored pair and asks libvips to find
the subject. Anywhere else it obeys the pair exactly.

So the harm is not "everything is centre-cropped". It is subtler and worse to
argue with: **the machine guesses, usually well, and when it guesses wrong there
is no recourse.** And because 0 of 3,221 images has ever been moved, the
honour-the-tenant branch has never run on this platform.

It also settles the control's shape. "Middle" cannot be offered as the ninth
position, because storing it means "nobody told me". So the middle tile says
**Let us choose**, and is labelled as what it does rather than where it is.

## What it does now

```
Which part matters
This picture gets cut to other shapes when it goes out: a square for most posts,
a tall one for stories, a wide one for a link. This decides what survives the
cut. Saving re-cuts those copies.

  The part to keep
  ┌────────────┬────────────┬────────────┐
  │ Top left   │ Top        │ Top right  │
  ├────────────┼────────────┼────────────┤
  │ Left       │ Let us     │ Right      │
  │            │ choose     │            │
  ├────────────┼────────────┼────────────┤
  │ Bottom left│ Bottom     │ Bottom righ│
  └────────────┴────────────┴────────────┘
  Whatever is at the left stays in frame. The rest is trimmed away.

  What each shape keeps
  ┌──────┐ ┌────┐ ┌──┐ ┌──────────┐
  │      │ │    │ │  │ │          │
  │Square│ │Tall│ │Fu│ │   Wide   │
  └──────┘ └────┘ └──┘ └──────────┘
  Most posts  Taller posts  Stories and reels  Link previews
```

Those four are exactly the four the worker bakes, in its own order, named by
shape rather than by ratio: "9:16" is not a thing a shop owner measures anything
in.

**The previews appear only once a part is chosen.** While the machine is
choosing, this console cannot know what it will keep, and four previews drawn at
centre would be claiming otherwise.
[[feedback_never_present_absence_as_measurement]]

## Nine tiles and not a drag

Tailwind cannot compile an interpolated arbitrary value and an inline `style` is
banned, so every framing this console can DRAW is one of nine static `object-*`
classes — the constraint the social composer already met, with its reason written
down. A continuous pin would let someone store 0.62 and then be shown the
identical picture as 0.5: a control promising precision the preview cannot
honour. The nine tiles write exactly 0, 0.5 or 1, so what she picks is what she
sees and what the worker crops to.

A true drag needs a runtime value in the DOM, which is an authorization
question, not mine. It is not what was missing: what was missing was any way at
all.

## The edge that made the tests worth writing

Over the API any float in [0,1] is legal — the media upload integration test
already PATCHes `0.7 / 0.3`. A value inside the middle third that is **not** the
centre, say `0.6 / 0.5`, is one the worker obeys while no tile represents it.

The naive rule ("highlight the nearest tile") lights **Let us choose** for that
point, and the sentence beneath reads "we look for the main subject" about a
point the worker is obeying exactly. So nothing is highlighted there, and
`positionName` gives the sentence a word ("middle") that is never a tile's name.

`focalClassFor` and the tile geometry now share one `bucket` helper, so a
highlighted tile and the drawn crop cannot drift apart.

## Proved

**23 tests**, proved red by reinstating the naive rule and letting the sentence
borrow the tile's label:

```
isCellChosen → nearestCell, focalHelp → the tile label   →  2 of 23 fail
```

Worth recording **which** two: the wrong implementation is green on all nine
tiles and green on every round trip. Only the off-grid point catches it. A test
suite that had exercised just the nine choices would have passed the bug through.
[[feedback_a_test_that_cannot_go_red]]

The tolerance is the worker's own `0.001`, mirrored on purpose and named in a
comment: if this console called `0.4999` "left" while the worker called it
centre, the pane would name a framing the baked crop does not use.

**Checks:** typecheck 0 on both workbenches. Tests: piggles workbench 149 files
/ 1418, sparx 117 / 1114. All ten guards OK. ESLint and prettier clean.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/cms/focal-point.ts` (new)
- `piggles/apps/workbench/surfaces/cms/focal-point.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/cms/media-detail.tsx` (the control)
- `{piggles,sparx}/apps/workbench/surfaces/cms/media-admin.ts` (stop dropping it)
- `{piggles,sparx}/apps/workbench/surfaces/social/post-preview.tsx` (the function moves)
- `{piggles,sparx}/apps/workbench/surfaces/social/post-visuals.tsx` (its new home)
- `docs/social-audit/00-README.md` (the false claim)
- `wizeworks/packages/db/prisma/schema/15-cms-media.prisma` (the false claim)

## Three typecheck errors, and what each was worth

The first was a real bug: `...focalFromWire(wire.focal_point)` spreads `{x, y}`
into a type wanting `focalX` / `focalY`, so the asset would have compiled only
if the field had been named the same on both sides. The second was
`noUncheckedIndexedAccess` refusing `FOCAL_CELLS[4]`, fixed by naming the centre
cell once and reusing it rather than indexing. The third was the honest cost of
moving a function: a re-export does not bring a name into the module's own
scope, and the composer's preview uses it fourteen lines down.

## The thing to remember

**A capability built in five layers and absent from one reads as finished from
every layer you check.** The column has a constraint, the worker has a branch for
it, the route has an audit trail for it, the event exists to re-cut on it, and
two documents describe the control. Every one of those is evidence the feature
shipped. The only artifact that tells the truth is the write path, and the
question that finds it is always the same: **what writes this?**

And the second time in two acts: **a comment naming a control is a claim the
control exists** — but this one was in an AUDIT, the document whose entire
purpose is to say what really ships.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## Also checked on this surface, and not filed

- **`dominant_color` and `blurhash`** are on the wire and on no screen. Both are
  loading-state polish rather than a decision the owner makes, and nothing on the
  platform reads them either, so there is no gap between layers to close. Noted,
  not filed.
- **A focal control in the picker** (the modal used when choosing a photograph
  for a product or page) was considered and dropped. The picker's job is to
  choose a file; framing belongs to the file, and putting it in two places
  invites two answers. The pane is one click away.
- **Per-target framing in the composer** is what §15.2 actually promised, and is
  still absent. It needs a `mediaOverride` per target, which the data model
  supports and nothing writes. That is a bigger piece of work than this one and
  belongs in its own issue, with the audit entry now saying so truthfully.
