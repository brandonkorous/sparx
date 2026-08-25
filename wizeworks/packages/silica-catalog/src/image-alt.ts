// Image descriptions — putting back the sentence the binding had to drop.
//
// THE PROBLEM. A silica node carries AT MOST ONE `data` marker, structurally. An image
// therefore binds its `src` OR its `alt`, never both, and `src` is the one that has to
// win. But an image field resolves to `{ url, alt }`: the description is fetched, handed
// to the host, and thrown away one line before it could be used. Every product photo on
// every storefront reached the page reading "Product image" — including the ones whose
// owner had written a sentence into the field that promises it will be "read aloud to
// shoppers who cannot see the picture" (issue 197).
//
// THE FIX IS A DERIVATION, NOT A SECOND BINDING. The resolver keeps `{url → alt}` as it
// resolves (`createSilicaResolver().imageAlts`) and this walk writes it back onto the
// resolved tree, matching on the src that is now sitting on the node. Same shape as
// `responsiveImages` next door, and for the same reason: the value only exists AFTER
// resolution, so it cannot be authored and cannot be bound.
//
// WHAT IT WILL NOT OVERWRITE. An alt the AUTHOR wrote on the node stays. Only the
// catalog's own generic stand-ins are replaced — an author who typed a real description
// into the builder outranks the record, because they were looking at the page.

import { type Child, type ElementNode, type Node } from '@wizeworks/silicaui-html';

/**
 * The alt values the catalog authors as a placeholder on a node it expects to be BOUND.
 *
 * These are not descriptions, they are the word "image" in a longer coat, and they are
 * what a shopper's screen reader announces today. Anything else on a node was typed by
 * somebody and is left alone.
 */
const GENERIC_ALTS = new Set(['', 'product image', 'image', 'photo', 'picture']);

function isGeneric(alt: unknown): boolean {
  if (alt == null) return true;
  return typeof alt === 'string' && GENERIC_ALTS.has(alt.trim().toLowerCase());
}

/** An image, whichever shape it is at this point: the `Image` component atom the catalog
 *  authors, or a raw `<img>` somebody dropped in. Mirrors `attr-binding.ts`. */
function imageSlot(child: Child): 'props' | 'attrs' | null {
  if (typeof child === 'string' || child.kind === 'outlet') return null;
  if (child.kind === 'component' && child.component === 'Image') return 'props';
  if (child.kind === 'element' && child.tag === 'img') return 'attrs';
  return null;
}

/**
 * The key an image's src matches on: the url with its query removed.
 *
 * BOTH SIDES carry a query and neither side's is the other's. The record's url arrives
 * already signed with the tenant (`?tenant=juniper-row`), and `responsiveImages` appends a
 * width to the src it builds the ladder from. Matching whole strings therefore matched
 * NOTHING, on exactly the images this exists for — the first attempt at this shipped that
 * way and looked like it worked, because a miss is silent and the fallback is the same
 * word the bug produced.
 */
function altKey(src: string): string {
  const cut = src.search(/[?#]/);
  return cut === -1 ? src : src.slice(0, cut);
}

/** The map re-keyed the way a src will be looked up. */
function index(alts: ReadonlyMap<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [url, alt] of alts) out.set(altKey(url), alt);
  return out;
}

function fill(child: Child, alts: ReadonlyMap<string, string>): Child {
  let out = child;
  const slot = imageSlot(child);

  if (slot && typeof child !== 'string' && child.kind !== 'outlet') {
    const bag = (child as unknown as Record<string, Record<string, unknown> | undefined>)[slot];
    const src = bag?.src;
    if (typeof src === 'string' && src !== '' && isGeneric(bag?.alt)) {
      const alt = alts.get(altKey(src));
      if (alt !== undefined) {
        out = {
          ...child,
          [slot]: { ...(bag ?? {}), alt },
        };
      }
    }
  }

  if (typeof out === 'string' || out.kind === 'outlet') return out;
  const children = (out as ElementNode).children;
  if (!children?.length) return out;
  let changed = false;
  const next = children.map((c) => {
    const r = fill(c, alts);
    if (r !== c) changed = true;
    return r;
  });
  return changed ? { ...out, children: next } : out;
}

/**
 * Give every bound image the description its record carried.
 *
 * Pure — returns the SAME node when nothing matched, so a tree of static images (or a
 * render with no resolver) pays only the walk.
 */
export function fillImageAlt(node: Node, alts: ReadonlyMap<string, string>): Node {
  if (alts.size === 0) return node;
  return fill(node, index(alts)) as Node;
}
