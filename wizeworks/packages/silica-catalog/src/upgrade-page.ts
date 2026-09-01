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

  const repaired = track(slides({ ...node, behavior: { type: 'scroll-strip' } }));
  return repaired as Element;
}

/* ── The product hero: the page's LCP image, loaded last ───────────────────── */

/**
 * Turn the stamped product-detail hero into an EAGER raw `<img>`.
 *
 * WHY THIS CLEARS THE BAR ABOVE. Broken on published sites, not merely dated: this is
 * the largest element above the fold on a shop's highest-traffic page, so it IS the
 * Largest Contentful Paint — and silicaui's `Image` atom hardcodes `loading="lazy"`,
 * which defers the request until layout has run. The platform stamped it (no author
 * picks an atom), and the replacement is exactly what `commerce.ts` emits today.
 *
 * It has to become an ELEMENT rather than keep the atom with a prop, because the atom
 * builds `loading` itself and IGNORES a `loading` prop without a word — probed against
 * silicaui 0.55.0, where `loading`, `eager` and `priority` all come out `lazy`.
 *
 * RECOGNISED BY `rounded-box`, and that was measured rather than assumed. The card
 * grids on the same page bind `image` with the same alt text, so the binding cannot
 * tell them apart; the hero is the only one the factory gives a radius, because a card
 * clips its own. Across every stored product tree in the fleet: eleven carry exactly
 * one such image, one carries one an author added a border to (still the hero, still
 * matched), one had the radius removed by an author and is left alone, and one has no
 * images at all. No tree anywhere has two — so this cannot reach a card.
 */
function repairProductHero(node: Extract<Node, { kind: 'component' }>): Element {
  const props = node.props ?? {};
  const src = typeof props.src === 'string' ? props.src : '';
  const alt = typeof props.alt === 'string' ? props.alt : '';
  const { id, ord, label, data, slot, locked, class: cls } = node;
  const img: Element = {
    kind: 'element',
    tag: 'img',
    ...(id === undefined ? {} : { id }),
    ...(ord === undefined ? {} : { ord }),
    ...(label === undefined ? {} : { label }),
    ...(data === undefined ? {} : { data }),
    ...(slot === undefined ? {} : { slot }),
    ...(locked === undefined ? {} : { locked }),
    ...(cls === undefined ? {} : { class: cls }),
    attrs: { src, alt, loading: 'eager' },
  };
  return img;
}

/** The hero, and nothing else: an `Image` atom carrying a value binding and the radius
 *  only the hero is given. A card has the binding and not the radius; a decorative
 *  image an author dropped in has the radius and not the binding. */
function isProductHero(node: Node): node is Extract<Node, { kind: 'component' }> {
  return (
    node.kind === 'component' &&
    node.component === 'Image' &&
    node.data?.kind === 'value' &&
    (node.class ?? '').split(/\s+/).includes('rounded-box')
  );
}

/* ── The form that thanked people for messages it threw away ────────────── */

/**
 * Every form in the section kit shipped the host action ref `'submit'`, which the
 * storefront routes NOWHERE (issue 350). The failure is silent by construction: the
 * form behavior hands the ref to the host's `onAction`, an unrecognised ref falls
 * through every branch and returns, the promise resolves, and the behavior settles the
 * form to `success` — so a visitor's enquiry is discarded and the page thanks them
 * for it. Nothing is logged and nothing is stored.
 *
 * Added 2026-08-30. Measured before it was written: **29 stored pages carry it, 11 of
 * them published and live**, across 29 different sites, and every one is a contact or
 * enquiry page. Against the bar above — broken on published sites (a live shop's
 * contact form is a black hole), the platform stamped it (`convert.ts`'s `form()`
 * helper, no author ever typed an action ref), and the replacement is known (exactly
 * what that helper emits now).
 */
const DEAD_FORM_ACTION = 'submit';

/** A form the platform stamped with the dead ref. Both marks are required: the
 *  `form` BEHAVIOR is what does the client-side submit, and the ACTION is what points
 *  it at a host — a node carrying only one of them is not a live form and is not this
 *  bug. */
