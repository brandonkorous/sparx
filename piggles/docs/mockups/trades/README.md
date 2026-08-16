# Drop folder — trade mascots

Save each render here as `<slug>.png` (transparent background, square canvas).
[../whoever-marquee.html](../whoever-marquee.html) picks them up by filename; a
missing file renders as a dashed placeholder with the trade name in it, so the
layout is legible with an empty folder and fills in one image at a time.

| Slug           | Trade          | Scene it needs                         |
| -------------- | -------------- | -------------------------------------- |
| `bakery`       | A bakery       | ✅ delivered — counter, bread, tray    |
| `barber`       | A barber       | chair, mirror, clippers                |
| `potter`       | A potter       | wheel, shelf of finished pieces        |
| `garage`       | A garage       | ramp or bench, toolboard               |
| `market-stall` | A market stall | trestle table, awning, produce crates  |
| `salon`        | A salon        | styling station, basin                 |
| `tailor`       | A tailor       | machine, dress form, bolts of cloth    |
| `studio`       | A studio       | easel or camera, lights                |
| `workshop`     | A workshop     | bench, hand tools, offcuts             |
| `supplier`     | A supplier     | pallets, stacked boxes, clipboard      |
| `shed`         | A shed         | small bench, jars of parts, one window |
| `florist`      | A florist      | buckets of stems, wrapping bench       |
| `cafe`         | A café         | espresso machine, cups, pastry case    |
| `butcher`      | A butcher      | counter, block, scales                 |

## The spec every render shares

1. **Square canvas, transparent background.** No baked ground shadow implying a
   floor color — a soft contact shadow only. The card ground changes per
   treatment and a hard shadow pins it to one.
2. **Same character scale.** Her head the same size in every image. The catalog
   stores a per-pose `subject` fraction because this drifts between batches;
   consistency here means every card sizes identically with no per-image tuning.
3. **Bottom-anchored prop across most of the width** — counter, bench, chair,
   trestle. This is what lets every card bleed the bottom edge the same way, and
   it is the difference between a scene and a sticker.
4. **Same camera height (eye level) and the same light direction** as `bakery`
   (light from the left).
5. **The pink "P" apron in every one.** It is the through-line that makes
   fourteen trades read as one character rather than fourteen pigs.
6. **Nothing crossing the top edge**, so a card can crop from the top without
   cutting through a prop.

## Getting them into the product

These are a new mascot batch, not loose files. The real path is a manifest under
`piggles/images/mascot/` → `pnpm --filter @piggles/mascot ingest`, which
regenerates `packages/mascot/src/catalog.ts` and rewrites each app's
`public/mascot/`. Feature code never references a filename — it renders
`<PigglesMascot pose="bakery">`. This folder is for the mockup only.
