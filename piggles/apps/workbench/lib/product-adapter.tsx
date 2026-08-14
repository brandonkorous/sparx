'use client';

import { Mark } from '@piggles/brand/react';
import { MODULE_TERMS, PRODUCT } from '@piggles/config';
import { configureProduct } from '@workbench/lib/product';
import type { WorkbenchModule } from '@workbench/components/module-scope';

// Pointing the shared surfaces at Piggles.
//
// The ~500 workbench surfaces are shared platform code that neither shell may
// fork (piggles/CLAUDE.md RULE #0). Almost everything that differs between the
// two products is carried by tokens and needs nothing here. This file is the
// remainder — the handful of things a surface says out loud that are not a
// colour — and it is DATA handed to the platform, never a brand check inside it.
//
// ── WHY THIS MODULE HAS A SIDE EFFECT ───────────────────────────────────────
//
// `configureProduct()` runs at module scope rather than from a component, and
// that is deliberate: `moduleLabel()` is a plain function called from render
// bodies across a dozen surfaces, so the answer has to be right before the first
// render rather than after the first effect. Importing this module IS the
// configuration.
//
// It follows that the import has to be somewhere that certainly loads first.
// components/console-providers.tsx imports it, and the layout renders that above
// everything else — including the root error boundary, which is the one consumer
// that renders when the app has otherwise fallen over.

// One entry per module, from the lexicon — NOT from the app registry.
//
// The registry's labels name PLACES ("Sell" is one rail item covering commerce,
// B2B and dropship); this table names THINGS. `moduleLabel()` is called from
// shared surfaces that enumerate modules side by side — the AI tool-policy
// matrix, the automation step editor — where three rows all called "Sell" is
// worse than the acronym it replaced. See MODULE_TERMS in @piggles/config.
const MODULE_LABELS: Partial<Record<WorkbenchModule, string>> = MODULE_TERMS;

/** The loading mark: the Piggles snout, breathing.
 *
 *  Sized with a utility rather than a numeric prop (that would be an inline
 *  `style`, which is banned), and coloured through `text-primary` so it tracks
 *  the token in both themes rather than baking the pink in — which is also why
 *  it ignores the `tone` it is handed. The motion is one keyframe in
 *  globals.css, guarded by `prefers-reduced-motion`. */
function PigglesLoadingMark() {
  return <Mark className="piggles-mark-breathe text-primary h-16 w-16" title="Loading" />;
}

configureProduct({
  name: PRODUCT.name,
  moduleLabels: MODULE_LABELS,
  LoadingMark: PigglesLoadingMark,
});

/** Exported so the import is a value and cannot be dropped as unused. Nothing
 *  reads it; the side effect above is the point. */
export const PRODUCT_CONFIGURED = true;
