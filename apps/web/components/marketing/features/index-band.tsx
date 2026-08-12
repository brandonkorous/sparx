import { Band } from '../band';
import { FEATURES } from '../pricing/data';
import { CapabilityCatalog } from './catalog';

/**
 * Server shell for the searchable index.
 *
 * It exists to do the one thing the client component must not: join the catalog
 * to the PRICES, which live in `pricing/data.ts` — the single source for every
 * pricing surface on the site. Importing that module from a `'use client'` file
 * would drag its lucide icon imports (`INCLUDED`) into the browser bundle for
 * thirteen strings, so the join happens here and crosses the boundary as a plain
 * `Record<string, string>`.
 *
 * The `+ ` prefix on `FEATURES[].price` is pricing-page grammar — that table
 * reads as a running total ("+ $49/mo"). Here each module stands alone, so the
 * prefix comes off.
 */
const PRICES: Record<string, string> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.price.replace(/^\+\s*/, '')])
);

export function FeaturesIndexBand() {
  return (
    // Tighter top padding than the band default: the hero's own bottom padding
    // already sits above this, and stacking both put ~256px of empty grey
    // between the headline and the search box that opens the section.
    <Band tone="page" className="pt-10 lg:pt-14">
      <CapabilityCatalog prices={PRICES} />
    </Band>
  );
}
