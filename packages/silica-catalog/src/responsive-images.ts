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
// WHY IT RUNS AFTER LOWERING. A product card's image is an `Image` ATOM, not an
// `<img>` element, and silica's `Image.expand` builds a fixed attribute set —
// `src`, `alt`, `loading`. A `srcset` prop on the atom is silently dropped. So a
// component whose expansion is an image is expanded HERE, through silica's own
// `expandComponent`, and the expansion is what gets patched. Re-implementing that
// lowering locally would fork the `ratio` → aspect-class mapping and drift from it.
// A component that expands to anything else is left completely untouched.

import { expandComponent, type Child, type ElementNode, type Node } from '@wizeworks/silicaui-html';

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

/** silica's lowering, guarded. A render path must never throw over an image: an
 *  unknown component name in a tree restored from an older release would otherwise
 *  take down the whole page instead of one picture. */
function tryExpand(node: Node): Node | null {
  if (node.kind !== 'component') return null;
  try {
    return expandComponent(node);
  } catch {
    return null;
  }
}

function rewrite(child: Child): Child {
  if (typeof child === 'string' || child.kind === 'outlet') return child;

  if (child.kind === 'element') {
    const patched = withSrcset(child);
    if (patched !== child) return patched;
  } else if (child.kind === 'component') {
    const expanded = tryExpand(child);
    if (expanded?.kind === 'element' && expanded.tag === 'img') {
      const patched = withSrcset(expanded);
      // Substitute the expansion ONLY when it gained something. An image we can't
      // improve (external URL, no source yet) stays a component node, so this walk
      // changes nothing about how the rest of the render behaves.
      if (patched !== expanded) return patched;
      return child;
    }
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
