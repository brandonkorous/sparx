// The one traversal every rule reads from — the COMPOSED document, with provenance.
//
// WHY COMPOSE. A visitor never receives a page body. They receive the frame with the
// page spliced into its outlet, and every saved-component instance expanded into the
// master's tree. Linting the raw page body would therefore miss exactly the problems
// that hurt most: a broken link in the footer (authored once, wrong on every page),
// or an image with no description inside a saved component (authored once, wrong
// everywhere it is placed). Both are invisible to a per-page walk of `page.root`.
//
// WHY PROVENANCE. Composing without tracking WHERE a node came from creates the
// opposite problem: the footer's broken link is reported once per page, so a site
// with twelve pages shows twelve identical findings for one thing to fix. Each
// visited node therefore carries the tree it was AUTHORED in — page, frame, or
// symbol — and `lintSite` merges findings that share an origin, listing the pages
// they were seen on instead of repeating itself.
//
// WHAT IS NOT RESOLVED. Data bindings. A bound node's real text, image source and
// href come from a record at render time, and this engine is pure — it has no
// database, and inventing one would make it un-runnable from the editor. So a bound
// node is treated as "will be filled" and skipped by the checks that would otherwise
// call it empty. That is honest rather than wrong: the alternative is flagging every
// product card on every collection template.

import { applyOverrides, type Node as SilicaNode, type SymbolDef } from '@wizeworks/silicaui-html';
import { carrierBoundAttrs } from '@sparx/silica-catalog';

import { paintOf, ROOT_PAINT, type PaintContext } from './paint';
import type { LintablePage, LintScope } from './types';

/**
 * A node that carries content.
 *
 * `OutletNode` is the odd one out in silica's union: it is a bare `{ kind: 'outlet' }`
 * marker that does not extend `NodeBase`, so it has no class, no id, no children and
 * no binding. The traversal follows an outlet into the page body and never records
 * it, so nothing downstream ever sees one — saying so in the type removes the
 * `'class' does not exist on OutletNode` narrowing from every single rule.
 */
export type ContentNode = Exclude<SilicaNode, { kind: 'outlet' }>;

/** A node's real child nodes: text children and the outlet marker dropped. */
export function childNodes(node: ContentNode): ContentNode[] {
  const out: ContentNode[] = [];
  for (const child of node.children ?? []) {
    if (typeof child !== 'string' && child.kind !== 'outlet') out.push(child);
  }
  return out;
}

/** The tree a node was authored in — everything a finding needs to say where the
 *  fix happens, minus the node itself. */
export interface NodeOrigin {
  scope: LintScope;
  ownerId: string | null;
  ownerName: string;
}

/** One node of the composed document, with everything the rules need about its
 *  context already computed. Ancestors are deliberately NOT exposed: a rule that
 *  walks upward from a visit is a rule that can be given the wrong parent when the
 *  traversal changes, so the two facts anyone actually needs are precomputed here. */
export interface VisitedNode {
  node: ContentNode;
  origin: NodeOrigin;
  /** Position in document order. Only the heading outline reads it. */
  order: number;
  /** A trail of tags to this node — `section › div › a`. For a node with no id. */
  nodePath: string;
  /** An ancestor is already a link or a button, so this node is not itself the
   *  control an owner would click — it is content inside one. */
  inControl: boolean;
  /** An ancestor is a form or a behavior root, so a bare `<button>` here has a job
   *  (submit, open the menu, advance the carousel) even with no href of its own. */
  inInteractive: boolean;
  /** How this node is painted, with background, text color, size and weight already
   *  inherited from its ancestors. Threaded here rather than recomputed by the
   *  contrast rule because inheritance needs the ancestor chain, and handing rules an
   *  ancestor chain is how a rule ends up reading the wrong parent. */
  paint: PaintContext;
}

/** Everything one page's composed document yields, gathered in a single pass. */
export interface DocumentInventory {
  page: LintablePage;
  nodes: VisitedNode[];
  /** Every `id` attribute in the composed document — what an in-page `#anchor` can
   *  actually reach. Collected across frame AND page because a header anchor link
   *  targeting a page section is the normal case. */
  anchorIds: Set<string>;
  /** Instances whose master is absent from `symbols`: they expand to nothing, so a
   *  section the author placed simply does not appear. */
  missingSymbols: { symbolId: string; origin: NodeOrigin; nodePath: string }[];
  /** False when a frame was supplied whose tree contains no outlet — the page body
   *  has nowhere to render. */
  hasOutlet: boolean;
}

/** What the author calls the shared chrome. One string, used by every finding that
 *  lands in the frame, so the wording cannot drift between rules. */
export const FRAME_OWNER_NAME = 'Header & footer';

const FRAME_ORIGIN: NodeOrigin = { scope: 'frame', ownerId: null, ownerName: FRAME_OWNER_NAME };

/* ── Node shape helpers ─────────────────────────────────────────────────────── */

export function isElement(node: ContentNode): node is Extract<SilicaNode, { kind: 'element' }> {
  return node.kind === 'element';
}

