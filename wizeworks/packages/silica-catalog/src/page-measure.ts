// The house page measure, and the repair for the bands drawn the other way
// (piggles persona issue 950).
//
// THE RULE. Every band on a site, header and footer included, puts its content in ONE
// box: `mx-auto max-w-6xl px-6`, the gutter INSIDE the box. Content is 1,104px wide at
// most and starts on the same left edge at every width. Decided 2026-10-11.
//
// WHY IT NEEDED DECIDING. There were two ways of drawing the same 6xl measure, and they
// only disagree on a wide screen, which is why nobody saw it on a phone:
//
//   · inside: `mx-auto max-w-6xl px-6` on one box. 1,104px of content.
//   · outside: `px-6` on the band, `mx-auto max-w-6xl` on the box inside it. 1,152px.
//
// silica's own navbar and footer blocks, every list the site draws itself
// (`host-nodes.ts`) and most designs' chrome were inside. Every catalog section
// (`section()` in `sections/_shell.ts`), the shop bands and the captured golden footer
// were outside. So above 1,200px a page built from the catalog started its heading 24px
// left of its own header's name: at 1,280px, header at x=88 and Page top at x=64.
//
// WHY A REPAIR AND NOT ONLY A FACTORY FIX. A section is stamped once and frozen, so
// fixing `section()` fixes the next page and no existing one. This is the repair
// `upgradePageBody` and `upgradeFrameChrome` run on the draft at studio load, and the
// one the marketplace generators run on every bundle they emit, so a stamped band, a
// stored band and a shipped band all reach the same shape through one function.
//
// EXACTLY THE OLD SHAPES, NOTHING ELSE. Two were stamped:
//
//   · the outside band: `px-6` and no other side padding on the band, and every child
//     it has a `mx-auto max-w-6xl` box with no side padding of its own;
//   · the widened box: a `mx-auto max-w-6xl` box padded `px-6 @3xl:px-10`, which is
//     the house edge on a phone and 16px past it on a desktop (the picture bands).
//
// A band an author padded differently, a band holding anything beside its measure, or a
// narrower reading column (`max-w-3xl` is centered and never on the page edge anyway)
// is left exactly as it is.

import type { Node } from '@wizeworks/silicaui-html';

/** The one `Node` member with children: every repair here walks or rebuilds one. */
type Element = Extract<Node, { kind: 'element' }>;

function isElement(node: Node | string): node is Element {
  return typeof node !== 'string' && node.kind === 'element';
}

function tokens(cls: string | undefined): string[] {
  return (cls ?? '').split(/\s+/).filter(Boolean);
}

/** A token that sets side padding, bare or behind a variant: `px-6`, `@3xl:px-10`,
 *  `p-4`, `pl-2`. Vertical padding (`py-16`, `pt-12`) is not side padding and does
 *  not count. */
function isSidePadding(token: string): boolean {
  const bare = token.slice(token.lastIndexOf(':') + 1);
  return /^(p|px|pl|pr|ps|pe)-/.test(bare);
}

/** The gutter, which is the one class that moves. */
const GUTTER = 'px-6';
/** The measure the gutter moves onto. */
const MEASURE = 'max-w-6xl';

/** The tags a band is drawn with: the catalog stamps sections, and the captured golden
 *  footer is a footer. A div an author wrapped content in is theirs. */
const BAND_TAGS = new Set(['section', 'footer']);

/** A `mx-auto max-w-6xl` box with no side padding of its own: the inner half of the
 *  outside shape. */
function isBareMeasure(node: Node | string): node is Element {
  if (!isElement(node)) return false;
  const t = tokens(node.class);
  return t.includes('mx-auto') && t.includes(MEASURE) && !t.some(isSidePadding);
}

/**
 * Is this band drawn the OUTSIDE way: the gutter on the band, the 6xl box inside it?
 *
 * The band's only side padding is the bare `px-6`, it is not itself a measure, and it
 * holds nothing but bare measures. One box is the catalog section; two is the captured
 * footer, whose column grid and copyright row are each their own measure.
 */
export function isOutsideMeasureBand(node: Node): node is Element {
  if (!isElement(node) || !BAND_TAGS.has(node.tag)) return false;
  const t = tokens(node.class);
  const padding = t.filter(isSidePadding);
  if (padding.length !== 1 || padding[0] !== GUTTER) return false;
  if (t.some((token) => token.startsWith('max-w-'))) return false;
  const children = node.children ?? [];
  return children.length > 0 && children.every(isBareMeasure);
}

/** `cls` with `px-6` placed right after the measure, so a healed box reads the way a
 *  freshly stamped one does. */
function withGutter(cls: string | undefined): string {
  const out: string[] = [];
  for (const token of tokens(cls)) {
    out.push(token);
    if (token === MEASURE) out.push(GUTTER);
  }
  return out.join(' ');
}

/** Move the gutter from the band onto every measure inside it. Vertical padding,
 *  background, border and every other class stay where they were, so the band keeps
 *  its height and its color and only the content edge moves. */
export function toInsideMeasure(band: Element): Element {
  return {
    ...band,
    class: tokens(band.class)
      .filter((token) => token !== GUTTER)
      .join(' '),
    children: (band.children ?? []).map((child) =>
      isElement(child) ? { ...child, class: withGutter(child.class) } : child
    ),
  };
}

