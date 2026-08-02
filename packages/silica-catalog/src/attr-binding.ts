// Attribute bindings — a bound value landing in an ELEMENT ATTRIBUTE (a product card's
// `href`) rather than in its text.
//
// ── This used to be a bridge. It is now a thin helper. ───────────────────────
// silica has supported `{ kind: 'value', ref, attr }` for a long time, but until
// 0.36.0 `resolveTree` returned from the value branch WITHOUT resolving children. For a
// text binding that is right (the children were just replaced by the value); for an
// attribute binding it was wrong — `fillValue` keeps the children and nothing resolved
// them. Bind a card's `<a href>` and every binding inside it (title, price, image)
// reached the HTML as a dead marker over placeholder text, which is exactly and only
// the case attribute binding exists for.
//
// So the value rode a hidden `<input>` carrier that `resolveTree` filled as a leaf, and
// a `hoistAttrBindings` pass lifted it onto the parent before `toHtml`. That workaround
// is GONE: 0.36.0's value branch recurses (docs/silicaui/01 §7 / Q22), so these are plain native
// bindings and the carrier, the hoist pass, and the `__sui-attr:` protocol are deleted.
//
// ── What did NOT come back for free ──────────────────────────────────────────
// The carrier also skipped the attribute entirely when the value resolved to `''`.
// `fillValue` does not: it writes `href=""`, which is an anchor that silently reloads
// the current page — worse than no link, because it looks clickable. A product with no
// URL has to degrade to a plain, un-clickable card.
//
// That is what `dropEmptyUrlAttrs` restores, and it is strictly better placed than the
// old hoist: it is not tied to bindings at all, so an AUTHORED `href=""` (a half-filled
// link somebody left behind) is cleaned up too.
//
// Safety is unchanged and still the engine's: `toHtml`'s `sanitizeElement` enforces the
// per-tag attribute allowlist and runs `isSafeUrl` over `href`/`src`/`srcset`/`cite`, so
// a `javascript:` payload smuggled through host data is dropped there exactly as it
// would be for an authored one.

import type { Child, ElementNode, Node } from '@wizeworks/silicaui-html';

/**
 * Bind `ref` into `element`'s `attr` (e.g. `bindAttr(anchor, 'href', 'url')`).
 *
 * Mutates and returns the element for inline use, matching silica's own `bind` /
 * `behave` / `action` helpers. `bind()` itself fills a node's PRIMARY content and takes
 * no attribute, so this sets the binding directly — the one line of difference that
 * justifies a named helper rather than an inline `data` literal at every call site.
 *
 * The element keeps its own children — that is the entire point: a card can bind its
 * `href` and still render an image, a title, and a price.
 */
export function bindAttr<T extends ElementNode>(element: T, attr: string, ref: string): T {
  element.data = { kind: 'value', ref, attr };
  return element;
}

/**
 * Which of THIS node's attributes are filled by a binding at render time.
 *
 * Exists because a bound attribute is invisible to anything reading the authored tree:
 * a product card is an `<a>` with no `href`, which is indistinguishable from an anchor
 * somebody forgot to finish. It read that way to a human scanning the JSON and it read
 * that way to `@sparx/site-lint`, which reported every product card on the starter site
 * as "looks like a link but is not one".
 *
 * Renamed from `carrierBoundAttrs` when the carrier died, deliberately: the old name
 * described a mechanism that no longer exists, and a rename makes every caller fail to
 * compile rather than quietly keep asking a stale question.
 */
export function boundAttrs(node: Node): string[] {
  if (node.kind === 'outlet') return [];
  const data = node.data;
  return data?.kind === 'value' && data.attr ? [data.attr] : [];
}

/** Attributes where an empty string is worse than absence. An empty `alt` means
 *  "decorative" and an empty `value` is a legitimately empty field, so this is
 *  deliberately only the URL-bearing set. */
const URL_ATTRS = ['href', 'src', 'srcset', 'poster', 'cite', 'action', 'formaction'] as const;

function scrub(node: ElementNode): ElementNode {
  const attrs = node.attrs;
  if (!attrs) return node;
  let hit = false;
  for (const name of URL_ATTRS) {
    if (attrs[name] === '') {
      hit = true;
      break;
    }
  }
  if (!hit) return node;
  const next: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === '' && (URL_ATTRS as readonly string[]).includes(key)) continue;
    next[key] = value;
  }
  return { ...node, attrs: next };
}

/**
 * Remove URL attributes that resolved to the empty string, anywhere in a resolved tree.
 * Runs immediately before `toHtml`.
 *
 * Pure — returns the SAME node when nothing matched, so a tree with no empty URLs pays
 * nothing but the walk.
 */
export function dropEmptyUrlAttrs(node: Node): Node {
  return walk(node) as Node;
}

function walk(child: Child): Child {
  if (typeof child === 'string' || child.kind === 'outlet') return child;

  const scrubbed = child.kind === 'element' ? scrub(child) : child;

  const children = scrubbed.children;
  if (!children?.length) return scrubbed;
  let changed = false;
  const next = children.map((c) => {
    const out = walk(c);
    if (out !== c) changed = true;
    return out;
  });
  return changed ? { ...scrubbed, children: next } : scrubbed;
}
