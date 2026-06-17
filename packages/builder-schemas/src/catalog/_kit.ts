// The platform component catalog — authoring kit + contract (docs/98 §5).
//
// The catalog is the data-driven replacement for hardcoded "guided" component
// types: every common/comprehensive component is a COMPOSED node tree (raw
// elements + named atoms + our Tailwind tokens), not a bespoke renderer branch.
// daisyUI is a breadth/naming REFERENCE only — entries are skinned via our token
// system and named in our own language (no competitor names in shipped artifacts).
//
// A catalog entry is platform DATA: the published set is the same for every
// tenant (like the in-code system registry), so the Add palette can consume it
// directly and STAMP a forked copy (fresh ids) into the page — exactly like a
// tenant archetype. A future DB-backed `PlatformComponent` table + admin/
// consultant lifecycle API layers on top additively (it changes WHERE non-seed
// entries come from, never how a tenant uses them).
//
// Zod-only, no DB / no React — safe to import from the editor's client palette
// AND the server. Trees are validated against BuilderNodeSchema by the assembling
// index, so a malformed entry fails at module load, not at stamp time.

import type { BuilderNode, BindingAction, CollectionSource } from '../node';
import type { ComponentSurface } from '../component';

// ── Taxonomy ──────────────────────────────────────────────────────────────────

/** Palette groupings — our names for the well-known component families. The Add
 *  palette renders one section per category, in this order. */
export const CATALOG_CATEGORIES = [
  'layout',
  'navigation',
  'actions',
  'data-display',
  'data-input',
  'content',
  'commerce',
  'feedback',
  'marketing',
  'mockup',
] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  layout: 'Layout',
  navigation: 'Navigation',
  actions: 'Actions',
  'data-display': 'Data display',
  'data-input': 'Data input',
  content: 'Content',
  commerce: 'Commerce',
  feedback: 'Feedback',
  marketing: 'Marketing',
  mockup: 'Mockup',
};

/** `common` = a single daisyUI-grade building block. `comprehensive` = a larger
 *  behavior-bearing composite (carousel hero, mega-menu, pricing table). */