function hasDeadFormAction(node: Node): node is Element {
  return (
    node.kind === 'element' &&
    node.tag === 'form' &&
    node.behavior?.type === 'form' &&
    node.data?.kind === 'action' &&
    node.data.ref === DEAD_FORM_ACTION
  );
}

/** Every `name` on a control inside this form. */
function controlNames(node: Node, out: string[] = []): string[] {
  if (node.kind !== 'element' && node.kind !== 'component') return out;
  if (node.kind === 'element' && ['input', 'textarea', 'select'].includes(node.tag)) {
    const name = node.attrs?.name;
    if (typeof name === 'string' && name) out.push(name);
  }
  for (const child of node.children ?? []) {
    if (typeof child !== 'string') controlNames(child, out);
  }
  return out;
}

/**
 * Where this form should have been going.
 *
 * Decided by what the form ASKS FOR, which is the only thing in a stored tree that
 * still says what it is for: a form whose single question is an email address is a
 * sign-up and belongs on the email list; anything that also asks a name, a phone
 * number or a message is somebody writing TO the business and belongs in the
 * submissions inbox. That split reproduces exactly what the factory emits now —
 * `newsletterSignup()` is the one form on the shelf with a lone `email` field.
 *
 * The fallback is `contact` on purpose. Filing a sign-up as an enquiry puts a real
 * address in front of a real person, who can act on it; routing an enquiry to the
 * mailing list drops a customer's question and subscribes them instead.
 */
function intendedFormAction(form: Element): 'contact' | 'email-signup' {
  const names = controlNames(form);
  return names.length === 1 && names[0] === 'email' ? 'email-signup' : 'contact';
}

/** What the visitor is told when it works, per destination. The stored tree carries no
 *  record of which of the four shelf forms it was stamped from, so these are the two
 *  sentences that are true of every one of them rather than the four specific ones the
 *  factory emits today. Both beat the behavior's built-in "Submitted.", which tells a
 *  person nothing about whether their question reached anybody. */
const HEALED_SUCCESS: Readonly<Record<'contact' | 'email-signup', string>> = {
  contact: 'Thank you. Your message is with us and we will get back to you.',
  'email-signup': 'Thank you. You are on the list.',
};

/** Does this form already author its own status part? The behavior takes the FIRST
 *  one it finds, so adding a second would be dead markup, and an author who placed one
 *  deliberately owns where it sits. */
function hasStatusPart(node: Node): boolean {
  if (node.kind !== 'element' && node.kind !== 'component') return false;
  if (node.kind === 'element' && node.attrs?.['data-sui-part'] === 'status') return true;
  return (node.children ?? []).some((c) => typeof c !== 'string' && hasStatusPart(c));
}

/**
 * Repair a stamped form: route it somewhere real, and give it a way to say so.
 *
 * The ref is the half that loses the message; the status line is the half that loses
 * the VISITOR, who pressed Send, saw nothing change and their own text still in the
 * boxes, and sent the same question twice more (issue 351). Healing only the ref would
 * fix the owner's inbox and leave the customer exactly as confused, so both go
 * together.
 *
 * The appended paragraph is `empty:hidden` and the behavior only writes into it on a
 * settle, so a repaired form is pixel-identical until somebody submits it.
 */
function repairFormAction(form: Element): Element {
  const ref = intendedFormAction(form);
  const attrs = { ...(form.attrs ?? {}) };
  attrs['data-success-message'] ??= HEALED_SUCCESS[ref];

  const children = [...(form.children ?? [])];
  if (!hasStatusPart(form)) {
    children.push({
      kind: 'element',
      tag: 'p',
      class: 'text-base text-base-content empty:hidden',
      attrs: { 'data-sui-part': 'status', 'aria-live': 'polite' },
    });
  }

  return { ...form, data: { kind: 'action', ref }, attrs, children };
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

    if (isProductHero(next)) {
      next = repairProductHero(next);
      changed = true;
    }

    if (hasDeadFormAction(next)) {
      next = repairFormAction(next);
      changed = true;
    }

    const healedClass = node.class ? repairDeadClasses(node.class) : null;
    if (healedClass !== null) {
      next = { ...next, class: healedClass };
      changed = true;
    }

    const children = next.children;
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
