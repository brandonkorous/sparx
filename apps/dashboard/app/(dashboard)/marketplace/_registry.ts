// The Marketplace category registry (docs/60 §4). One declarative entry per
// category drives the home tiles, route resolution, and each browse page's header
// + facet rail. Adding a category (Apps, Workflows, …) is one entry here plus a
// data adapter — no page-component rewrite (docs/60 M3).
//
// `accent` is the category's stripe/icon color, applied as an inline style on the
// home tile (it's catalog data, not a control re-skin — so it isn't a component
// variant).
//
// It draws from the PRODUCT palette (primary / secondary / accent / neutral), never
// from a module hue. /marketplace is module-LESS: module color exists to say "this
// belongs to CMS," and a marketplace category says nothing of the kind — Themes is
// not the Chat module, Integrations is not Commerce. These were previously the raw
// hexes #6366f1 / #8b5cf6 / #f97316 / #14b8a6 — verbatim `--color-module-builder`,
// `-chat`, `-commerce` and `-cms` — which both spent module identity on taxonomy and,
// being literal hexes, couldn't adapt to dark mode. Distinguishing four categories is
// a job for the product's own design language; that's what these three brand colors
// are for.
//
// The ONE place a module hue belongs in this directory is the blueprints `modules`
// facet below ("Requires module") — a blueprint that requires Commerce genuinely is
// about Commerce, so that badge earns orange.

import { Boxes, Component, Palette, Plug, type LucideIcon } from 'lucide-react';

export type CategoryStatus = 'live' | 'coming-soon';
export type FacetType = 'multi' | 'single';

export interface FacetSpec {
  /** Query key (e.g. `vertical`) — matches the API's facet bucket + query param. */
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
  /** Singular noun for prose ("install a blueprint", "1 blueprint"). */
  singular: string;
  icon: LucideIcon;
  /** A product-palette token reference, e.g. `var(--color-primary)`. Never a module
   *  hue and never a literal hex — see the file header. */
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
    accent: 'var(--color-primary)',
    tagline: 'Whole themed sites — pages, products, content, and emails.',
    status: 'live',
    facets: [
      { key: 'vertical', label: 'Vertical', type: 'multi' },
      { key: 'modules', label: 'Requires module', type: 'multi' },
      { key: 'status', label: 'Status', type: 'single' },
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
    accent: 'var(--color-secondary)',
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
    accent: 'var(--color-accent)',
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
    accent: 'var(--color-neutral)',
    tagline: 'Reusable building blocks for the Builder canvas.',
    status: 'live',
    facets: [
      { key: 'group', label: 'Group', type: 'multi' },
      { key: 'surface', label: 'Surface', type: 'multi' },
    ],
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
