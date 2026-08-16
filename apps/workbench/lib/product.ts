// The product adapter — the ONE seam through which a brand reaches shared code.
//
// The workbench surfaces are shared platform code rendered by two shells:
// sparx's own (apps/workbench) and the Piggles console (piggles/apps/workbench).
// Almost everything that differs between the two is already carried by tokens —
// a hue, a radius, a font — and needs nothing here. Three things are not
// colors, and this file is where they live rather than becoming an
// `if (brand === …)` inside a surface (piggles/CLAUDE.md RULE #0):
//
//   • THE PRODUCT'S NAME. A handful of shared strings say it out loud ("a new
//     version of sparx is ready"). Under the other brand that sentence names a
//     product the reader has never heard of.
//   • WHAT A MODULE IS CALLED. `moduleLabel()` is called from shared surfaces —
//     the AI tool-policy matrix and the automation step editor both render it —
//     so a brand that calls CRM "Customers" cannot express that in its shell
//     alone.
//   • THE LOADING MARK. Every pane's Suspense fallback shows the brand's mascot.
//     Sparky in a Piggles console is a leak, and a generic spinner in either is
//     a loss.
//
// ── WHY A REGISTRY AND NOT A REACT CONTEXT ──────────────────────────────────
//
// `moduleLabel()` is a plain function called from render bodies, `.map()`s and
// option tables across a dozen surfaces; making it a hook would mean touching
// every one and would still not reach the non-React callers (the update toast is
// raised imperatively). A module-level registry answers all of them, and the two
// shells are separate builds, so there is no realm in which both are configured
// at once.
//
// ── HOW TO USE IT ───────────────────────────────────────────────────────────
//
// A shell calls `configureProduct()` ONCE, at module scope in its shell file, so
// it has run before anything renders. sparx's shell does not have to call it at
// all: the defaults below ARE sparx, which keeps this file from being a thing
// the platform has to remember to feed.

import type { ComponentType } from 'react';
import type { WorkbenchModule } from '../components/module-scope';

/** Props the loading mark is handed. Deliberately one field — a brand's mark is
 *  its own business, and the only thing the workbench knows that the mark cannot
 *  read for itself is which way the theme is currently pointing.
 *
 *  Note what is NOT here: a size. A numeric size has to become an inline
 *  `style`, which is banned, so a mark sizes itself with a utility class. */
export interface ProductLoadingMarkProps {
    tone: 'light' | 'dark';
}

interface ProductAdapter {
    /** The customer-facing product name, as it appears mid-sentence. */
    name: string;
    /** Overrides for `moduleLabel()`. Partial on purpose: a brand states only what
     *  it renames, and anything absent falls through to the platform's own label. */
    moduleLabels: Partial<Record<WorkbenchModule, string>>;
    /** The mark shown while a pane loads. `null` means "use the platform's". */
    LoadingMark: ComponentType<ProductLoadingMarkProps> | null;
}

const adapter: ProductAdapter = {
    name: 'sparx',
    moduleLabels: {},
    LoadingMark: null,
};

/** Point the shared surfaces at a brand. Call once, at module scope, from the
 *  shell — before the first render, and never conditionally. */
export function configureProduct(next: Partial<ProductAdapter>): void {
    Object.assign(adapter, next);
}

/** The product's name, for the few shared strings that say it out loud. */
export function productName(): string {
    return adapter.name;
}

/** The brand's name for a module, or `undefined` to use the platform's. */
export function productModuleLabel(module: WorkbenchModule): string | undefined {
    return adapter.moduleLabels[module];
}

/** The brand's loading mark, or `null` to use the platform's. */
export function productLoadingMark(): ComponentType<ProductLoadingMarkProps> | null {
    return adapter.LoadingMark;
}
