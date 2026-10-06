// The starting-point match: which template a story begins from.
//
// Shared by both consoles' onboarding (sparx and Piggles), which each carried an
// identical copy until sparx persona issue 003. The copies matched only on the
// blueprint's VERTICAL, four broad buckets, so within `services` a fitness story
// was handed "Accounting (Advisory)" (the least-content template in the bucket)
// while "Fitness (Bold)" sat right beside it. Industry-specific keys now decide
// first; a story whose industry has no template of its own starts blank.
//
// Within a trade, the template that puts MORE of the owner's modules to work wins.
// The least-content rule alone handed Gillett Diesel (a parts shop that sells
// online, wholesales and repairs) "Auto (European Specialist)", a booking-only
// site for BMW and Mercedes repair with no shop, while "Garage" (a parts shop, a
// booking page and a wholesale page) sat beside it (sparx persona issue 013).

import type { BlueprintVertical, Industry } from './clauses';

/** The fields of a catalog blueprint the match reads. Structural, so each console
 *  passes its own gallery type without a shared DTO. */
export interface StarterBlueprint {
  key: string;
  vertical: BlueprintVertical;
  requiresModules: string[];
  contents: {
    products: number;
    pages: number;
    content: number;
    emails: number;
    collections: number;
    categories: number;
  };
}

function richness(bp: StarterBlueprint): number {
  const c = bp.contents;
  return c.products + c.pages + c.content + c.emails + c.collections + c.categories;
}

/**
 * Pick the starting-point blueprint for a story.
 *
 * 1. Only blueprints whose required modules are ALL already on (so installing one
 *    never silently bills a module the owner did not choose).
 * 2. If the industry names its templates (`blueprintKeys`), only those qualify.
 *    None installable means a blank Builder site: obviously-generic beats
 *    detailed-and-wrong, and another trade's template is the most wrong of all.
 * 3. The template that uses the most of the owner's modules wins: every module it
 *    needs is one the owner turned on (step 1), so more of them is more of what
 *    they asked for.
 * 4. Then the vertical match (the only signal when no industry is chosen).
 * Ties go to the least content-rich (an owner will not proofread every seeded
 * page), then alphabetically by key. Returns null for a blank Builder site.
 */
export function pickBlueprint<T extends StarterBlueprint>(
  industry: Industry | null,
  modules: Record<string, boolean>,
  blueprints: T[]
): T | null {
  const compatible = blueprints.filter((bp) => bp.requiresModules.every((m) => modules[m]));
  const keys = industry?.blueprintKeys ?? [];
  const pool = keys.length
    ? compatible.filter((bp) => keys.some((k) => bp.key.includes(k)))
    : compatible;
  if (!pool.length) return null;

  const wanted = industry?.vertical ?? (modules.commerce || modules.b2b ? 'retail' : 'content');
  return (
    [...pool].sort((a, b) => {
      if (a.requiresModules.length !== b.requiresModules.length) {
        return b.requiresModules.length - a.requiresModules.length;
      }
      const aMatch = a.vertical === wanted ? 1 : 0;
      const bMatch = b.vertical === wanted ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      if (richness(a) !== richness(b)) return richness(a) - richness(b);
      return a.key.localeCompare(b.key);
    })[0] ?? null
  );
}
