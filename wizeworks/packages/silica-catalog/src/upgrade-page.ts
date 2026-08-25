// Upgrade-on-read for a STALE stored PAGE BODY (docs/122) — the sibling of
// `upgrade-frame.ts`, and it exists for the same reason.
//
// THE PROBLEM. A page body is a stamped node tree: the catalog factory runs once, at
// insert, and the result is frozen. Fixing the factory therefore fixes the NEXT tenant
// and no existing one. That is the correct trade for a published tree — an author's page
// must not change under them — but it has a consequence nobody sees until they look: a
// bug the platform shipped in a factory lives on every page stamped from it, forever, and
// the tenant has no way to know and no realistic way to fix it by hand.
//
// This was found by reading a real tenant's stored Home page. It carried
// `flex flex-col gap-1.5 p-4` on every product card — a class the declared vocabulary has
// no step for, so it compiles to NOTHING and the card's internal spacing silently
// collapses to zero. The factory was corrected to `gap-2` months of commits ago. Every
// page stamped before that is still wrong, on the live site, today.
//
// WHY IT IS SAFE TO REWRITE SOMEONE'S TREE. Same contract as the frame heal: it runs on
// the DRAFT at studio load, never on the published tree, so nothing changes for a visitor
// until the tenant publishes themselves. The healed tree persists on the next save, so the
// stored data self-corrects after one edit.
//
// THE BAR, AND IT IS DELIBERATELY HIGH. A repair belongs here only when ALL of:
//
//   1. the stale shape is ALREADY BROKEN on published sites (not merely dated, not
//      merely different from what the factory emits today) — otherwise "improving" a
//      tenant's page is the platform overreaching on work it does not own;
//   2. the PLATFORM stamped it, not the author. `gap-1.5` was never a choice anyone
//      made; it came out of our factory. A class the author typed is theirs, even if we
//      would not have typed it;
//   3. the correct replacement is KNOWN, not guessed.
//
// Point 3 is why this is an explicit table and not a generic "snap every out-of-range
// class to its nearest declared step". `checkClassString` will happily report that the
// nearest step to `gap-1.5` is `gap-1` — but the factory was actually fixed to `gap-2`,
// so the generic repair would restore an approximation of the design instead of the
// design. And the generic version would also touch classes that are NOT broken: a
// viewport variant renders correctly on the published page (only the preview is wrong),
// and an arbitrary value like `w-[347px]` has no safe replacement at all, so dropping it
// would move a layout the author positioned deliberately. Both stay as lint findings,
// where an author can decide, which is the right place for them.
//
// These are dated repairs for known cohorts. DELETE a rule once the fleet has published
// through it.

import type { Node } from '@wizeworks/silicaui-html';

/**
 * Dead classes the PLATFORM stamped, mapped to what its factory emits now.
 *
 * Keyed by the exact stale token. The value is the corrected token from the factory —
 * not the vocabulary's nearest neighbour — so a heal restores the intended design rather
 * than the closest legal thing to the broken one.
 *
 * `gap-1.5` (added 2026-07-29): the product card's inner spacing, stamped by
 * `productCardNode` before the half-step was caught. The declared scale has no half
 * steps, so it emits no CSS and the card renders with its title flush against its price.
 */
const DEAD_CLASS_REPAIRS: Readonly<Record<string, string>> = {
  'gap-1.5': 'gap-2',
};

/** The one `Node` member with children — every repair walks or rebuilds one. */
type Element = Extract<Node, { kind: 'element' }>;

function isElement(node: Node): node is Element {
  return node.kind === 'element';
}

/* ── The featured strip: a carousel that could only ever show one ──────────── */

/** Every class token on a node and its descendants. */
function hasClassToken(node: Node, token: string): boolean {
  if (node.kind === 'outlet') return false;
  if ((node.class ?? '').split(/\s+/).includes(token)) return true;
  const children = (node as Element).children;
  if (!Array.isArray(children)) return false;
  return children.some((child) => typeof child !== 'string' && hasClassToken(child, token));
}

function swapClass(cls: string, drop: readonly string[], add: readonly string[]): string {
  const kept = cls
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !drop.includes(token));
  return [...kept, ...add.filter((token) => !kept.includes(token))].join(' ');
}

/** The dead per-view ladder, plus the class that made it dead. */
const SLIDE_DROP = ['carousel-item', 'basis-full', '@2xl:basis-1/3', '@4xl:basis-1/4', 'w-full'];

/**
 * Rewrite one stamped product carousel into the scroll-strip it should always have been.
 *
 * WHY THIS CLEARS THE BAR ABOVE. It is broken on published sites, not merely dated:
 * silica's `carousel` shows exactly ONE slide per view, so a "Featured" strip under a
 * product renders a single full-width card — bigger than the product the page exists to
 * sell — and the `basis-full @2xl:basis-1/3 @4xl:basis-1/4` ladder the platform stamped
 * beside it never applied at any width. The platform stamped all of it, and the
 * replacement is exactly what `commerce.ts` emits today.
 *
 * Recognised by the `carousel-item` PRODUCT CARD, not by the behavior alone: a hero
 * carousel an author built by hand is theirs, one slide at a time is what it is for, and
 * this must not touch it.
 */
