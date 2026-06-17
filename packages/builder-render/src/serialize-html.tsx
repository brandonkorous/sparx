// View HTML — serialize a node/subtree to the CLEAN PUBLISH HTML (docs/98 §3.8 +
// §4.2). The read-only half of the View-HTML / import pair (import lives in
// @sparx/builder-schemas `html-import.ts`).
//
// CONTRACT (load-bearing, from §4.2):
//   · The source is the CLEAN PUBLISH RENDER, *not* `canvas.innerHTML`. The canvas
//     DOM carries editor chrome that never ships — the `data-node-id` / `.bx-node`
//     `display:contents` wrappers, `.bx-canvas`-scoped utilities, and selection
//     rings. This walker emits exactly what the storefront serves: one styled
//     element per node, raw containers AS their tag, leaves through the SHARED
//     `renderLeaf(mode:'live')`. So "View HTML" shows production markup.
//   · WEB output references compiled `tenant.css` classes (not inlined) — the
//     panel notes that pasting elsewhere needs that stylesheet. (Email's View HTML
//     is the inline-styled table HTML from the email send path, produced by a
//     server action, not this module.)
//
// This deliberately MIRRORS apps/site `builder-renderer.tsx` RenderNode's wrapper
// rules (the shared `leafWearsClass` + raw-container-as-tag predicates), minus the
// data/binding/outlet/carousel-island specifics: View HTML serializes the AUTHORED
// structure (no tenant record data is resolved here), which is what a "view/copy
// source" affordance wants. It is server-safe (react-dom/server, no DOM, no
// next/headers) so it runs in a server action or the client alike.

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  isRawContainerType,
  isRawElementType,
  rawTagOf,
  safeElementAttrs,
  type BuilderNode,
} from '@sparx/builder-schemas';

import { leafWearsClass, renderLeaf } from './render-leaf';

// The 34 curated container types (mirrors the site renderer's CONTAINERS set).
// `Outlet` is intentionally excluded — a layout's content slot has no authored
// HTML of its own; we render it as an empty marker comment instead.
const CONTAINERS = new Set(['Section', 'Grid', 'Stack', 'Card', 'Carousel', 'ProductForm']);

/** Join class fragments, dropping falsy ones; undefined when empty. */
function cls(...parts: (string | false | null | undefined)[]): string | undefined {
  const joined = parts.filter(Boolean).join(' ');
  return joined || undefined;
}

/** One node → React element, chrome-free. Mirrors the published RenderNode wrapper
 *  rules: a class-styled leaf / raw element wears node.class on its OWN element; a
 *  raw container renders AS its tag; everything else is one wrapper `<div>`. No
 *  selection chrome, no `data-node-id`, no `.bx-node` layers. */
function SerializeNode({ node }: { node: BuilderNode }): React.ReactNode {
  const rawTag = rawTagOf(node.type);
  const isContainer = CONTAINERS.has(node.type) || isRawContainerType(node.type);
  const leafStylesByClass =
    !isContainer && (leafWearsClass(node.type) || isRawElementType(node.type));

  // The Outlet is a layout's IOC slot — it carries no authored HTML of its own (the
  // routed page renders THERE on the live site). View HTML serializes the authored
  // layout chrome, so the Outlet emits nothing.
  if (node.type === 'Outlet') return null;

  const kids = (node.children ?? []).map((child) => <SerializeNode key={child.id} node={child} />);

  if (isContainer) {
    const body = kids.length > 0 ? kids : null;
    if (rawTag) {
      return React.createElement(
        rawTag,
        { className: cls(node.class), ...safeElementAttrs(node) },
        body
      );
    }
    // A curated container (Section/Grid/Stack/Card/…) ships as a div wrapper.
    return <div className={cls(node.class)}>{body}</div>;
  }

  // A leaf — possibly nesting inline children (Button → Icon). The shared renderLeaf
  // (mode:'live') produces the SAME element the storefront serves. Unbound here:
  // View HTML serializes authored structure, not resolved tenant records.
  const body = renderLeaf({
    node,
    value: undefined,
    cardinality: 'empty',
    bound: false,
    mode: 'live',
    surface: 'page',
    leafClass: leafStylesByClass ? node.class : undefined,
    children: kids.length > 0 ? kids : undefined,
  });

  if (leafStylesByClass) return <>{body}</>;
  if (rawTag) {
    return React.createElement(rawTag, { className: cls(node.class), ...safeElementAttrs(node) }, body);
  }
  return <div className={cls(node.class)}>{body}</div>;
}

// ── Pretty-print ──────────────────────────────────────────────────────────────
//
// renderToStaticMarkup emits a single line. For a "view source" panel we want
// readable, indented HTML. A tiny, dependency-free reindenter: split on tag
// boundaries and indent by depth. It only reformats whitespace BETWEEN tags, never
// inside text content or attributes, so the markup stays faithful.

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function prettyHtml(html: string): string {
  // Insert a newline between adjacent tags, then indent by running depth.
  const withBreaks = html.replace(/>\s*</g, '>\n<');
  const lines = withBreaks.split('\n');
  let depth = 0;
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const isClose = /^<\//.test(line);
    const openMatch = /^<([a-zA-Z][\w-]*)/.exec(line);
    const tag = openMatch?.[1]?.toLowerCase();
    const isSelfContained =
      /\/>$/.test(line) ||
      (tag !== undefined && VOID_TAGS.has(tag)) ||
      // An open+close on the same line (e.g. `<span>text</span>`).
      (/^<[^/]/.test(line) && /<\/[a-zA-Z][\w-]*>$/.test(line));
    if (isClose) depth = Math.max(0, depth - 1);
    out.push('  '.repeat(depth) + line);
    const isOpen = /^<[^/!]/.test(line) && !isSelfContained;
    if (isOpen) depth += 1;
  }
  return out.join('\n');
}

export interface SerializeOptions {
  /** Pretty-print (indent) the output. Default true — the View-HTML panel wants
   *  readable source. Pass false for a single-line string. */
  pretty?: boolean;
}

/** Serialize one node (and its subtree) to clean publish HTML. Used for the
 *  per-node "View HTML" affordance (the selected subtree). */
export function serializeNodeToHtml(node: BuilderNode, options?: SerializeOptions): string {
  const html = renderToStaticMarkup(<SerializeNode node={node} />);
  return options?.pretty === false ? html : prettyHtml(html);
}

/** Serialize a whole document tree's CHILDREN to clean publish HTML — the root
 *  page/layout wrapper itself is an editor container, so the meaningful output is
 *  its children (matching what the storefront drops into the page region). When
 *  the root has no children, the root node is serialized as-is. */
export function serializeTreeToHtml(tree: BuilderNode, options?: SerializeOptions): string {
  const children = tree.children ?? [];
  const node: React.ReactNode =
    children.length > 0 ? (
      <>
        {children.map((child) => (
          <SerializeNode key={child.id} node={child} />
        ))}
      </>
    ) : (
      <SerializeNode node={tree} />
    );
  const html = renderToStaticMarkup(<>{node}</>);
  return options?.pretty === false ? html : prettyHtml(html);
}
