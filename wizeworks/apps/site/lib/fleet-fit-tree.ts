// "Fits your fleet" on the pages a tenant builds with the site builder (sparx
// persona issue 086).
//
// A tenant's home page and landing pages are published silica trees, and every
// product card in them was stamped from the catalog factory before fleets existed:
// image, name, price, and a "Sold out" chip. The signed-in buyer's own price
// already reaches those cards without any change to the tree, because it rides the
// `price` the card has always bound. A fit badge needs a node the stamped card does
// not have, so this adds it at render, the way `buying-rules-tree.ts` adjusts the
// buy box: nothing to republish, and every page already live picks it up.
//
// THE CARD BADGES ARE GATED, NOT LITERAL. One card template repeats over every
// product, so the badge is a pair of nodes shown on the record's `fitsFleet` /
// `notForFleet`, which `toSilicaProduct` puts on EVERY product record (undefined
// unless this buyer's fleet says otherwise). Every record carrying both keys is what
// keeps the badges hidden for everyone else: the silica resolver treats a key that
// is missing from the record as UNKNOWN and keeps the authored node, which would
// print "Fits your fleet" under every product in the shop.
//
// THE PRODUCT PAGE NOTICE IS LITERAL. One product, one buyer, one request (a
// signed-in read is never cached), so the sentence is written straight in.

import type { FleetFit } from '@wizeworks/commerce-schemas';

import { fleetFitNotice } from './fleet-fit-words';

/** The record keys a product card's badges hang on. */
export const FITS_FLEET_REF = 'fitsFleet';
export const NOT_FOR_FLEET_REF = 'notForFleet';

/** The two badge keys for one product record: `true` on the one that applies,
 *  `undefined` otherwise (never left off; see the header). */
export function fleetFitRecordFields(fit: FleetFit | null | undefined): {
  fitsFleet: true | undefined;
  notForFleet: true | undefined;
} {
  return {
    fitsFleet: fit?.fits ? true : undefined,
    notForFleet: fit && !fit.fits ? true : undefined,
  };
}

type Attrs = Record<string, string | number | boolean>;
interface TreeNode {
  kind?: string;
  tag?: string;
  class?: string;
  attrs?: Attrs;
  children?: (TreeNode | string)[];
  data?: { kind?: string; ref?: string; negate?: boolean };
}

function isVisibleOn(node: TreeNode | string, ref: string): boolean {
  return (
    typeof node !== 'string' &&
    node.data?.kind === 'visible' &&
    node.data.ref === ref &&
    !node.data.negate
  );
}

/** A stamped product card's body: it holds the card's "Sold out" chip directly. */
function isProductCardBody(node: TreeNode): boolean {
  return (node.children ?? []).some(
    (c) =>
      typeof c !== 'string' && c.kind === 'element' && c.tag === 'span' && isVisibleOn(c, 'soldOut')
  );
}

function hasFleetBadges(node: TreeNode): boolean {
  return (node.children ?? []).some(
    (c) => isVisibleOn(c, FITS_FLEET_REF) || isVisibleOn(c, NOT_FOR_FLEET_REF)
  );
}

/** The two badges a card gets. The shop's own theme colors them. */
export function fleetFitBadgeNodes(): TreeNode[] {
  return [
    {
      kind: 'element',
      tag: 'span',
      class:
        'inline-flex w-fit items-center rounded-field bg-success px-3 py-1 text-sm font-semibold text-success-content',
      children: ['Fits your fleet'],
      data: { kind: 'visible', ref: FITS_FLEET_REF },
    },
    {
      kind: 'element',
      tag: 'span',
      class:
        'inline-flex w-fit items-center rounded-field border border-warning px-3 py-1 text-sm font-semibold text-base-content',
      children: ['Does not fit your fleet'],
      data: { kind: 'visible', ref: NOT_FOR_FLEET_REF },
    },
  ];
}

