// One-way HTML import (docs/98 section 3.8 + 4.2) -- parse a Tailwind HTML
// fragment into validated Pillar-1 `Element` nodes. This is the import HALF of the
// View-HTML / import pair; View HTML (serialize) lives in @wizeworks/builder-render.
//
// CONTRACT (load-bearing, from 4.2):
//   - It is ONE-WAY. Importing is an INSERT, exactly like stamping a catalog
//     entry -- there is no HTML->tree reverse sync. The caller hands the emitted
//     tree to the editor's stamp/insert path (`cloneWithFreshIds` + append).
//   - It is LOSSY BY DESIGN. Bindings, behaviors, and component identity are
//     NEVER inferred -- import yields inert styled structure the author wires up
//     afterward.
//   - It rides the 4.1 SECURITY BOUNDARY. Every tag is validated against
//     `RAW_ELEMENTS` (denied tags -- script/style/iframe/object/embed/link/meta/...
//     -- are DROPPED), every attribute against the per-tag allow-list (`on*` and
//     raw `style` are stripped; `target="_blank"` forces `rel="noopener
//     noreferrer"` -- the same `safeElementAttrs` semantics the renderer applies),
//     and every `class` token is allowlist-validated (out-of-allowlist tokens --
//     `url(...)`, `fixed`, `z-[...]`, `content-[...]` -- are dropped).
//   - It REPORTS what it dropped/changed (`ImportReport`), so the import is
//     HONEST rather than silent.
//
// PURITY / TESTABILITY: this module is React-free and DOM-implementation-free. It
// walks a minimal {@link DomNode} shape -- the browser caller passes `DOMParser`
// output (a real `Element` satisfies `DomNode` structurally), and the unit tests
// pass a tiny hand-built tree. The class allow-list lives in
// `@wizeworks/surface-compile` (the server-only Tailwind package); rather than couple
// this client-safe schema package to it, the validator is INJECTED -- the caller
// passes `isClassAllowed`. A permissive default keeps the function usable + the
// node `class` cap still guards the persisted tree either way.

import { parseClasses, joinClasses } from './class-utils';
import {
  allowedAttrKeysFor,
  htmlAttrToPropKey,
  isRawVoidType,
  rawElementType,
  rawTagCarriesText,
  rawTagOf,
  safeElementAttrs,
  type AttrKey,
} from './element';
import type { BuilderNode } from './node';

// -- The DOM shape we walk ----------------------------------------------------
//
// A structural subset of the browser DOM that both a real `Element`/`Text` and a
// test fixture satisfy. `nodeType` follows the DOM constants (1 = element,
// 3 = text); everything else is read defensively.

/** A parsed attribute (name already lowercased by the DOM). */
export interface DomAttr {
  name: string;
  value: string;
}

/** The minimal DOM node the walker reads -- satisfied structurally by a browser
 *  `Element` / `Text`, and by the test fixtures. */
export interface DomNode {
  /** 1 = element, 3 = text (the DOM `Node.ELEMENT_NODE` / `TEXT_NODE` constants). */
  nodeType: number;
  /** Lowercased tag name for an element node; absent for text. */
  tagName?: string;
  /** Text content for a text node. */
  textContent?: string | null;
  /** Element attributes (a real DOM `NamedNodeMap` is array-like + iterable). */
  attributes?: ArrayLike<DomAttr>;
  /** Child nodes. */
  childNodes?: ArrayLike<DomNode>;
}

// -- The drop/change report ---------------------------------------------------

/** An honest account of everything the import dropped or rewrote, surfaced to the
 *  author so a lossy import is never silent (4.2). */
export interface ImportReport {
  /** Denied/unknown tags that were dropped entirely, with their child subtree
   *  (e.g. `script`, `iframe`, `marquee`). Deduped, with a count. */
  droppedTags: { tag: string; count: number }[];
  /** Attributes stripped because they are not on the tag's allow-list (or are
   *  `on*` handlers / raw `style`). `tag` is the element they sat on. Deduped. */
  droppedAttrs: { tag: string; attr: string; count: number }[];
  /** Class tokens dropped by the allow-list (`url(...)`, `fixed`, `z-[...]`, ...).
   *  Deduped, with a count. */
  droppedClasses: { token: string; count: number }[];
  /** `rel="noopener noreferrer"` forced onto N `target="_blank"` links. */
  forcedRel: number;
  /** Element nodes successfully emitted. */
  emitted: number;
}

