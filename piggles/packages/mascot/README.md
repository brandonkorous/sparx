# @piggles/mascot

Piggles the character: the pose catalog, the intent map, and the one component
that renders her.

```tsx
import { PigglesMascot } from '@piggles/mascot/react';

<PigglesMascot intent="no-results" size="md" />   // name the situation
<PigglesMascot app="bookings" size="lg" />        // the empty state of an app
<PigglesMascot pose="cheerleader" size="xl" />    // a pose, when the art IS the point

<PigglesMascot pose="idea" size={{ base: 'md', lg: 'lg' }} />   // two widths, one hint
<PigglesMascot pose="laptop-coffee" size="fill" sizes="(min-width: 1024px) 38rem, 100vw" />
```

Never a filename, never a raw `<img>` against `/mascot/*`.

### Size is how big SHE is, not how wide the image is

`sm` 84 · `md` 152 · `lg` 250 · `xl` 390 · `fill`. Those numbers are **the
character's height in CSS pixels**, not the image's width, and the difference is
the whole reason this prop is not a free `width`.

The poses do not frame her the same way. `builder` is the figure alone at aspect
ratio 0.72; `calendar-desk` is a table with a laptop and a calendar on it at 1.49.
Give both the same 176px width and the pig in one renders 203px tall and the pig
in the other 107px — in the same slot, for no reason a viewer can see. So the
component solves for it instead:

```
imageWidth = (characterHeight / pose.subject) × (pose.width / pose.height)
```

`pose.subject` is the fraction of the artwork she occupies, measured from her own
pink mass by the ingest. The result is snapped to a rung of a literal width ladder
— Tailwind scans source text, so a computed class would generate nothing — which
costs about 5% of rounding against the 90% it removes.

Two further consequences, both of which have bitten:

- **Never set a width at the call site.** `size` sets the width AND the `sizes`
  hint together; a `className="w-52"` on top wins the layout while the hint still
  claims the old number, so the browser downloads a small srcset entry and CSS
  stretches it. The image looks right and arrives blurry.
- The object form pairs a phone size with a desktop one and keeps the hint in
  step. `fill` opts out of all of it — the container decides, and `sizes` is
  required because the right answer depends on the layout.

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

Nothing else, **as long as the batch re-cuts poses rather than renaming them.**
Pose ids are semantic and permanent; the batch number is provenance recorded on
the entry, not a namespace.

A batch that changes the ROSTER is a different job and cannot be done by flipping
a flag — see the note on 2026-08-15 below. Check the manifest's ids against
`MascotPoseId` before running the ingest: any id that disappears is a call site
and an intent chain to re-decide, and `pnpm typecheck` is what will tell you
which ones.

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

All five are active. Fifty poses, none planned-but-undrawn.

| Batch | Poses | What it draws                                               |
| ----- | ----- | ----------------------------------------------------------- |
| `01`  | 10    | Character archetypes — the figure alone, front-on           |
| `02`  | 10    | The figure holding one prop — envelope, chart, parcel, bulb |
| `03`  | 10    | System states — empty, error, loading, no-results           |
| `04`  | 10    | Business settings — a counter, a shelf, a meeting room      |
| `05`  | 10    | One round table, ten activities. A day at one desk.         |

### The 2026-08-15 re-delivery, and why it was not a swap

All five arrived together, wearing the actual brand — the black tee with the pink
Piggles mark, and the mark again on the props. Batch `01` had been the only active
one and `02` was parked as a known-wrong cut; both of those facts are now history.

The part worth remembering: **the re-delivery replaced the roster rather than
re-cutting it.** `01` used to key its poses `wave`, `desk`, `laptop`, `neutral`,
`thinking`, `point-left`, `calendar`, `invoice`, `celebrate` and carry a 40-pose
roadmap. It now keys them by role — `mascot-base`, `planner`, `analyst`,
`communicator`, `builder`, `protector`, `money-minder`, `organizer`,
`cheerleader`, `sidekick` — and carries no roadmap at all. Every old id was gone,
so this was not a flag flip:

- Every chain in [src/intents.ts](src/intents.ts) was re-decided by looking at the
  fifty new poses, not by mapping old names to new ones.
- `callout` **flipped direction**. The old `point-left` does not exist and the new
  `point-right` extends her arm to the viewer's right, so the thing being pointed
  at moves to the other side. A directional pose is the one case where the art
  constrains the layout.
- Three call sites that name a pose directly were re-chosen against the artwork:
  the account app's sign-in panel, the marketing close band, and the six beats of
  the scroll film.
- The account panel's floating cards were re-measured. The new cut's clear region
  is narrower (x 0–33% against 0–42%), so cards carried over at their old widths
  would have run into her shoulder.

## Intent chains

An intent maps to an ordered chain; resolution takes the first pose whose art
exists. A chain may name poses that are still on the roadmap:

```ts
'sign-in': ['laptop-coffee', 'mascot-base'],
```

The chain type requires the **last** element to be a pose that ships, so an intent
can never resolve to nothing. Earlier elements may name a pose that is not drawn
yet; the day its batch lands, every screen using that intent upgrades itself with
no edit here and none at any call site.

All fifty poses are drawn, so no chain falls through today and most are a single
element. The mechanism stays because it is what makes the next roadmap batch a
no-op at every call site — and because a second choice is genuinely better than
nothing in a couple of places (`sign-in` and `milestone` both carry one).

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