function addCardBadges(node: TreeNode): TreeNode {
  let next = node;
  if (isProductCardBody(node) && !hasFleetBadges(node)) {
    next = { ...node, children: [...(node.children ?? []), ...fleetFitBadgeNodes()] };
  }
  if (!next.children) return next;
  let changed = false;
  const children = next.children.map((c) => {
    if (typeof c === 'string') return c;
    const healed = addCardBadges(c);
    if (healed !== c) changed = true;
    return healed;
  });
  return changed ? { ...next, children } : next;
}

/** A published tree (and its symbols) with fleet badges on every product card.
 *  Returns the SAME object when there is no product card in it. */
export function withFleetBadges<
  T extends { root: unknown; symbols?: Record<string, { root: unknown }> },
>(page: T): T {
  const root = addCardBadges(page.root as TreeNode);
  let symbolsChanged = false;
  const symbols = page.symbols
    ? Object.fromEntries(
        Object.entries(page.symbols).map(([key, def]) => {
          const healed = addCardBadges(def.root as TreeNode);
          if (healed !== def.root) symbolsChanged = true;
          return [key, healed === def.root ? def : { ...def, root: healed }];
        })
      )
    : undefined;
  if (root === page.root && !symbolsChanged) return page;
  return { ...page, root, ...(symbolsChanged && symbols ? { symbols } : {}) };
}

/** The action refs a buy box form carries. */
const BUY_ACTIONS = new Set(['add-to-cart', 'buy-now']);

function isBuyForm(node: TreeNode): boolean {
  return (
    node.kind === 'element' &&
    node.tag === 'form' &&
    node.data?.kind === 'action' &&
    BUY_ACTIONS.has(node.data.ref ?? '')
  );
}

function noticeNode(fit: FleetFit): TreeNode | null {
  const notice = fleetFitNotice(fit);
  if (!notice) return null;
  // Whole class names, so the stylesheet build finds them.
  return {
    kind: 'element',
    tag: 'div',
    class:
      notice.color === 'success'
        ? 'rounded-box bg-success p-3 text-base text-success-content'
        : 'rounded-box bg-warning p-3 text-base text-warning-content',
    attrs: { role: 'status' },
    children: [notice.text],
  };
}

/** Put the notice straight before the FIRST buy form, once. */
function insertNotice(node: TreeNode, notice: TreeNode, done: { value: boolean }): TreeNode {
  if (done.value || !node.children) return node;
  let changed = false;
  const out: (TreeNode | string)[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') {
      out.push(child);
      continue;
    }
    if (!done.value && isBuyForm(child)) {
      out.push(notice, child);
      done.value = true;
      changed = true;
      continue;
    }
    const next = insertNotice(child, notice, done);
    if (next !== child) changed = true;
    out.push(next);
  }
  return changed ? { ...node, children: out } : node;
}

/**
 * The product page template with this buyer's fleet notice before the buy button:
 * which of their vehicles the product fits, or that it fits none of them (they can
 * still buy it). The SAME object when there is nothing to say, which includes every
 * visitor without a fleet and every product with no fitment data.
 */
export function withFleetNotice<
  T extends { root: unknown; symbols?: Record<string, { root: unknown }> },
>(template: T, fit: FleetFit | null | undefined): T {
  if (!fit) return template;
  const notice = noticeNode(fit);
  if (!notice) return template;
  const done = { value: false };
  const root = insertNotice(template.root as TreeNode, notice, done);
  if (done.value) return { ...template, root };
  // A buy box saved as a reusable part lives in the symbols instead.
  if (!template.symbols) return template;
  const symbols: Record<string, { root: unknown }> = {};
  for (const [key, def] of Object.entries(template.symbols)) {
    symbols[key] = done.value
      ? def
      : { ...def, root: insertNotice(def.root as TreeNode, notice, done) };
  }
  return done.value ? { ...template, symbols: symbols } : template;
}