/** The wider gutter the picture bands stamped on a wide container. */
const WIDE_GUTTER = '@3xl:px-10';

/**
 * Is this a measure that is inside the house shape on a phone and 16px past it on a
 * wide screen? The picture bands (`overlayBand` in `sections/feature.ts`) stamped
 * `px-6 @3xl:px-10` on their box, so the panel over the photograph sat 16px right of the
 * header's name on every desktop. Its side padding must be exactly that pair.
 */
export function isWidenedMeasure(node: Node): node is Element {
  if (!isElement(node)) return false;
  const t = tokens(node.class);
  if (!t.includes('mx-auto') || !t.includes(MEASURE)) return false;
  const padding = t.filter(isSidePadding);
  return padding.length === 2 && padding.includes(GUTTER) && padding.includes(WIDE_GUTTER);
}

/** Drop the wide gutter, so the box keeps the house `px-6` at every width. */
export function toHouseGutter(box: Element): Element {
  return {
    ...box,
    class: tokens(box.class)
      .filter((token) => token !== WIDE_GUTTER)
      .join(' '),
  };
}

/** The house measure for this one node, or null when it is already right or is not a
 *  shape the platform stamped. The single entry point the page heal, the frame heal and
 *  the generators share, so the three can never disagree about what moves. */
export function measureRepair(node: Node): Element | null {
  if (isOutsideMeasureBand(node)) return toInsideMeasure(node);
  if (isWidenedMeasure(node)) return toHouseGutter(node);
  return null;
}

/**
 * Every outside band in a tree, moved to the house measure. Pure, so it is safe on every
 * studio load and in a generator. `changed` lets a caller skip a pointless save.
 *
 * Walks the whole tree: a catalog band can sit at the top of a page body, inside a
 * wrapper the author added, or in a frame. An unchanged subtree is returned as the same
 * object, so a page with nothing to repair allocates nothing.
 */
export function insideMeasure(root: Node): { root: Node; changed: boolean } {
  let changed = false;
  const visit = (node: Node): Node => {
    if (!isElement(node)) return node;
    let next: Element = node;
    const repaired = measureRepair(next);
    if (repaired) {
      next = repaired;
      changed = true;
    }
    const children = next.children;
    if (Array.isArray(children)) {
      let childChanged = false;
      const healed = children.map((child) => {
        if (typeof child === 'string') return child;
        const out = visit(child);
        if (out !== child) childChanged = true;
        return out;
      });
      if (childChanged) next = { ...next, children: healed };
    }
    return next;
  };
  const healed = visit(root);
  return { root: healed, changed };
}

/** The parts of a site declaration this touches: the frame and every page body. */
interface MeasuredSite {
  frame?: { root: Node } | null;
  pages?: { root: Node }[];
}

/**
 * A whole site at the house measure: every page body and the frame through
 * `insideMeasure`. What the marketplace generators run on every bundle they emit, so a
 * generator that still authors a band the outside way (thousands of them do, by hand)
 * ships it the house way, and a regenerated bundle never moves its edge back.
 */
export function siteInsideMeasure<S extends MeasuredSite>(site: S): S {
  const pages = site.pages?.map((page) => {
    const { root, changed } = insideMeasure(page.root);
    return changed ? { ...page, root } : page;
  });
  const frame = site.frame ? insideMeasure(site.frame.root) : null;
  return {
    ...site,
    ...(pages ? { pages } : {}),
    ...(site.frame && frame?.changed ? { frame: { ...site.frame, root: frame.root } } : {}),
  };
}

/** The header the golden `sparx` design was captured with, and with it the 21 designs
 *  cloned from it and `piggles-starter`. A full-width bar: `px-6` and no measure at all,
 *  so on a wide screen its name sat at the far left while every band under it was
 *  centered. Matched on the WHOLE class string, the way the legal pair is matched on
 *  its hrefs: an author who restyled the bar keeps their bar. */
const CAPTURED_HEADER_CLASS =
  '@container flex items-center justify-between gap-6 border-b border-base-300 bg-base-100 px-6 py-4';

/** What the bar keeps once its content moves into the measure: the full-bleed edge and
 *  surface, and the container its children query. */
const HEADER_BAND_CLASS = '@container border-b border-base-300 bg-base-100';
/** The measure the bar's content moves into. The row layout and the vertical padding
 *  come with it, so the bar is the same height and lays out the same way. */
const HEADER_MEASURE_CLASS =
  'mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4';

function sameTokens(a: string | undefined, b: string): boolean {
  const left = tokens(a);
  const right = tokens(b);
  return left.length === right.length && right.every((token) => left.includes(token));
}

/** Is this the captured full-width header bar, exactly as the platform stamped it? */
export function isCapturedHeader(node: Node): node is Element {
  return isElement(node) && node.tag === 'nav' && sameTokens(node.class, CAPTURED_HEADER_CLASS);
}

/** Put the captured bar's content inside the house measure. Its children move into one
 *  new box and keep their order, ids and classes; the bar itself keeps its tag, its
 *  attributes and its id, so `aria-label="Primary"` and anything bound to the node are
 *  untouched. */
export function headerToInsideMeasure(nav: Element): Element {
  return {
    ...nav,
    class: HEADER_BAND_CLASS,
    children: [
      {
        kind: 'element',
        tag: 'div',
        class: HEADER_MEASURE_CLASS,
        children: nav.children ?? [],
      },
    ],
  };
}
