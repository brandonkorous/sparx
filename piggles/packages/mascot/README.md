# @piggles/mascot

Piggles the character: the pose catalog, the intent map, and the one component
that renders her.

```tsx
import { PigglesMascot } from '@piggles/mascot/react';

<PigglesMascot intent="no-results" size="md" />   // name the situation
<PigglesMascot app="bookings" size="lg" />        // the empty state of an app
<PigglesMascot pose="celebrate" size="xl" />      // a pose, when the art IS the point

<PigglesMascot pose="thinking" size={{ base: 'md', lg: 'lg' }} />   // two widths, one hint
<PigglesMascot pose="desk" size="fill" sizes="(min-width: 1024px) 38rem, 100vw" />
```

Never a filename, never a raw `<img>` against `/mascot/*`.

Sizes are named (`sm` 96 · `md` 176 · `lg` 288 · `xl` 448 · `fill`) rather than a
free `width`, because the rendered width and the `sizes` hint have to agree and a
mismatch is invisible — the image looks right and arrives under-resolved. The
object form pairs a phone width with a desktop one and keeps the hint in step;
`fill` hands the width to the container and takes `sizes` as required.

## Required in every consuming app

```css
/* app/globals.css */
@source '../../../packages/mascot/src/**/*.{ts,tsx}';
```

Tailwind v4 scans the app's own tree, not the workspace packages it imports. The
component picks its width from literal class strings (`w-44`, `lg:w-72`), and
without this scan **none of them are generated**: she silently falls back to
`max-w-full` and fills whatever column she is in, at whatever size that happens to
be. Nothing reports it — not typecheck, not `next build`, not the browser console.
It is the same failure `@piggles/brand`'s mark components hit, which is why the
`@source` line for those sits directly above this one in each app.

The three apps are wired. A fourth needs this line, the workspace dependency, and
an entry in `TARGETS` in [scripts/ingest.mjs](scripts/ingest.mjs).

## How a batch of art becomes shipped assets

```
piggles/images/mascot/01/     delivered batch — an INPUT, never imported
        │
        │  pnpm --filter @piggles/mascot ingest
        ▼
src/catalog.ts                GENERATED — typed poses + true intrinsic sizes
piggles/apps/*/public/mascot/ GENERATED — trimmed WebP, one copy per app
```

Both outputs are generated and committed. Review the diff; never hand-edit them.
To change a pose's metadata, edit the batch manifest and re-run.

### Adding a batch

1. Drop it in `piggles/images/mascot/<NN>/`.
2. Add `'<NN>'` to `ACTIVE_BATCHES` in [scripts/ingest.mjs](scripts/ingest.mjs).
   Order is precedence — **last wins a duplicate pose id**, so a re-cut
   supersedes in place and no product code changes.
3. Run the ingest and read the diff.

Nothing else. Pose ids are semantic and permanent; the batch number is
provenance recorded on the entry, not a namespace.

### What the ingest does that a copy-paste would not

- **Trims to the alpha bounding box.** The declared dimensions in a manifest are
  the generator canvas, not the artwork. Batch 02 declares every pose 1536×1024
  (ratio 1.50) while the pig occupies 41–55% of it — `thinking` is really
  673×963, ratio 0.70. Untrimmed, every mascot renders half-size inside an
  invisible box and no two poses line up.
- **Caps resolution** at 1200px on the long edge. `next/image` handles the rest.
- **Normalises the two manifest schemas** — 01 keys poses `wave` with `intent[]`
  and flat paths, 02 keys them `piggles-wave` with `uses[]` and `formats{}`.
  That normalisation is what lets call sites say `pose="wave"` forever.
- **Rebuilds each `public/mascot/` wholesale**, so a retired pose disappears from
  the apps instead of serving forever with nothing referencing it.

## Batch status

| Batch | Poses | State                                                     |
| ----- | ----- | --------------------------------------------------------- |
| `01`  | 9     | **Active.** Also carries the 40-pose roadmap.             |
| `02`  | 11    | **Parked** — wrong cut, pending re-delivery (2026-08-14). |

Ingesting 02 as delivered would put two visually different Piggles on one screen:
it re-cuts four poses 01 already ships (`wave`, `thinking`, `celebrate`,
`invoice`) in different framing and with a ground shadow 01 does not have. When
it is re-cut, adding `'02'` to `ACTIVE_BATCHES` is the whole change — the seven
poses it adds (`coffee`, `computer`, `package`, `phone`, `point-right`,
`point-down`, `thumbs-up`) already appear in intent chains in
[src/intents.ts](src/intents.ts) and will light up on ingest.

## Intent chains

An intent maps to an ordered chain; resolution takes the first pose whose art
exists. A chain may name poses that are still on the roadmap:

```ts
'no-results': ['searching', 'thinking'],
```

`searching` is not drawn, so this resolves to `thinking` today and upgrades
itself the day that batch lands — no edit here, none at any call site. The chain
type requires the **last** element to be a pose that ships, so an intent can
never resolve to nothing.

Today 9 of 49 poses are drawn, which is why most chains fall through to a generic
pose. The chains are already correct; ingesting art is what makes them specific.

## Where the policy lives

DESIGN.md: the mascot earns her keep in empty states, onboarding, success moments
and 404s — and is **never** present during money, tax, payroll or deletion. That
was prose nobody could enforce. It is now structural: `MascotIntent` is a closed
union with no member for a deletion confirm, a failed payment, a past-due
account, a tax filing, a payroll run, or a capacity block. Adding one means
adding a line and being asked why.

An empty Invoices list is not one of those moments — nobody is anxious about a
list they have not filled in yet — which is why `invoices` and `money` appear as
app empty states and nowhere else.

## Known follow-up

`MASCOT_BY_APP` mirrors the `@piggles/config` app ids rather than importing them,
because `APPS` is annotated `readonly PigglesAppDef[]`, which widens every `id`
to `string`. Switching that to `as const satisfies` would export a real
`PigglesAppId` union and let this map be checked for coverage — an app added
without an empty-state pose would fail `pnpm typecheck` instead of falling back.
It needs `PigglesAppDef.modules` to become `readonly ModuleKey[]`, so it is a
separate change to `@piggles/config`. Until then an unmapped app resolves to the
generic `empty` pose, which is correct, just unspecific.
