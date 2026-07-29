// Responsive images — the emit half of the media pipeline.
//
// THE PROBLEM. `media-worker` has always generated four widths in three formats for
// every upload, but nothing ever put a `srcset` on the page. So every visitor got
// whatever single width the author's URL named — and the resolver
// (`/v1/public/media/:id`) answered every request with the WIDEST variant it had. A
// phone painting a 390px-wide hero downloaded the 2000px file. The variants were
// built, paid for, and never used.
//
// THE FIX IS A DERIVATION, NOT A LOOKUP. This walk appends the full width ladder to
// every `<img>` whose source is a sparx media-resolver URL. It does NOT ask which
// widths a given asset actually has, and deliberately so: `media-worker` skips widths
// above the source, so a 900px upload has no 1200 or 2000 rung, and knowing that here
// would cost either a per-image round trip at render or a set of widths frozen onto
// the node at publish. Instead `pickVariant` on the resolver CLAMPS — asking for a
// width nobody generated returns the widest that exists. Naming a rung that isn't
// there is therefore harmless, which is what makes deriving blindly correct.
//
// The same property makes `MEDIA_WIDTHS` drifting from the worker's `VARIANT_WIDTHS`
// a degradation rather than a break: an extra width here resolves down to the real
// widest, and a missing one is simply an offer we failed to make.
//
// TWO NODE SHAPES, ONE LADDER. A hand-authored picture is an `<img>` ELEMENT and takes
// the ladder as attributes; a product card's image is an `Image` ATOM and takes it as
// props, which silica's own `expand` lowers. Both are handled here.
//
// The atom half used to call `expandComponent` and patch the resulting element, because
// `Image.expand` built a fixed attribute set and dropped a `srcset` prop silently.
// silicaui 0.36.0 forwards `srcset`/`sizes` (doc 139 §6), so that workaround is gone
// along with its one real hazard: lowering a node early changed its kind mid-tree.

import { type Child, type ElementNode, type Node } from '@wizeworks/silicaui-html';

/**
 * The width ladder offered to the browser. Mirrors `VARIANT_WIDTHS` in
 * `services/media-worker/src/env.ts` — see the note above on why drift degrades
 * rather than breaks.
 *
 * 2000 stays at the top on purpose. It is not what a phone downloads (that is what
 * `sizes` decides); it is the rung a full-bleed hero on a large display selects, and
 * without it the widest image on the platform would be 1200px — upscaled, and
 * visibly soft, on any laptop. The cost of keeping it is storage, which is already
 * spent; the cost of everyone RECEIVING it was the actual bug.
 */
export const MEDIA_WIDTHS = [400, 800, 1200, 2000] as const;

/**
 * A sparx media-resolver URL: `/v1/public/media/<uuid>`, with or without an origin.
 *
 * Only this route honours `w`. Three things are deliberately excluded:
 *   · `/v1/public/media/variants/...` — already a specific stored object; the uuid
 *     requirement right after `media/` rules it out, since `variants` is not one.
 *   · external hot-linked URLs (a blueprint pointing at someone else's CDN) — their
 *     `w` parameter, if any, means something else.
 *   · `data:` URIs — the bytes are already inline.
 */
