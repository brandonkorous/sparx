// Page Template catalog — code-first presets a PageLayout begins from (docs/36
// §3, §10). A Page Template is a PLATFORM-authored, read-only starting point
// ("begin here"); instantiating one produces an editable PageLayout the merchant
// owns. This generalizes `DEFAULT_TEMPLATES` (the built-in product/collection
// composition) into a catalog: the built-in defaults are two entries, plus a
// "blank" start-from-nothing entry.
//
// Code-first, catalog-ready (§10): the templates live in the repo now; a
// DB-backed, merchant-extensible catalog is a later, purely-additive step that
// does NOT change this model (a Template is still instantiated into a Layout).

import { DEFAULT_TEMPLATES, type DefaultTemplateSection } from './default-templates';
import { type TargetBinding, getLayoutTarget } from './layout-targets';

export interface PageTemplate {
  /** Stable catalog id (the instantiate input references this). */
  id: string;
  /** Merchant-facing name; the instantiated layout's default name. */
  name: string;
  description: string;
  /** The binding this template's bound sections require, or null for a template
   *  with no bound sections. A bound template only fits a target of the SAME
   *  binding (a product template can't compose a collection page); a null-binding
   *  template fits every target. */
  binding: TargetBinding | null;
  /** The composition copied into real SiteSection rows on instantiate. */
  sections: DefaultTemplateSection[];
}

// The near-term code-first catalog. The two "standard" entries reuse the exact
// DEFAULT_TEMPLATES compositions, so a layout begun from them renders identically
// to today's seeded default; "blank" starts empty for full hand-composition.
export const PAGE_TEMPLATES: readonly PageTemplate[] = [
  {
    id: 'product-default',
    name: 'Standard product page',
    description:
      'Buy box, description, fitment, reviews, questions, and a related rail — the built-in product layout.',
    binding: 'product',
    sections: DEFAULT_TEMPLATES['commerce:product'],
  },
  {
    id: 'collection-default',
    name: 'Standard collection page',
    description: 'A collection header above the product grid — the built-in collection layout.',
    binding: 'collection',
    sections: DEFAULT_TEMPLATES['commerce:collection'],
  },
  {
    id: 'blank',
    name: 'Blank layout',
    description: 'Start empty and compose the layout section by section.',
    binding: null,
    sections: [],
  },
] as const;

/** Resolve a Page Template by id (undefined if unknown). */
export function getPageTemplate(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}

/** The Page Templates a target can begin from: a null-binding template fits every
 *  target; a bound template fits only a target of the same binding. */
export function pageTemplatesForTarget(targetId: string): PageTemplate[] {
  const binding = getLayoutTarget(targetId)?.binding ?? null;
  return PAGE_TEMPLATES.filter((t) => t.binding === null || t.binding === binding);
}