function repairProductStrip(node: Element): Element {
  const track = (child: Node): Node => {
    if (child.kind === 'outlet' || !isElement(child)) return child;
    if (child.part === 'track') {
      // The old track was the repeat container AND the scrolling box. They separate: the
      // row keeps the collection binding and its children, the track wraps it, and the
      // strip wraps that.
      const row: Element = { ...child, class: 'flex w-max gap-6 mx-auto' };
      delete row.part;
      return {
        kind: 'element',
        tag: 'div',
        class: 'scroll-strip',
        children: [
          {
            kind: 'element',
            tag: 'div',
            class: 'scroll-strip-track',
            part: 'track',
            children: [row],
          },
        ],
      };
    }
    if (child.part === 'prev' || child.part === 'next') {
      // `btn-neutral btn-outline` goes with it: a grey nobody approved (root RULE #4),
      // on a control that carries no meaning for a color to hold. The factory stopped
      // emitting it, and a bare `.btn` resolves its ink from `base-content` in both
      // themes without naming one.
      return {
        ...child,
        class: swapClass(
          child.class ?? '',
          ['btn-neutral', 'btn-outline'],
          ['scroll-strip-control']
        ),
      };
    }
    const kids = child.children;
    if (!Array.isArray(kids)) return child;
    return { ...child, children: kids.map((k) => (typeof k === 'string' ? k : track(k))) };
  };

  const slides = (child: Node): Node => {
    if (child.kind === 'outlet') return child;
    const cls = child.class ?? '';
    const next = cls.split(/\s+/).includes('carousel-item')
      ? { ...child, class: swapClass(cls, SLIDE_DROP, ['w-64', 'shrink-0']) }
      : child;
    const kids = (next as Element).children;
    if (!Array.isArray(kids)) return next;
    return { ...next, children: kids.map((k) => (typeof k === 'string' ? k : slides(k))) };
  };

  const repaired = track(slides({ ...node, behavior: { type: 'scroll-strip' } }) as Element);
  return repaired as Element;
}

/**
 * Repair one class string, preserving order and every token that is not in the table.
 *
 * Container/viewport PREFIXES are honoured (`@2xl:gap-1.5` heals to `@2xl:gap-2`): the
 * variant is not what is broken, the step is, and a prefixed dead class is exactly as
 * dead as a bare one. Returns `null` when nothing changed, so callers can keep object
 * identity and skip a pointless save.
 */
export function repairDeadClasses(cls: string): string | null {
  if (!cls) return null;
  let changed = false;
  const healed = cls
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      // Split a variant prefix off the tail: `@2xl:hover:gap-1.5` → `@2xl:hover:` + `gap-1.5`.
      const at = token.lastIndexOf(':');
      const prefix = at === -1 ? '' : token.slice(0, at + 1);
      const bare = at === -1 ? token : token.slice(at + 1);
      const fixed = DEAD_CLASS_REPAIRS[bare];
      if (!fixed) return token;
      changed = true;
      return `${prefix}${fixed}`;
    })
    .join(' ');
  return changed ? healed : null;
}

/**
 * Heal a stale page body. Pure — no DB, no IO — so it is safe on every studio load and
 * trivial to test. `changed` lets the caller skip a save that would do nothing.
 *
 * Walks the whole tree rather than a named region (the frame heal scopes to `<nav>` and
 * `<footer>` because those repairs are about WHERE the platform seeded something). A dead
 * class is broken wherever it sits, and the author never chose it anywhere, so there is no
 * region to respect.
 *
 * Untouched nodes keep their identity — an unchanged subtree is returned as the same
 * object — so a page with nothing to repair costs one walk and allocates nothing.
 */
export function upgradePageBody(root: Node): { root: Node; changed: boolean } {
  let changed = false;

  const visit = (node: Node): Node => {
    if (!isElement(node) && node.kind !== 'component') return node;

    let next = node;

    // Before the class walk, because it rewrites the subtree the class walk would
    // otherwise descend into (and the classes it leaves behind are already correct).
    if (
      isElement(next) &&
      next.behavior?.type === 'carousel' &&
      hasClassToken(next, 'carousel-item')
    ) {
      next = repairProductStrip(next);
      changed = true;
    }

    const healedClass = node.class ? repairDeadClasses(node.class) : null;
    if (healedClass !== null) {
      next = { ...next, class: healedClass };
      changed = true;
    }

    const children = (next as Element).children;
    if (Array.isArray(children)) {
      let childChanged = false;
      const healedKids = children.map((child) => {
        if (typeof child === 'string') return child;
        const healed = visit(child);
        if (healed !== child) childChanged = true;
        return healed;
      });
      if (childChanged) next = { ...next, children: healedKids };
    }

    return next;
  };

  const healed = visit(root);
  return { root: healed, changed };
}
