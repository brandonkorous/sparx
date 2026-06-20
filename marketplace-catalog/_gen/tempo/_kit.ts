// Tempo generator — shared authoring KIT. Every module composes trees through the
// helpers exported here, so node ids are minted from ONE shared counter. That counter
// advances in CALL order, and the ids are persisted into the payload + used as
// React/dnd-kit keys (CLAUDE.md), so call order is load-bearing: `manifest.ts` invokes
// the tree builders in a fixed order to keep ids stable across regens.
//
// Tempo is a HYBRID author (see blueprints/tempo/README.md):
//   · `node()`        — the semantic box/layout vocabulary (seedNode) for SECTION
//                       bands: full-bleed, contained, responsive, re-themable.
//   · `el()`/`atom()` — raw HTML elements + named registry atoms for the dense
//                       INTERIOR UI (carousel hero, skewed campaign type, the CSS
//                       motion-mark + product silhouette, arrow-links, benefit grid,
//                       mega footer) — the same helpers the platform component catalog
//                       is authored with.
// Both pull ids from the single `nid` counter below.

import { seedNode, type BuilderNode } from '../../../packages/builder-schemas/src/index';

export type { BuilderNode };

let nid = 0;
/** The next globally-stable `tmp-<n>` id (increments per call). */
const nextId = (): string => `tmp-${(nid += 1)}`;

// ── Semantic vocabulary (section bands) ───────────────────────────────────────

/** Mint a node from the box/layout authoring vocabulary (compiles to a class
 *  string; full-bleed bands with contained content split into outer+inner). */
export const node = (type: string, opts: Parameters<typeof seedNode>[2] = {}): BuilderNode =>
  seedNode(nextId(), type, opts);

// ── Raw-element vocabulary (interior UI) ──────────────────────────────────────

export type ElAttrs = Record<string, string | number | boolean>;
export interface ElOpts {
  /** Inline text for a text element (a/span/p/h1–h6/li/label/td/…). */
  text?: string;
  /** Whitelisted HTML attributes (href, src, alt, type, aria-*, role, viewBox…). */
  attrs?: ElAttrs;
  /** Author label shown in the Layers tree (for structural divs whose role is not
   *  obvious from the tag). */
  name?: string;
  children?: BuilderNode[];
}

/** A raw HTML element node (`el:<tag>`, docs/98 Pillar 1) carrying explicit utility
 *  classes — the workhorse of the interior compositions. */
export const el = (tag: string, cls: string, opts: ElOpts = {}): BuilderNode => {
  const props: Record<string, unknown> = { ...(opts.attrs ?? {}) };
  if (opts.text !== undefined) props.text = opts.text;
  const n: BuilderNode = { id: nextId(), type: `el:${tag}`, props };
  if (cls) n.class = cls;
  if (opts.name) n.name = opts.name;
  if (opts.children && opts.children.length > 0) n.children = opts.children;
  return n;
};

/** A named registry atom (Heading, Text, Button, Badge, Image, Icon, Divider,
 *  PriceTag, Wordmark, NavMenu, SocialLinks, Signup, …) — these wear `cls` on the
 *  rendered element and carry their content in `props`. */
export const atom = (
  type: string,
  cls: string,
  props: Record<string, unknown> = {},
  children?: BuilderNode[]
): BuilderNode => {
  const n: BuilderNode = { id: nextId(), type, props };
  if (cls) n.class = cls;
  if (children && children.length > 0) n.children = children;
  return n;
};

// ── Binding + behavior helpers (docs/98 Pillar 7 + Pillar 5) ───────────────────

/** Attach a FIELD binding (a dotted path, e.g. `site.identity`, `item.title`). */
export const bound = (n: BuilderNode, path: string): BuilderNode => {
  n.binding = { ...(n.binding ?? {}), path };
  return n;
};

/** Attach an interactive ACTION to a trigger element (`link` → href, `submit`, …). */
export const act = (
  n: BuilderNode,
  action: 'add-to-cart' | 'buy-now' | 'link' | 'submit',
  href?: string
): BuilderNode => {
  n.binding = { ...(n.binding ?? {}), action, ...(href ? { href } : {}) };
  return n;
};

/** Mark a node a behavior ROOT (`data-sx-<type>`, docs/98 Pillar 5) — e.g. the hero
 *  carousel or the team marquee. The storefront runtime hydrates it and wires the
 *  `part()` parts. */
export const behave = (
  n: BuilderNode,
  spec: { type: string } & Record<string, string | number | boolean>
): BuilderNode => {
  n.props.behavior = spec;
  return n;
};

/** Mark a node a structural PART of its enclosing behavior (`track`, `slide`,
 *  `prev`, `next`, `dot`, …). */
export const part = (n: BuilderNode, role: string): BuilderNode => {
  n.props.sxRole = role;
  return n;
};

// ── CMS rich-text ──────────────────────────────────────────────────────────────

/** A ProseMirror rich-text doc from paragraphs (CMS post bodies). */
export const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});