export interface ImportResult {
  /** The emitted nodes, in document order. Each is an inert `Element` node with
   *  surviving classes + safe attrs and a FRESH id (see `makeId`). */
  nodes: BuilderNode[];
  report: ImportReport;
}

/** A class-token validator (the shape of `@wizeworks/surface-compile`'s
 *  `isClassAllowed`). Injected so this package needs no dependency on the
 *  server-only compile package (see the module header). */
export type ClassValidator = (token: string) => boolean;

/** Mint a globally-unique id for an emitted node. Injected so the caller can use
 *  the editor's `makeId` (collision-resistant across sessions) -- the schema
 *  package has no id minter of its own. */
export type IdFactory = (type: string) => string;

export interface ImportOptions {
  /** Validate each `class` token (drop the denied). Default: allow all (the node
   *  `class` cap still guards the tree; the dashboard injects the real allowlist). */
  isClassAllowed?: ClassValidator;
  /** Mint node ids. Default: a local counter-based id (fine for tests; the editor
   *  injects `makeId` so stamped ids never collide with a saved tree). */
  makeId?: IdFactory;
}

// -- Report accumulation (small mutable tally, folded into the result) ---------

interface Tally {
  droppedTags: Map<string, number>;
  droppedAttrs: Map<string, number>; // key: `${tag} ${attr}`
  droppedClasses: Map<string, number>;
  forcedRel: number;
  emitted: number;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function tallyToReport(t: Tally): ImportReport {
  const sortDesc = <T>(rows: T[], n: (r: T) => number): T[] =>
    [...rows].sort((a, b) => n(b) - n(a));
  return {
    droppedTags: sortDesc(
      [...t.droppedTags].map(([tag, count]) => ({ tag, count })),
      (r) => r.count
    ),
    droppedAttrs: sortDesc(
      [...t.droppedAttrs].map(([k, count]) => {
        const [tag, attr] = k.split(' ');
        return { tag: tag ?? '', attr: attr ?? '', count };
      }),
      (r) => r.count
    ),
    droppedClasses: sortDesc(
      [...t.droppedClasses].map(([token, count]) => ({ token, count })),
      (r) => r.count
    ),
    forcedRel: t.forcedRel,
    emitted: t.emitted,
  };
}

// -- Defaults -----------------------------------------------------------------

const ALLOW_ALL: ClassValidator = () => true;

function defaultIdFactory(): IdFactory {
  let n = 0;
  return (type: string) => {
    n += 1;
    return `${type.toLowerCase()}-import-${n}`;
  };
}

// -- Class filtering ----------------------------------------------------------

/** Partition a `class` attribute into surviving tokens (recording the dropped in
 *  the tally). Empty input -> no surviving tokens. */
function filterClasses(raw: string, isAllowed: ClassValidator, t: Tally): string {
  const kept: string[] = [];
  for (const token of parseClasses(raw)) {
    if (isAllowed(token)) kept.push(token);
    else bump(t.droppedClasses, token);
  }
  return joinClasses(kept);
}

// -- Attribute filtering ------------------------------------------------------
//
// Build the flat prop bag from the parsed attributes, keeping only allow-listed
// keys; `class`/`style`/`on*`/unknown attrs are dropped (recorded). The resulting
// props are then re-run through `safeElementAttrs` at the END so URL scheme-checks,
// boolean coercion, and the `rel="noopener noreferrer"` force are applied by the
// SAME code the renderer uses -- never re-implemented here.

function collectAttrs(
  tag: string,
  type: string,
  attrs: ArrayLike<DomAttr> | undefined,
  t: Tally
): { props: Record<string, unknown>; className: string } {
  const allowed = allowedAttrKeysFor(type);
  const props: Record<string, unknown> = {};
  let className = '';
  for (let i = 0; i < (attrs?.length ?? 0); i++) {
    const a = attrs![i]!;
    const name = a.name.toLowerCase();
    if (name === 'class') {
      className = a.value;
      continue;
    }
    // `style` and event handlers are NEVER accepted (4.1) -- the sanctioned
    // background/position emitters are authored in the inspector, not imported.
    if (name === 'style' || name.startsWith('on')) {
      bump(t.droppedAttrs, `${tag} ${name}`);
      continue;
    }
    const key = htmlAttrToPropKey(name);
    if (!key || !allowed.has(key)) {
      bump(t.droppedAttrs, `${tag} ${name}`);
      continue;
    }
    // Preserve the primitive string value; safeElementAttrs does the final
    // scheme-check + boolean coercion. A boolean attribute present with no value
    // (`disabled`) reads as '' from the DOM -- normalize to its key so the BOOL
    // coercion in safeElementAttrs accepts it.
    props[key] = boolAttrValue(key, a.value);
  }
  return { props, className };
}

// A handful of attribute keys are boolean. The DOM reports a bare boolean
// attribute (`<input disabled>`) with value '' -- safeElementAttrs accepts `true`,
// `'true'`, or the key name itself, so map '' -> the key. A non-empty value is
// kept verbatim.
const BOOL_KEYS = new Set<AttrKey>([
  'checked',
  'disabled',
  'required',
  'controls',
  'autoplay',
  'loop',
  'muted',
  'open',
]);
function boolAttrValue(key: AttrKey, value: string): string {
  if (BOOL_KEYS.has(key) && value === '') return key;
  return value;
}

// -- The walk -----------------------------------------------------------------

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function isElement(n: DomNode): boolean {
  return n.nodeType === ELEMENT_NODE && typeof n.tagName === 'string';
}
function isText(n: DomNode): boolean {
  return n.nodeType === TEXT_NODE;
}

/** Collapse a text node's content to a trimmed single-spaced string (HTML
 *  whitespace is not significant for our inline-text capture). */
function normText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

// SVG tags whose whitelisted spelling is camelCase (the DOM preserves their case,
// unlike HTML tags which it uppercases). We lowercase HTML tags but keep these.
const CASED_SVG_TAGS: Record<string, string> = {
  lineargradient: 'linearGradient',
  radialgradient: 'radialGradient',
};

/** The whitelisted tag name for a DOM `tagName`. HTML tags come back uppercased --
 *  lowercase them; the two camelCase SVG tags (`linearGradient`/`radialGradient`)
 *  are mapped back to their whitelisted spelling so an imported inline gradient is
 *  not dropped on a casing mismatch. */
function resolveTag(tagName: string): string {
  const lower = tagName.toLowerCase();
  return CASED_SVG_TAGS[lower] ?? lower;
}

interface WalkCtx {
  isClassAllowed: ClassValidator;
  makeId: IdFactory;
  t: Tally;
}

/** Walk one DOM element into an `Element` node (or null when its tag is denied --
 *  the caller then lifts its element CHILDREN up in place, so denied WRAPPERS
 *  don't discard their valid contents). */
function walkElement(el: DomNode, ctx: WalkCtx): BuilderNode | null {
  const tag = resolveTag(el.tagName ?? '');
  const type = rawElementType(tag);
  // Tag allow-list (4.1): rawTagOf returns null for a denied/unknown tag.
  if (!rawTagOf(type)) {
    bump(ctx.t.droppedTags, tag);
    return null;
  }

  const { props, className } = collectAttrs(tag, type, el.attributes, ctx.t);
  const survivingClass = filterClasses(className, ctx.isClassAllowed, ctx.t);

  // Walk children: element children recurse; a denied child element is dropped but
  // its OWN element children are spliced in (so `<center><p>...</p></center>` keeps
  // the `<p>`). Text children become either this node's `text` prop (when it has
  // no element children + carries text) or a `span` text node.
  const elementChildren: BuilderNode[] = [];
  const textRuns: string[] = [];
  for (let i = 0; i < (el.childNodes?.length ?? 0); i++) {
    const child = el.childNodes![i]!;
    if (isElement(child)) {
      const node = walkElement(child, ctx);
      if (node) elementChildren.push(node);
      else {
        // Denied wrapper: lift its already-walked element grandchildren in place.
        elementChildren.push(...liftChildren(child, ctx));
      }
    } else if (isText(child)) {
      const text = normText(child.textContent);
      if (text) textRuns.push(text);
    }
  }

  const node: BuilderNode = { id: ctx.makeId(type), type, props };
  if (survivingClass) node.class = survivingClass;

  // A void element (img/hr/input/...) has no content model -- never give it children
  // or text, regardless of what the source nested under it.
  const text = textRuns.join(' ').trim();
  if (isRawVoidType(type)) {
    // nothing more -- void leaf
  } else if (elementChildren.length > 0) {
    // Mixed content: a stray text run beside element children becomes a leading/
    // trailing span so nothing is silently lost.
    const kids = [...elementChildren];
    if (text) kids.push(makeTextNode(text, ctx));
    node.children = kids;
  } else if (text && rawTagCarriesText(type)) {
    node.props = { ...props, text };
  } else if (text) {
    // A container (div/section/...) can't hold inline text directly -- wrap it.
    node.children = [makeTextNode(text, ctx)];
  }

  applyForcedRel(node, props, ctx.t);
  ctx.t.emitted += 1;
  return node;
}

/** Walk the element children of a denied wrapper, lifting them to the parent
 *  level (recursively lifting through nested denied wrappers). */
function liftChildren(el: DomNode, ctx: WalkCtx): BuilderNode[] {
  const out: BuilderNode[] = [];
  for (let i = 0; i < (el.childNodes?.length ?? 0); i++) {
    const child = el.childNodes![i]!;
    if (!isElement(child)) continue;
    const node = walkElement(child, ctx);
    if (node) out.push(node);
    else out.push(...liftChildren(child, ctx));
  }
  return out;
}

/** A `span` text node carrying inline text (the import's representation of a bare
 *  text run that can't sit directly inside a container). */
function makeTextNode(text: string, ctx: WalkCtx): BuilderNode {
  const type = rawElementType('span');
  return { id: ctx.makeId(type), type, props: { text } };
}

/** Record (for the report) when `target="_blank"` will force `rel`. The actual
 *  `rel` is applied at render time by `safeElementAttrs`; we just verify + count
 *  here so the report is honest. */
function applyForcedRel(node: BuilderNode, props: Record<string, unknown>, t: Tally): void {
  if (props.target !== '_blank') return;
  // Confirm the renderer will indeed force it (it does for any _blank link).
  const out = safeElementAttrs({ type: node.type, props });
  if (out.rel === 'noopener noreferrer') t.forcedRel += 1;
}

// -- Public entry -------------------------------------------------------------

/** Parse a pre-built DOM fragment (its top-level child nodes) into `Element`
 *  nodes. The browser caller passes `new DOMParser().parseFromString(html,
 *  'text/html').body.childNodes`; tests pass a hand-built `DomNode[]`. Top-level
 *  bare text runs are wrapped in a `span` so they survive. */
export function importHtmlNodes(roots: ArrayLike<DomNode>, options?: ImportOptions): ImportResult {
  const ctx: WalkCtx = {
    isClassAllowed: options?.isClassAllowed ?? ALLOW_ALL,
    makeId: options?.makeId ?? defaultIdFactory(),
    t: {
      droppedTags: new Map(),
      droppedAttrs: new Map(),
      droppedClasses: new Map(),
      forcedRel: 0,
      emitted: 0,
    },
  };
  const nodes: BuilderNode[] = [];
  for (let i = 0; i < (roots?.length ?? 0); i++) {
    const root = roots[i]!;
    if (isElement(root)) {
      const node = walkElement(root, ctx);
      if (node) nodes.push(node);
      else nodes.push(...liftChildren(root, ctx));
    } else if (isText(root)) {
      const text = normText(root.textContent);
      if (text) nodes.push(makeTextNode(text, ctx));
    }
  }
  return { nodes, report: tallyToReport(ctx.t) };
}

/** Whether a report has anything worth surfacing to the author (any drop or a
 *  forced `rel`). The UI shows the report panel only when this is true. */
export function reportHasChanges(report: ImportReport): boolean {
  return (
    report.droppedTags.length > 0 ||
    report.droppedAttrs.length > 0 ||
    report.droppedClasses.length > 0 ||
    report.forcedRel > 0
  );
}

/** A short, human one-line summary of an import report (for a toast / status
 *  line). Lists the headline counts; the full detail is in the report panel. */
export function summarizeReport(report: ImportReport): string {
  const parts: string[] = [`${report.emitted} element${report.emitted === 1 ? '' : 's'} imported`];
  const tagCount = report.droppedTags.reduce((s, r) => s + r.count, 0);
  const attrCount = report.droppedAttrs.reduce((s, r) => s + r.count, 0);
  const classCount = report.droppedClasses.reduce((s, r) => s + r.count, 0);
  if (tagCount) parts.push(`${tagCount} tag${tagCount === 1 ? '' : 's'} dropped`);
  if (attrCount) parts.push(`${attrCount} attribute${attrCount === 1 ? '' : 's'} stripped`);
  if (classCount) parts.push(`${classCount} class${classCount === 1 ? '' : 'es'} removed`);
  if (report.forcedRel)
    parts.push(`${report.forcedRel} link${report.forcedRel === 1 ? '' : 's'} secured`);
  return parts.join(' - ');
}