const RESOLVER_URL =
  /\/v1\/public\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:[?#]|$)/i;

/** A fixed-size utility on the image itself — `size-16`, `w-12`, `h-24`. Tailwind's
 *  spacing scale is 0.25rem per step, so the number is quarters of the root size.
 *  `w-full` and `w-1/2` deliberately do not match: neither is a pixel width. */
const FIXED_SIZE = /(?:^|\s)(?:size|w|h)-(\d+)(?:\s|$)/;

function srcsetFor(src: string): string {
  const sep = src.includes('?') ? '&' : '?';
  return MEDIA_WIDTHS.map((w) => `${src}${sep}w=${w} ${w}w`).join(', ');
}

/**
 * What slot will this image be painted into?
 *
 * `100vw` for anything laid out fluidly. It is the honest default: it never
 * UNDER-fetches (which would be a visibly soft image), and it captures the win that
 * actually matters — on a phone, 100vw is ~390px, so the browser picks the 400 or 800
 * rung instead of the 2000 it takes today. A narrower guess would need to know the
 * grid column count, which is an ancestor fact this walk deliberately does not carry.
 *
 * A fixed-size image is the exception worth special-casing, because 100vw is badly
 * wrong for it: a 64px avatar on a wide display would otherwise still select the
 * 2000px rung, which is the exact waste this file exists to remove.
 */
function sizesFor(cls: string | undefined): string {
  const match = cls ? FIXED_SIZE.exec(cls) : null;
  if (!match) return '100vw';
  return `${Number(match[1]) * 4}px`;
}

/** Add the ladder to one lowered `<img>`, or return it untouched. Pure — the tree may
 *  be a shared, memoized starter tree, so nothing here mutates in place. */
function withSrcset(node: ElementNode): ElementNode {
  if (node.tag !== 'img') return node;
  const attrs = node.attrs;
  const src = typeof attrs?.src === 'string' ? attrs.src : '';
  // An authored `srcset` wins — someone who wrote one meant it.
  if (!src || attrs?.srcset != null) return node;
  // An explicit width already pins this URL to one variant; offering a ladder on top
  // would hand the browser four URLs that all resolve to the same file.
  if (/[?&]w=/.test(src)) return node;
  if (!RESOLVER_URL.test(src)) return node;
  return {
    ...node,
    attrs: {
      ...attrs,
      srcset: srcsetFor(src),
      sizes: typeof attrs?.sizes === 'string' ? attrs.sizes : sizesFor(node.class),
    },
  };
}

/** The same ladder on a COMPONENT node — an `Image` atom, which is what a product card
 *  actually uses. Sets props and lets silica's own `expand` lower them.
 *
 *  This used to call `expandComponent` here and patch the resulting element, because
 *  `Image.expand` built a fixed attribute set (`src`/`alt`/`loading`) and dropped a
 *  `srcset` prop without a word. silicaui 0.36.0 forwards both (doc 139 §6), so the
 *  walk no longer has to lower a node early to reach its attributes — which also means
 *  it no longer changes any node's KIND mid-tree.
 *
 *  A component that carries `src` but lowers to something else (`Video`) builds its own
 *  attrs and simply ignores these props, so there is nothing to detect and no
 *  component-name allowlist to keep in step with the engine. */
function withSrcsetProps(node: Extract<Node, { kind: 'component' }>): Node {
  const props = node.props;
  const src = typeof props?.src === 'string' ? props.src : '';
  if (!src || props?.srcset != null) return node;
  if (/[?&]w=/.test(src)) return node;
  if (!RESOLVER_URL.test(src)) return node;
  return {
    ...node,
    props: {
      ...props,
      srcset: srcsetFor(src),
      sizes: typeof props?.sizes === 'string' ? props.sizes : sizesFor(node.class),
    },
  };
}

function rewrite(child: Child): Child {
  if (typeof child === 'string' || child.kind === 'outlet') return child;

  if (child.kind === 'element') {
    const patched = withSrcset(child);
    if (patched !== child) return patched;
  } else if (child.kind === 'component') {
    const patched = withSrcsetProps(child);
    // An image atom is a leaf — no children to walk — so returning here is complete.
    if (patched !== child) return patched;
  }

  const children = child.children;
  if (!children?.length) return child;
  let changed = false;
  const next = children.map((c) => {
    const out = rewrite(c);
    if (out !== c) changed = true;
    return out;
  });
  return changed ? { ...child, children: next } : child;
}

/** Attach `srcset` + `sizes` to every resolver-backed image in a resolved tree.
 *  Returns the SAME node when nothing matched, so a site with no sparx-hosted
 *  imagery pays nothing but the walk. */
export function responsiveImages(node: Node): Node {
  return rewrite(node) as Node;
}
