// Attribute bindings — the bridge that lets a bound value land in an ELEMENT
// ATTRIBUTE (a product card's `href`) rather than in its text.
//
// ── Why this still exists on silicaui 0.14 ───────────────────────────────────
// 0.14 shipped the attribute binding we asked for: `DataBinding` gained an
// optional `attr`, and `fillValue(node, value, attr)` writes `attrs[attr]`. But
// `resolveTree` cannot yet USE it on a container. From `resolve.ts`:
//
//     if (node.data?.kind === 'value' && host.resolveBinding) {
//       const filled = fillValue(node, resolved.value, node.data.attr);
//       const { data: _data, ...rest } = filled;
//       return { ...rest };          // ← returns WITHOUT resolving children
//     }
//
// For a TEXT binding that early return is right — `fillValue` just replaced the
// children with the value. For an ATTRIBUTE binding it is wrong: `fillValue`
// keeps the children, and they are never resolved. Bind a card's `<a href>` and
// every binding inside it (title, price, image) survives to the HTML as a dead
// `data-sui-bind` marker over placeholder text.
//
// That is exactly — and only — the case attribute binding exists for. So until
// the engine resolves children through an attribute binding (docs/119 Q22; the
// fix is to recurse when `node.data.attr` is set), the value keeps riding a
// LEAF carrier, which `resolveNode` handles correctly.
//
// ── The bridge ───────────────────────────────────────────────────────────────
// `bindAttr` tucks a bound `<input type="hidden" name="__sui-attr:href">` inside
// the target element; `resolveTree` fills its `value` attribute like any other
// input (a leaf — nothing to descend into, so nothing is lost); then
// `hoistAttrBindings` — one pass between resolve and `toHtml` — lifts that value
// onto the parent's real attribute and deletes the carrier input. The emitted
// HTML never contains the input, and the card's own bindings resolve normally.
//
// This is deliberately a HOST-side bridge, not a fork of the engine: it composes
// documented silica behavior and touches nothing the engine owns. It is also
// deliberately narrow and self-deleting — once `resolveTree` recurses through an
// attribute binding, delete this file, swap `bindAttr(node, 'href', ref)` for
// silica's own `{kind:'value', ref, attr:'href'}`, and drop the
// `hoistAttrBindings` call from `render.ts`. Nothing else changes.
//
// It also preserves one behavior the native path loses: a value that resolves to
// `''` sets NO attribute here, where `fillValue` would write `href=""` — an
// anchor that silently reloads the current page.
//
// Safety: the hoisted value reaches `toHtml`'s `sanitizeElement`, which enforces
// the per-tag attribute allowlist AND runs `isSafeUrl` over `href`/`src`/`srcset`/
// `cite` — so a `javascript:` payload smuggled through host data is dropped there,
// exactly as it would be for an authored href.

import { bind, el, type Child, type ElementNode, type Node } from '@wizeworks/silicaui-html';

/** Marks a hidden input as an attribute carrier. The suffix is the target attr. */
const ATTR_CARRIER_PREFIX = '__sui-attr:';

/** Is this the carrier input `bindAttr` planted? */
function carrierAttr(node: Node): string | undefined {
  if (node.kind !== 'element' || node.tag !== 'input') return undefined;
  const name = node.attrs?.name;
  if (typeof name !== 'string' || !name.startsWith(ATTR_CARRIER_PREFIX)) return undefined;
  return name.slice(ATTR_CARRIER_PREFIX.length) || undefined;
}

/**
 * Bind `ref` into `element`'s `attr` (e.g. `bindAttr(anchor, 'href', 'url')`).
 *
 * Mutates and returns the element for inline use, matching silica's own `bind` /
 * `behave` / `action` helpers. The carrier is prepended so it never separates
 * meaningful siblings.
 *
 * The element keeps its own children — that is the entire point: a card can bind
 * its `href` and still render an image, a title, and a price.
 */
export function bindAttr<T extends ElementNode>(element: T, attr: string, ref: string): T {
  const carrier = bind(
    el('input', '', { attrs: { type: 'hidden', name: `${ATTR_CARRIER_PREFIX}${attr}` } }),
    ref
  );
  element.children = [carrier, ...(element.children ?? [])];
  return element;
}

/**
 * Lift every resolved attribute carrier onto its parent and strip the carriers.
 * Runs on the RESOLVED tree, immediately before `toHtml`.
 *
 * A carrier whose value resolved to `''` (or which never resolved at all, because
 * the tree was rendered with no host) sets NO attribute: a product with no URL
 * renders as a plain, un-clickable card rather than an `<a href="">` that
 * silently reloads the current page.
 *
 * Pure — returns a new tree, mutating nothing the caller owns.
 */
export function hoistAttrBindings(node: Node): Node {
  if (node.kind === 'outlet' || !node.children) return node;

  const attrs: Record<string, string | number | boolean> = {};
  const children: Child[] = [];

  for (const child of node.children) {
    if (typeof child === 'string') {
      children.push(child);
      continue;
    }
    const attr = carrierAttr(child);
    if (attr) {
      // Only a non-empty resolved value becomes an attribute; the carrier always
      // goes, resolved or not, so it can never reach the HTML.
      const value = (child as ElementNode).attrs?.value;
      if (typeof value === 'string' && value !== '') attrs[attr] = value;
      continue;
    }
    children.push(hoistAttrBindings(child));
  }

  const next = { ...node, children } as Node;
  if (Object.keys(attrs).length === 0) return next;
  // Carriers win over an authored placeholder attr of the same name — the whole
  // point of binding one is to replace the static default.
  const element = next as ElementNode;
  element.attrs = { ...(element.attrs ?? {}), ...attrs };
  return element;
}
