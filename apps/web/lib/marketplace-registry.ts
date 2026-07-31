// The public marketplace category registry (docs/60 §5). One declarative entry
// per category drives the home tiles, route resolution, and each browse page's
// header + facet rail. Adding a category is one entry here plus its server data
// (seeded rows) — no page-component rewrite (docs/60 M3).
//
// This mirrors the dashboard's registry (apps/dashboard/.../marketplace/_registry.ts)
// so both surfaces resolve categories identically; kept local to apps/web so the
// marketing site takes no shared-package dependency. `accent` is catalog data
// (the category's stripe/icon color), applied as an inline style — not a control
// re-skin (docs/23 §15).

import { Boxes, Component, Palette, Plug, type LucideIcon } from 'lucide-react';

export type CategoryStatus = 'live' | 'coming-soon';
export type FacetType = 'multi' | 'single';

export interface FacetSpec {
  /** Query key — matches the API's facet bucket + the browse query param. */
  key: string;
  label: string;
  type: FacetType;
}

export interface SortSpec {
  key: string;
  label: string;
}

export interface MarketplaceCategory {
  id: string;
  label: string;
  /** Singular noun for prose ("1 blueprint", "start with this blueprint"). */
  singular: string;
  icon: LucideIcon;
  accent: string;
  tagline: string;
  status: CategoryStatus;
  /** Filter dimensions for this category's browse page. Empty until live. */
  facets: FacetSpec[];
  sorts: SortSpec[];
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  {
    id: 'blueprints',
    label: 'Blueprints',
    singular: 'blueprint',
    icon: Boxes,
    accent: '#6366f1',
    tagline: 'Whole themed sites — pages, products, content, and emails.',
    status: 'live',
    facets: [
      { key: 'vertical', label: 'Vertical', type: 'multi' },
      { key: 'modules', label: 'Requires module', type: 'multi' },
    ],
    sorts: [
      { key: 'popular', label: 'Most popular' },
      { key: 'newest', label: 'Newest' },
      { key: 'name', label: 'Name (A–Z)' },
    ],
  },
  {
    id: 'themes',
    label: 'Themes',
    singular: 'theme',
    icon: Palette,
    accent: '#8b5cf6',
    tagline: 'Brand looks — color, type, and shape — applied site-wide.',
    status: 'live',
    facets: [
      { key: 'industry', label: 'Industry', type: 'multi' },
      { key: 'mood', label: 'Style', type: 'multi' },
      { key: 'colorFamily', label: 'Color', type: 'multi' },
    ],
    sorts: [
      { key: 'popular', label: 'Most popular' },
      { key: 'newest', label: 'Newest' },
      { key: 'name', label: 'Name (A–Z)' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    singular: 'integration',
    icon: Plug,
    accent: '#f97316',
    tagline: 'Payments, shipping, tax, and the rest of your stack.',
    status: 'live',
    facets: [{ key: 'kind', label: 'Type', type: 'multi' }],
    sorts: [
      { key: 'popular', label: 'Most popular' },
      { key: 'newest', label: 'Newest' },
      { key: 'name', label: 'Name (A–Z)' },
    ],
  },
  {
    id: 'components',
    label: 'Components',
    singular: 'component',
    icon: Component,
    accent: '#14b8a6',
    tagline: 'Ready-made sections — drop one straight into any page.',
    status: 'live',
    // Only the "Purpose" dimension filters usefully — every section targets a page,
    // so a Surface facet would be a single dead option.
    facets: [{ key: 'group', label: 'Purpose', type: 'multi' }],
    sorts: [
      { key: 'popular', label: 'Most popular' },
      { key: 'newest', label: 'Newest' },
      { key: 'name', label: 'Name (A–Z)' },
    ],
  },
];

export function getCategory(id: string): MarketplaceCategory | undefined {
  return MARKETPLACE_CATEGORIES.find((c) => c.id === id);
}

export const LIVE_CATEGORIES = MARKETPLACE_CATEGORIES.filter((c) => c.status === 'live');
