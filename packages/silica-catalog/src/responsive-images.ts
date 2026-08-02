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
// silicaui 0.36.0 forwards `srcset`/`sizes` (docs/silicaui/01 §6), so that workaround is gone
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

/**
 * Tailwind's `max-w-*` scale in CSS pixels, for the named steps this library actually
 * uses. Deliberately NOT the whole scale: `max-w-full` / `max-w-none` are not caps, and
 * `max-w-prose` is `65ch`, which depends on the theme's font and cannot be resolved here.
 */
const MAX_W_PX: Readonly<Record<string, number>> = {
  xs: 320, // 20rem
  sm: 384, // 24rem
  md: 448, // 28rem
  lg: 512, // 32rem
  xl: 576, // 36rem
  '2xl': 672, // 42rem
  '3xl': 768, // 48rem
  '4xl': 896, // 56rem
  '5xl': 1024, // 64rem
  '6xl': 1152, // 72rem
  '7xl': 1280, // 80rem
};

/** An UNPREFIXED `max-w-<step>` on this node, in px, or undefined. Variant-prefixed caps
 *  (`@2xl:max-w-3xl`) are skipped on purpose: they apply only above a CONTAINER width,
 *  and a cap that might not be in force is not a bound we can rely on. */
function capOf(cls: string | undefined): number | undefined {
  if (!cls) return undefined;
  for (const token of cls.split(/\s+/)) {
    if (token.includes(':')) continue;
    if (!token.startsWith('max-w-')) continue;
    const px = MAX_W_PX[token.slice(6)];
    if (px) return px;
  }
  return undefined;
}

/** The tighter of two caps — nested containers compound, and the innermost wins. */
function tighter(a: number | undefined, b: number | undefined): number | undefined {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function srcsetFor(src: string): string {
  const sep = src.includes('?') ? '&' : '?';
  return MEDIA_WIDTHS.map((w) => `${src}${sep}w=${w} ${w}w`).join(', ');
}

/**
 * What slot will this image be painted into?
 *
 * Three answers, tightest first.
 *
 * A FIXED SIZE on the image wins outright. `100vw` is badly wrong for it: a 64px avatar
 * on a wide display would otherwise still select the 2000px rung, which is the exact
 * waste this file exists to remove.
 *
 * Next, an ancestor's `max-w-*` CAP. A picture inside a `max-w-3xl` column can never
 * render wider than 768px however large the display, so offering `100vw` there means
 * every desktop visitor downloads the 2000px rung for a 768px slot. `(min-width: 768px)
 * 768px, 100vw` is EXACT rather than a guess: above the cap the slot is the cap, below it
 * the slot is the viewport. Most sections in this library cap their content, so this is
 * the common case, not an edge one.
 *
 * Otherwise `100vw` — the honest default for genuinely full-bleed imagery. It never
 * UNDER-fetches (which would be a visibly soft image), and it already captures the win
 * that matters most: on a phone 100vw is ~390px, so the browser picks the 400 or 800 rung
 * instead of the 2000 it used to take.
 *
 * WHAT IS DELIBERATELY NOT DONE: dividing by a grid's column count. `grid-cols-*` here is
 * written as a CONTAINER query (`@2xl:grid-cols-4`), and `sizes` can only express VIEWPORT
 * conditions — the two are not interchangeable, because a wide viewport says nothing about
 * a narrow container. Guessing the mapping risks claiming 25vw for a slot that is actually
 * the full container width, and an UNDER-stated `sizes` is a blurry image, which is worse
 * than a wasteful one. The cap above needs no such guess.
 */
function sizesFor(cls: string | undefined, cap: number | undefined): string {
  const match = cls ? FIXED_SIZE.exec(cls) : null;
  if (match) return `${Number(match[1]) * 4}px`;
  if (cap == null) return '100vw';
  return `(min-width: ${cap}px) ${cap}px, 100vw`;
}

/** Add the ladder to one lowered `<img>`, or return it untouched. Pure — the tree may
 *  be a shared, memoized starter tree, so nothing here mutates in place. */
function withSrcset(node: ElementNode, cap: number | undefined): ElementNode {
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
      sizes: typeof attrs?.sizes === 'string' ? attrs.sizes : sizesFor(node.class, cap),
    },
  };
}

/** The same ladder on a COMPONENT node — an `Image` atom, which is what a product card
 *  actually uses. Sets props and lets silica's own `expand` lower them.
 *
 *  This used to call `expandComponent` here and patch the resulting element, because
 *  `Image.expand` built a fixed attribute set (`src`/`alt`/`loading`) and dropped a
 *  `srcset` prop without a word. silicaui 0.36.0 forwards both (docs/silicaui/01 §6), so the
 *  walk no longer has to lower a node early to reach its attributes — which also means
 *  it no longer changes any node's KIND mid-tree.
 *
 *  A component that carries `src` but lowers to something else (`Video`) builds its own
 *  attrs and simply ignores these props, so there is nothing to detect and no
 *  component-name allowlist to keep in step with the engine. */
function withSrcsetProps(
  node: Extract<Node, { kind: 'component' }>,
  cap: number | undefined
): Node {
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
      sizes: typeof props?.sizes === 'string' ? props.sizes : sizesFor(node.class, cap),
    },
  };
}

/** `cap` is the tightest `max-w-*` of everything ENCLOSING this node, in px — the width
 *  bound an image here cannot exceed. Threaded down rather than looked up because a tree
 *  has no parent pointers, and it is the only ancestor fact `sizes` needs. */
function rewrite(child: Child, cap: number | undefined): Child {
  if (typeof child === 'string' || child.kind === 'outlet') return child;

  // This node's own cap applies to its descendants AND to itself: an `<img max-w-3xl>` is
  // bounded by its own class just as much as by its container's.
  const inner = tighter(cap, capOf(child.class));

  if (child.kind === 'element') {
    const patched = withSrcset(child, inner);
    if (patched !== child) return patched;
  } else if (child.kind === 'component') {
    const patched = withSrcsetProps(child, inner);
    // An image atom is a leaf — no children to walk — so returning here is complete.
    if (patched !== child) return patched;
  }

  const children = child.children;
  if (!children?.length) return child;
  let changed = false;
  const next = children.map((c) => {
    const out = rewrite(c, inner);
    if (out !== c) changed = true;
    return out;
  });
  return changed ? { ...child, children: next } : child;
}

/** Attach `srcset` + `sizes` to every resolver-backed image in a resolved tree.
 *  Returns the SAME node when nothing matched, so a site with no sparx-hosted
 *  imagery pays nothing but the walk. */
export function responsiveImages(node: Node): Node {
  return rewrite(node, undefined) as Node;
}