export const CATALOG_KINDS = ['common', 'comprehensive'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

// ── Entry shape ─────────────────────────────────────────────────────────────

/** One catalog component. `tree` is the BuilderNode subtree the palette forks
 *  (fresh ids) into the page on stamp — the same serialized shape a tenant
 *  archetype carries. */
export interface PlatformCatalogEntry {
  /** Stable, globally-unique catalog key (^[a-z][a-z0-9_]*$). */
  key: string;
  name: string;
  category: CatalogCategory;
  kind: CatalogKind;
  /** Lucide icon name shown on the palette tile. */
  icon: string;
  description: string;
  /** Editor surfaces this entry appears in (page / site / email). */
  surfaces: ComponentSurface[];
  /** Free-text search tags (matched by the palette's filter). */
  tags?: string[];
  tree: BuilderNode;
}

/** A catalog entry without its tree — the list/summary row. */
export type PlatformCatalogSummary = Omit<PlatformCatalogEntry, 'tree'>;

export function catalogSummary(e: PlatformCatalogEntry): PlatformCatalogSummary {
  const { tree: _tree, ...summary } = e;
  return summary;
}

// ── Authoring helpers ─────────────────────────────────────────────────────────
//
// Catalog trees are written with these instead of the box/layout `seedNode`
// vocabulary, because a daisyUI-grade component is most readable as explicit
// utility classes (the exact strings a power user or AI agent would type, which
// compile through @sparx/surface-compile to the tenant `--st-*` tokens). Ids only
// need to be unique within a single entry's tree — stamping re-ids the whole
// fork — but a monotonic counter keeps them unique across the catalog too, which
// keeps module-load deterministic (cf. STARTER_PAGES).

let _seq = 0;
/** A stable, unique node id for a catalog seed node. */
export function cid(tag: string): string {
  _seq += 1;
  return `cat_${tag.replace(/[^a-z0-9]/gi, '')}_${_seq}`;
}

/** Attribute/value map for a raw element — written straight onto `props` (the
 *  renderer's `safeElementAttrs` reads whitelisted keys from there). */
export type ElAttrs = Record<string, string | number | boolean>;

export interface ElOpts {
  /** Inline text for a text element (`a`, `span`, `p`, `h1`–`h6`, `li`, `label`…). */
  text?: string;
  /** Whitelisted HTML attributes (href, src, alt, type, aria-*, role, target…). */
  attrs?: ElAttrs;
  /** Author label shown in the Layers tree — for structural nodes whose role
   *  isn't obvious from the tag (e.g. a navbar's `navbar-start`/`-center`/`-end`
   *  zones, which would otherwise read as bare "Div"). */
  name?: string;
  children?: BuilderNode[];
}

/** A raw HTML element node (Pillar 1) carrying explicit utility classes. The
 *  workhorse of catalog authoring — structural containers and styled text. */
export function el(tag: string, cls: string, opts: ElOpts = {}): BuilderNode {
  const props: Record<string, unknown> = { ...(opts.attrs ?? {}) };
  if (opts.text !== undefined) props.text = opts.text;
  const node: BuilderNode = { id: cid(tag), type: `el:${tag}`, props };
  if (cls) node.class = cls;
  if (opts.name) node.name = opts.name;
  if (opts.children && opts.children.length > 0) node.children = opts.children;
  return node;
}

/** A named registry atom (Heading, Text, Button, Badge, Image, Icon, Divider,
 *  PriceTag, …) — these "wear their own class" (CLASS_ON_LEAF), so `cls` lands on
 *  the rendered element and `props` carries its content (text/level/label/…). */
export function atom(
  type: string,
  cls: string,
  props: Record<string, unknown> = {},
  children?: BuilderNode[]
): BuilderNode {
  const node: BuilderNode = { id: cid(type.toLowerCase()), type, props };
  if (cls) node.class = cls;
  if (children && children.length > 0) node.children = children;
  return node;
}

/** Attach a data binding path to a node (e.g. a Wordmark bound to `site.identity`,
 *  a Heading bound to `product.title`) and return it, for inline composition. */
export function bound(node: BuilderNode, path: string): BuilderNode {
  node.binding = { path };
  return node;
}

// ── Binding the spine (docs/98 Pillar 7 — commerce + content composites) ────────
//
// `bound()` writes the FIELD binding (a path). The v2 spine adds two more a catalog
// composite expresses directly: a COLLECTION repeater and an ACTION trigger. An
// entity PIN is deliberately NOT authored here — a template carries no concrete
// record id; the tenant pins one after dropping, and the composite's `item.*`
// bindings + static placeholder text resolve the moment a record enters scope (a
// pin, or a repeated item). See CONTRACT.md "Binding the spine".

/** Mark a container a COLLECTION REPEATER (docs/98 Pillar 7) — its children render
 *  once per product in the source (`{ from: 'all' }`, or a specific collection /
 *  category by id), each item scoping its subtree to that product so an inner
 *  PriceTag / add-to-cart resolves the right one. */
export function repeat(node: BuilderNode, source: CollectionSource): BuilderNode {
  node.binding = { source };
  return node;
}

/** Attach an interactive ACTION to a trigger element (docs/98 Pillar 7):
 *  `add-to-cart` / `buy-now` fire against the product an ancestor scope establishes;
 *  `link` navigates to `href`; `submit` posts the enclosing form. */
export function act(node: BuilderNode, action: BindingAction, href?: string): BuilderNode {
  node.binding = { action, ...(href ? { href } : {}) };
  return node;
}

// ── Behavior authoring (docs/98 Pillar 5) ──────────────────────────────────────
//
// A comprehensive composite wires interactivity through TWO sanctioned props the
// render walkers lower to the controlled `data-sx-*` vocabulary (NOT raw `data-*`,
// which the element whitelist would strip): `props.behavior` = the behavior ROOT
// (`{ type, ...params }`), `props.sxRole` = an inner STRUCTURAL marker. The runtime
// (`@sparx/builder-render` behaviors) is the source of truth for the closed sets;
// the unions below MIRROR it and are pinned together by a cross-package drift test
// (behaviors.test.ts asserts BEHAVIOR_NAMES/SX_ROLES match these). builder-schemas
// is the lower package, so it cannot import the runtime — hence the mirror.

/** The closed behavior vocabulary a composite may declare. Mirrors the runtime's
 *  `BEHAVIOR_NAMES`. */
export const SX_BEHAVIOR_NAMES = [
  'carousel',
  'disclosure',
  'tabs',
  'scrollspy',
  'marquee',
  'menu',
  'counter',
] as const;
export type SxBehaviorName = (typeof SX_BEHAVIOR_NAMES)[number];

/** The closed structural-role vocabulary a composite's inner nodes may declare.
 *  Mirrors the runtime's `SX_ROLES`. */
export const SX_ROLE_NAMES = [
  'track',
  'slide',
  'prev',
  'next',
  'dot',
  'dots',
  'trigger',
  'panel',
  'item',
  'tab',
  'spy',
] as const;
export type SxRoleName = (typeof SX_ROLE_NAMES)[number];

/** A behavior root spec: the behavior name plus its tunable params (autoplay,
 *  interval, single, …), each a primitive the walker lowers to `data-sx-<kebab>`. */
export type SxBehaviorSpec = {
  type: SxBehaviorName;
} & Record<string, string | number | boolean>;

/** Mark a node as a behavior ROOT (`data-sx-carousel`, …) and return it. The runtime
 *  hydrates this element and wires the `part(...)`-marked descendants it finds. */
export function behave(node: BuilderNode, spec: SxBehaviorSpec): BuilderNode {
  node.props.behavior = spec;
  return node;
}

/** Mark a node as a structural PART of its enclosing behavior (`data-sx-track`,
 *  `data-sx-slide`, `data-sx-trigger`, …) and return it. */
export function part(node: BuilderNode, role: SxRoleName): BuilderNode {
  node.props.sxRole = role;
  return node;
}

/** Identity passthrough that pins the entry shape at the author site (so a typo in
 *  `category`/`kind` is a type error in the category file, not at assembly). */
export function entry(e: PlatformCatalogEntry): PlatformCatalogEntry {
  return e;
}
