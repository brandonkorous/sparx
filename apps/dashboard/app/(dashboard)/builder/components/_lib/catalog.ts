import 'server-only';

// The Component catalog — the read model behind /builder/components.
//
// The catalog IS the builder's component registry (docs/51 §4.2: components are
// the Tier-1 primitives + Tier-2 data-aware nodes a template composes from). The
// registry already declares everything we need — kind, group, module, binding
// cardinalities, props, surfaces — so this module is a thin, server-only reader
// over `PALETTE` that adds the labels + filtering the list/detail surfaces use.
// Tenant-authored custom components (docs/38/47, Phase 5+) will append to this
// same catalog once the backend exists; the list surface is built to absorb them.

import {
  PALETTE,
  getDef,
  type ComponentDef,
  type EditorSurface,
  type ModuleKey,
  type NodeKind,
  type PaletteGroup,
} from '../../_builder/registry';
import type { Cardinality } from '../../_builder/model';

export type { ComponentDef } from '../../_builder/registry';

export const GROUP_LABELS: Record<PaletteGroup, string> = {
  layout: 'Layout',
  content: 'Content & media',
  data: 'Data-aware',
};

export const KIND_LABELS: Record<NodeKind, string> = {
  container: 'Container',
  leaf: 'Leaf',
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  cms: 'CMS',
  commerce: 'Commerce',
  crm: 'CRM',
  events: 'Events',
  site: 'Site',
};

export const CARDINALITY_LABELS: Record<Cardinality, string> = {
  scalar: 'Single value',
  object: 'Record',
  array: 'List',
  empty: 'Unbound',
};

// One-line, user-facing summaries for the catalog. The registry stores
// behaviour, not catalog copy, so the descriptions live here (the UI layer).
// Keyed by component `type`; a missing entry falls back to a derived sentence.
export const COMPONENT_DESCRIPTIONS: Record<string, string> = {
  // Layout
  Section: 'A full-width band that groups content into a page section.',
  Grid: 'Arranges its children into responsive columns.',
  Stack: 'Stacks children vertically or horizontally with consistent spacing.',
  Card: 'A bordered surface that groups related content.',
  Carousel: 'A rotating slideshow — each child is one slide, with autoplay, arrows and dots.',
  // Content & media
  Heading: 'A page or section heading (H1–H3).',
  Text: 'A run of body, eyebrow, or meta text.',
  Prose: 'Rich body content from a CMS rich-text field — paragraphs, lists, quotes, links.',
  Image: 'A static image with a chosen aspect ratio and alt text.',
  Button: 'A call-to-action link styled from the brand button recipe.',
  Badge: 'A compact status or count pill.',
  Icon: 'A single glyph chosen from the icon library.',
  Divider: 'A horizontal rule that separates content.',
  Video: 'An embedded YouTube video.',
  Map: 'An embedded Google map for a place or search.',
  Stat: 'A large number with a label — a single headline metric.',
  EditorialSection: 'A long-form marketing block — eyebrow, headline, body, and optional CTA.',
  FAQ: 'A list of question-and-answer pairs.',
  FeatureGrid: 'A responsive grid of numbered feature cards.',
  // Data-aware
  ImageDisplay: 'Renders an image — or a gallery — bound to a record’s media field.',
  PriceTag: 'Displays a product’s price.',
  Signup: 'An email-capture form wired to your CRM.',
  ProductForm: 'Wraps the buy-box atoms in a shared variant + quantity context.',
  BuyBox: 'The complete purchase block — price, variants, quantity, and add-to-cart.',
  VariantPicker: 'Lets a shopper choose a product variant.',
  Quantity: 'A quantity stepper for the cart.',
  AddToCart: 'An add-to-cart button bound to the selected variant.',
  // Site chrome
  Outlet: 'Marks where the routed page renders inside the site layout.',
  NavMenu: 'A navigation menu bound to a site menu (or hand-typed links).',
  Logo: 'The tenant’s brand mark, bound to the site identity.',
  SocialLinks: 'A row of social-profile links from the site identity.',
};

export interface CatalogFilters {
  q?: string;
  group?: string;
  kind?: string;
  surface?: string;
}

const GROUP_ORDER: Record<PaletteGroup, number> = { layout: 0, content: 1, data: 2 };

/** Every component in the catalog (registry order). */
export function listComponents(): ComponentDef[] {
  return [...PALETTE];
}

/** Resolve one component by its `type` (the catalog's stable id). */
export function getComponentDef(type: string): ComponentDef | undefined {
  return getDef(type);
}

/** The editor surfaces a component appears in (a def with no `surfaces` is in
 *  both — docs/45 §2.5). */
export function surfacesOf(def: ComponentDef): EditorSurface[] {
  return def.surfaces ?? ['page', 'site'];
}

/** A one-line surface label for the list/detail. */
export function surfaceLabel(def: ComponentDef): string {
  const s = surfacesOf(def);
  if (s.includes('page') && s.includes('site')) return 'Page & layout';
  return s.includes('site') ? 'Site layout' : 'Page';
}

/** The binding cardinalities a component meaningfully accepts, minus the
 *  always-available unbound case — used for the list's "Binding" column. */
export function boundCardinalities(def: ComponentDef): Cardinality[] {
  return def.accepts.filter((c) => c !== 'empty');
}

/** A user-facing summary: the curated copy, else a sentence derived from the
 *  component's own shape so a new registry entry still reads sensibly. */
export function summaryOf(def: ComponentDef): string {
  const curated = COMPONENT_DESCRIPTIONS[def.type];
  if (curated) return curated;
  const lead = def.bindable ? 'data-aware ' : '';
  return `A ${lead}${KIND_LABELS[def.kind].toLowerCase()} in the ${GROUP_LABELS[def.group]} group.`;
}

/** Filter + stable-sort the catalog for the list surface. URL-driven: every
 *  argument maps to a `ListToolbar` control, so the page stays a server
 *  component that re-reads `searchParams` (docs/34 §7.1). */
export function filterComponents(filters: CatalogFilters): ComponentDef[] {
  const q = filters.q?.trim().toLowerCase();
  return [...PALETTE]
    .filter((d) => {
      if (filters.group && d.group !== filters.group) return false;
      if (filters.kind && d.kind !== filters.kind) return false;
      if (filters.surface && !surfacesOf(d).includes(filters.surface as EditorSurface))
        return false;
      if (q && !`${d.label} ${d.type}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.label.localeCompare(b.label));
}
