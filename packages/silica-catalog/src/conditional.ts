// Conditional visibility — showing a node only when the data behind it exists.
//
// silicaui 0.36.0 added `{ kind: 'visible', ref, negate? }` (doc 139 §10): the engine
// asks the host for `ref` and DROPS the node and its subtree when the answer is absent —
// `null`, `undefined`, `false`, `''`, or an empty array. An `editing` walk ghosts it
// instead of dropping, so the author can still select and un-bind it on the canvas.
//
// WHY IT IS A SEPARATE NODE FROM THE VALUE BIND. A node carries ONE `data` binding, so
// the same node cannot both be filled by a ref and hidden by it. The conditional
// therefore wraps: the outer node decides whether anything renders, the inner one
// renders the value. That reads as an extra element, and it is — but the alternative
// (a `when` + predicate language in the schema) buys a debugging surface made of
// invisible sections for cases nobody has yet.
//
// WHY NOT JUST HIDE EVERY EMPTY BOUND NODE. `createSilicaResolver` already has
// `hideWhenEmpty`, and it is deliberately EMAIL-ONLY. Two reasons it must not become
// the storefront default:
//
//   · It also hides an UNKNOWN ref, where silica's documented contract is to keep the
//     authored content and report a diagnostic. On a canvas that difference is the
//     difference between "my placeholder is still there" and "my section vanished".
//   · An empty value is sometimes load-bearing. The buy box's hidden `variantId` field
//     renders `value=""` ON PURPOSE for a product with no live variant: the field is
//     `required`, so the browser blocks the submit. Hide that node and the form posts
//     an order with no variant.
//
// Per-node and opt-in is the shape that cannot cause either.

import type { ElementNode, Node } from '@wizeworks/silicaui-html';

/**
 * Render `element` only when `ref` resolves to something.
 *
 * Mutates and returns the element for inline use, matching `bind` / `bindAttr`. Pass
 * `negate` to invert it — show only when the ref is ABSENT, which is how an "out of
 * stock" or "no results yet" message is authored.
 */
export function visibleWhen<T extends ElementNode>(element: T, ref: string, negate = false): T {
  element.data = negate ? { kind: 'visible', ref, negate: true } : { kind: 'visible', ref };
  return element;
}

/** The ref a node's visibility hangs on, or undefined. The read side of `visibleWhen`,
 *  so a linter or an inspector can explain why a node is missing from the output
 *  instead of reporting it as empty. */
export function visibilityRef(node: Node): string | undefined {
  if (node.kind === 'outlet') return undefined;
  return node.data?.kind === 'visible' ? node.data.ref : undefined;
}
