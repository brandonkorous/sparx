// Upgrade-on-read for a STALE stored frame (docs/122).
//
// THE PROBLEM THIS EXISTS FOR. A frame is a stamped node tree: copied at insert, frozen
// at publish. Improving the composite that produced it never reaches a tenant who has
// already published (docs/122 "Key facts"). Tenants who published before silica's
// `Wordmark` could carry a logo therefore have a TEXT-ONLY brand node in their header,
// forever — uploading a logo in Site settings changes nothing, because the stored tree
// says "render this text". There is no way for them to discover why, and the manual fix
// (find the node in the studio, drag in the brand core, delete the old one) is not
// something the non-technical business owner this platform is for will ever do.
//
// `siteNavbar()` now seeds the `site.brand` HOST core, which is immune to this by
// construction — but only for trees stamped AFTER it landed. This heals the ones before.
//
// WHY IT IS SAFE TO REWRITE SOMEONE'S TREE. It runs on the DRAFT at studio load, never
// on the published tree, so nothing changes for visitors until the tenant publishes
// themselves. The precedent is `ensureUniqueIds`, applied on the same path: "the healed
// ids persist on the next autosave, so the stored data self-corrects after one edit."
// The clobber guard (`wouldClobberSite`) compares PAGE ids and the frame lives on
// `builder_layout` — a frame heal changes no page ids, so it cannot trip it.
//
// DELIBERATELY NARROW. It rewrites exactly one shape in exactly one place: the legacy
// brand node at the head of the frame's <nav>. It is a dated repair for a known cohort,
// not a general migration framework — and it should be DELETED once the fleet has
// published through it. If you are here to add a second rule, prefer making the thing
// live (a host core) over healing it: the sorting rule is in `host-nodes.ts`.

import type { Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS, hostCore } from './host-nodes';

/** silica's legacy brand primitive — a text-only `Wordmark` component node. */
const LEGACY_BRAND_COMPONENT = 'Wordmark';

function isElement(node: Node): node is Extract<Node, { kind: 'element' }> {
  return node.kind === 'element';
}

/** The legacy brand node: a `Wordmark` COMPONENT node, whatever it is bound to.
 *
 *  Matched on the component alone rather than on its binding or props: the shape drifted
 *  across versions (a bare bound span; later a `Wordmark` wrapping a bound Image + name),
 *  and every variant is equally stale — they are all stamped markup pretending to be the
 *  tenant's live identity. */
function isLegacyBrand(node: Node): boolean {
  return node.kind === 'component' && node.component === LEGACY_BRAND_COMPONENT;
}

function alreadyHasBrandCore(node: Node): boolean {
  if (node.kind === 'host' && node.component === HOST_KEYS.siteBrand) return true;
  const children = isElement(node) ? (node.children ?? []) : [];
  return children.some((c) => typeof c !== 'string' && alreadyHasBrandCore(c));
}

/** Replace the legacy brand node inside the frame's FIRST `<nav>`, preserving the
 *  author's wrapper class so a restyled mark keeps its styling. Returns null when there
 *  is nothing to do, so the caller can leave the tree byte-identical. */
function upgradeNav(nav: Extract<Node, { kind: 'element' }>): Node | null {
  const children = nav.children ?? [];
  const index = children.findIndex((c) => typeof c !== 'string' && isLegacyBrand(c));
  if (index === -1) return null;

  const legacy = children[index] as Extract<Node, { kind: 'component' }>;
  // Keep the author's classes: they may have restyled the mark (size, spacing,
  // alignment), and healing must not read as "the platform reset my header".
  const next = hostCore(HOST_KEYS.siteBrand, legacy.class);
  const upgraded = [...children];
  upgraded[index] = next;
  return { ...nav, children: upgraded };
}

/** Heal a stale frame: swap a legacy text-only brand node for the live `site.brand`
 *  core. Pure — no DB, no IO — so it is safe to run on every studio load and trivial to
 *  test. `changed` lets the caller skip a pointless autosave.
 *
 *  Scoped to the frame's first `<nav>` on purpose: a `Wordmark` an author deliberately
 *  placed in the footer or mid-page is THEIR content, and rewriting it would be the
 *  platform overreaching. The header mark is the one the platform seeded and the one
 *  that is broken. */
export function upgradeFrameChrome(root: Node): { root: Node; changed: boolean } {
  if (!isElement(root)) return { root, changed: false };
  // Idempotent, and a no-op for anyone who already dragged the core in by hand.
  if (alreadyHasBrandCore(root)) return { root, changed: false };

  const children = root.children ?? [];
  const navIndex = children.findIndex(
    (c) => typeof c !== 'string' && isElement(c) && c.tag === 'nav'
  );
  if (navIndex === -1) return { root, changed: false };

  const upgradedNav = upgradeNav(children[navIndex] as Extract<Node, { kind: 'element' }>);
  if (!upgradedNav) return { root, changed: false };

  const next = [...children];
  next[navIndex] = upgradedNav;
  return { root: { ...root, children: next }, changed: true };
}