export function isComponent(node: ContentNode): node is Extract<SilicaNode, { kind: 'component' }> {
  return node.kind === 'component';
}

/** The node's TYPE for display: the tag for an element, the component name for a
 *  component, else the kind (`outlet`, `host`) which is its own type. */
export function typeOf(node: ContentNode): string {
  if (isElement(node)) return node.tag;
  // `?? ''` rather than trusting the type: a tree restored from an old release, or
  // hand-written by an MCP client, can carry a node with neither a tag nor a
  // component name. It renders as nothing, which is worth reporting — and a walk
  // that throws on it reports nothing at all, on exactly the site that needed it.
  return node.component ?? '';
}

/** An attribute as a trimmed string, or `''`. Element attrs are typed
 *  `string | number | boolean`, so a numeric `id` or a boolean is coerced here once
 *  rather than at every read. */
export function attr(node: ContentNode, name: string): string {
  if (!isElement(node)) return '';
  const value = node.attrs?.[name];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

/** Whether an attribute is PRESENT at all, regardless of value. The difference
 *  between an absent `alt` and `alt=""` is the whole of the decorative-image rule. */
export function hasAttr(node: ContentNode, name: string): boolean {
  return isElement(node) && node.attrs != null && name in node.attrs;
}

/** A component prop as a trimmed string, or `''`. */
export function prop(node: ContentNode, name: string): string {
  if (node.kind !== 'component' && node.kind !== 'host') return '';
  const value = node.props?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

/** Does this node's content come from a record at render time? Such a node is
 *  skipped by every emptiness check — its words, image and destination are filled
 *  in by data the engine cannot see. */
export function isBound(node: ContentNode): boolean {
  return node.data != null;
}

/**
 * Does something fill THIS attribute at render time? An `<a>` bound with
 * `attr: 'href'` has a destination even though its authored `href` is empty.
 *
 * Two mechanisms, and both have to be consulted. silica's own binding is on the node.
 * The sparx ATTRIBUTE CARRIER is not: `bindAttr` tucks a hidden bound `<input>` inside
 * the element and hoists its value onto the parent just before render, because the
 * engine cannot yet resolve children through an attribute binding. A product card is
 * the main user of it, and to anything reading only the node it looks like an anchor
 * with no href — which is exactly what the dead-control rule reports.
 */
export function bindsAttr(node: ContentNode, name: string): boolean {
  if (carrierBoundAttrs(node).includes(name)) return true;
  const data = node.data;
  if (!data) return false;
  if (data.kind === 'action') return name === 'href';
  if (data.kind === 'value') return (data.attr ?? '') === name;
  return false;
}

const CONTROL_TAGS = new Set(['a', 'button']);
const INTERACTIVE_TAGS = new Set(['form', 'label']);

/** Text a visitor can actually read inside this subtree.
 *
 *  Collects bare string children (silica's primary way of carrying copy) plus the
 *  copy component atoms hold in props. Stops at a node whose content is bound —
 *  such a node reports as non-empty, because at render it is. */
export function visibleText(node: ContentNode, depth = 0): string {
  if (depth > 12) return '';
  const parts: string[] = [];
  if (isBound(node)) parts.push('…');
  if (node.kind === 'component' || node.kind === 'host') {
    for (const key of ['label', 'text', 'title', 'heading', 'children']) {
      const value = prop(node, key);
      if (value) parts.push(value);
    }
  }
  for (const child of node.children ?? []) {
    if (typeof child === 'string') {
      if (child.trim()) parts.push(child.trim());
      continue;
    }
    if (child.kind === 'outlet') continue;
    const inner = visibleText(child, depth + 1);
    if (inner) parts.push(inner);
  }
  return parts.join(' ').trim();
}

/** silica atoms that render an image. `Avatar` is included because a missing avatar
 *  description is the same problem wearing a different component name — and its file
 *  is downloaded exactly the same way. */
export const IMAGE_COMPONENTS = new Set(['image', 'avatar']);

/** Does this node put a picture on the page? An `<img>` element or one of the atoms
 *  above. Shared by the description check and the weight measurement so the two can
 *  never disagree about what counts as an image. */
export function isImageNode(node: ContentNode): boolean {
  const type = typeOf(node).toLowerCase();
  if (isElement(node)) return type === 'img';
  return node.kind === 'component' && IMAGE_COMPONENTS.has(type);
}

/** The file an image node points at — the element's `src` attribute or the atom's
 *  `src` prop. `''` when no picture has been chosen, and also when the source is
 *  bound: a bound image's file is decided by a record this engine cannot see. */
export function imageSrc(node: ContentNode): string {
  return isElement(node) ? attr(node, 'src') : prop(node, 'src');
}

/** Does this subtree show something non-textual a visitor can perceive — an image
 *  with a description, an icon, an inline SVG? An icon-only button is labelled by
 *  its icon plus an accessible name, not by text, so this keeps the empty-control
 *  rule from firing on every icon button on the site. */
export function hasMedia(node: ContentNode, depth = 0): boolean {
  if (depth > 12) return false;
  const type = typeOf(node).toLowerCase();
  if (type === 'img' || type === 'svg' || type === 'icon' || type === 'image') return true;
  for (const child of childNodes(node)) {
    if (hasMedia(child, depth + 1)) return true;
  }
  return false;
}

/** The accessible name a control carries even with no visible text. */
export function accessibleName(node: ContentNode): string {
  return attr(node, 'aria-label') || attr(node, 'title') || prop(node, 'aria-label');
}

/* ── The traversal ──────────────────────────────────────────────────────────── */

interface WalkState {
  nodes: VisitedNode[];
  anchorIds: Set<string>;
  missingSymbols: DocumentInventory['missingSymbols'];
  hasOutlet: boolean;
  order: number;
  symbols: Record<string, SymbolDef>;
  /** Symbol ids currently being expanded — a saved component that (directly or
   *  transitively) instantiates itself would otherwise recurse until the stack
   *  gives out. silica's editor prevents authoring one; a hand-written tree or a
   *  restored old release can still carry one, and a lint that crashes on a broken
   *  site is a lint that runs exactly when it is least useful. */
  expanding: Set<string>;
  pageRoot: SilicaNode;
  pageOrigin: NodeOrigin;
}

/**
 * Walk one page's composed document.
 *
 * `frame` is optional: a site with no chrome is a page body on its own. When a frame
 * IS present its outlet is replaced by the page body in place — the same splice
 * silica's `composeFrame` performs, done here rather than through it so each node
 * keeps the origin that tells a finding which tree to open.
 */
export function inventoryOf(
  page: LintablePage,
  frame: { root: SilicaNode } | null | undefined,
  symbols: Record<string, SymbolDef> | null | undefined
): DocumentInventory {
  const state: WalkState = {
    nodes: [],
    anchorIds: new Set(),
    missingSymbols: [],
    hasOutlet: false,
    order: 0,
    symbols: symbols ?? {},
    expanding: new Set(),
    pageRoot: page.root,
    pageOrigin: { scope: 'page', ownerId: page.id, ownerName: page.name },
  };

  if (frame?.root) {
    visit(state, frame.root, FRAME_ORIGIN, '', false, false, ROOT_PAINT);
  } else {
    // No frame: the page body IS the document, and there is nothing to splice, so
    // `hasOutlet` is vacuously satisfied rather than reported as a missing outlet.
    state.hasOutlet = true;
    visit(state, page.root, state.pageOrigin, '', false, false, ROOT_PAINT);
  }

  return {
    page,
    nodes: state.nodes,
    anchorIds: state.anchorIds,
    missingSymbols: state.missingSymbols,
    hasOutlet: state.hasOutlet,
  };
}

function visit(
  state: WalkState,
  node: SilicaNode,
  origin: NodeOrigin,
  parentPath: string,
  inControl: boolean,
  inInteractive: boolean,
  parentPaint: PaintContext
): void {
  // The outlet is where the page body goes. It contributes no node of its own —
  // it is a marker, not markup — so it is not recorded, only followed. The paint
  // context DOES cross it: a page body renders inside whatever the frame painted.
  if (node.kind === 'outlet') {
    state.hasOutlet = true;
    visit(
      state,
      state.pageRoot,
      state.pageOrigin,
      parentPath,
      inControl,
      inInteractive,
      parentPaint
    );
    return;
  }

  const type = typeOf(node);
  const nodePath = parentPath ? `${parentPath} › ${type}` : type;
  const paint = paintOf(parentPaint, node.class);

  state.nodes.push({
    node,
    origin,
    order: state.order++,
    nodePath,
    inControl,
    inInteractive,
    paint,
  });

  const domId = attr(node, 'id');
  if (domId) state.anchorIds.add(domId);

  // A symbol INSTANCE holds no children of its own: at render it expands to a clone
  // of the master with this instance's overrides applied. Descend into that expansion
  // — with the origin switched to the symbol, so the finding names the saved
  // component the author would open — rather than into the instance's empty shell.
  const instanceOf = node.instanceOf;
  if (instanceOf) {
    const master = state.symbols[instanceOf];
    if (!master) {
      state.missingSymbols.push({ symbolId: instanceOf, origin, nodePath });
      return;
    }
    if (state.expanding.has(instanceOf)) return;
    state.expanding.add(instanceOf);
    const expanded = applyOverrides(master.root, node.overrides);
    visit(
      state,
      expanded,
      { scope: 'symbol', ownerId: instanceOf, ownerName: master.name },
      nodePath,
      inControl,
      inInteractive,
      paint
    );
    state.expanding.delete(instanceOf);
    return;
  }

  const lower = type.toLowerCase();
  const nextInControl = inControl || CONTROL_TAGS.has(lower) || lower === 'button';
  const nextInInteractive =
    inInteractive || INTERACTIVE_TAGS.has(lower) || node.behavior != null || node.part != null;

  // NOT `childNodes` — that drops the outlet, and the outlet is the entire point of
  // walking the frame. Filtering it out here silently produced a document with no
  // page body in it, which reported every page on the site as empty.
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    visit(state, child, origin, nodePath, nextInControl, nextInInteractive, paint);
  }
}
