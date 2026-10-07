'use client';

// Everything this console says about itself, in one place.
//
// ── WHY A SEAM WHEN THE APP OWNS ITS OWN SURFACES ───────────────────────────
//
// This app owns its ~500 surfaces outright (piggles/CLAUDE.md RULE #0), so in
// principle every one of them could simply be edited to say "Piggles". The seam
// survives the fork anyway, because the problem it solves is not ownership:
//
//   • ~220 screen NAMES and several hundred SENTENCES would each have to be
//     found and edited by hand, and the next platform improvement merged in from
//     upstream would quietly undo the ones it touched.
//   • A wording decision made in one file is a decision somebody can revise. The
//     same decision spread across four hundred files is a decision nobody can
//     find, let alone revise.
//   • The surfaces stay readable as PROSE to whoever maintains them, because the
//     fallback sitting inline at the call site is a real sentence rather than a
//     lookup key.
//
// So: the surfaces carry the platform's original wording as their fallback, and
// everything Piggles says differently is written here and in ./copy.ts,
// ./vocabulary.ts and ./state-art.tsx.
//
// ── WHAT IT CARRIES ─────────────────────────────────────────────────────────
//
//   name            the product's name, mid-sentence
//   moduleLabels    what each module is called, derived from the app registry
//   LoadingMark     the mark shown while a pane loads
//   hiddenSurfaces  whole screens this product does not have
//   hiddenFeatures  a block inside a screen this product does not have
//   copy            whole sentences, written by hand
//   surfaceTitles   what every screen is called
//   sectionTitles   what every nav group heading is called
//   StateArt        the mascot, posed to the pane's state
//
// Imported for its side effect from components/console-providers.tsx AND
// components/console-shell.tsx, at module scope, so it has run before the first
// render and before the surface catalog. Two import sites of one side-effect
// module is correct: ES modules evaluate once.

import { configureProduct } from '@/lib/product';
import type { ProductLoadingMarkProps } from '@/lib/product';
import type { WorkbenchModule } from '@/components/module-scope';
import { APPS } from '@piggles/config';
import { Mark } from '@piggles/brand/react';
import { PIGGLES_COPY } from './copy';
import { PIGGLES_SECTIONS } from './section-names';
import { PIGGLES_CREATE_LABELS, PIGGLES_ENTITY_LABELS, PIGGLES_SURFACES } from './vocabulary';
import { PigglesStateArt } from './state-art';
import { PIGGLES_HIDDEN_FEATURES, PIGGLES_HIDDEN_SURFACES } from './hidden';

/**
 * Module names, DERIVED from the app registry rather than restated here.
 *
 * The lexicon already exists — every Piggles app declares the platform modules
 * it fronts (`PigglesAppDef.modules`), so "the CRM module is called Customers"
 * is a fact the registry already holds. Writing it out a second time would give
 * the rail and the shared surfaces two sources that drift, and the drift would
 * show up somewhere nobody looks, like a permissions matrix.
 *
 * One app routinely fronts several modules — Sell is commerce + B2B + dropship —
 * and every one of them takes the app's name, which is the point: a Piggles user
 * has never heard of "dropship" and should not meet the word in a settings
 * table.
 */
const moduleLabels: Partial<Record<WorkbenchModule, string>> = Object.fromEntries(
  APPS.flatMap((app) => app.modules.map((module) => [module, app.label]))
);

/**
 * The pig-snout P, sized by class. `currentColor` throughout, so it takes the
 * ink of whatever it is dropped into and needs no per-theme variant — which is
 * why `tone` is accepted and deliberately unused.
 *
 * `piggles-mark-breathe` is the slow 4%-over-three-seconds scale defined in
 * globals.css, and it is not decoration: this mark is what a person looks at
 * while they wait, and something that breathes reads as patient where something
 * static reads as stuck. It was lost for a while when a second copy of this
 * adapter appeared without the class — see the note on `lib/product-adapter.tsx`
 * being deleted.
 */
function PigglesLoadingMark(_props: ProductLoadingMarkProps) {
  return <Mark className="piggles-mark-breathe text-primary h-16 w-16" title="Loading" />;
}

configureProduct({
  name: 'Piggles',
  moduleLabels,
  LoadingMark: PigglesLoadingMark,
  hiddenSurfaces: PIGGLES_HIDDEN_SURFACES,
  // Written by hand, in Piggles' voice — see copy.ts for why this is not the
  // sparx sentence with the name swapped, and why it never becomes that.
  copy: PIGGLES_COPY,
  hiddenFeatures: PIGGLES_HIDDEN_FEATURES,
  // What every screen and every group heading is CALLED. The shortest copy in
  // the product and the most-read, written under the same rule as the sentences
  // above — see vocabulary.ts.
  surfaceTitles: PIGGLES_SURFACES,
  createLabels: PIGGLES_CREATE_LABELS,
  sectionTitles: PIGGLES_SECTIONS,
  entityLabels: PIGGLES_ENTITY_LABELS,
  // Piggles herself, in every empty, waiting and failed pane — small, and
  // posed to the state rather than tinted to it. See state-art.tsx.
  StateArt: PigglesStateArt,
});
