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
// DELIBERATELY NARROW. Each rule rewrites exactly one shape in exactly one place. These
// are dated repairs for known cohorts, not a general migration framework — they should be
// DELETED once the fleet has published through them. Before adding a rule, prefer making
// the thing LIVE (a host core) over healing it: the sorting rule is in `host-nodes.ts`.
// A heal earns its place only when the stale shape is already BROKEN on published sites,
// so making the thing live fixes the next tenant but leaves every existing one broken.
// Both rules here clear that bar:
//
//   1. The legacy text-only brand node — a logo upload that silently does nothing.
//   2. The hardcoded `/privacy-policy` + `/terms-of-service` footer links — two
//      guaranteed 404s on every site whose owner hasn't published those pages yet.

import type { Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS, hostCore } from './host-nodes';

/** silica's legacy brand primitive — a text-only `Wordmark` component node. */
const LEGACY_BRAND_COMPONENT = 'Wordmark';

/** The one `Node` member with children — every repair here walks or rebuilds one. */
type Element = Extract<Node, { kind: 'element' }>;

function isElement(node: Node): node is Element {
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

/** The exact hrefs the starter footer used to author. Matched LITERALLY: an author who
 *  repointed "Privacy" at a page of their own keeps their link — only the platform's own
 *  seeded pair is stale, and only the platform's own pair is the one that 404s. */
const SEEDED_LEGAL_HREFS = new Set(['/privacy-policy', '/terms-of-service']);

function isSeededLegalLink(node: Node): boolean {
  return (
    isElement(node) &&
    node.tag === 'a' &&
    typeof node.attrs?.href === 'string' &&
    SEEDED_LEGAL_HREFS.has(node.attrs.href)
  );
}

function hasHostCore(node: Node, key: string): boolean {
  if (node.kind === 'host' && node.component === key) return true;
  const children = isElement(node) ? (node.children ?? []) : [];
  return children.some((c) => typeof c !== 'string' && hasHostCore(c, key));
}

/** Swap the seeded legal anchors for the live `site.legal-links` core, wherever in the
 *  footer they sit.
 *
 *  The core takes the position of the FIRST one and the rest are dropped, so the links
 *  stay exactly where the author put them — inside whatever column already held them,
 *  in the same order relative to its other links. That is why it is authored with an
 *  EMPTY heading: it is joining a column that already has a title ("More"), and a second
 *  "Legal" heading nested inside it would be wrong. A fresh frame gets the headed
 *  version, because there it IS the column (`siteFooter`).
 *
 *  Recursive rather than scoped to a fixed depth: the pair was seeded inside a footer
 *  link column, but an author may have moved or re-nested that column, and the links are
 *  equally broken wherever they ended up. */
function upgradeLegalLinks(node: Node): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];

  const hasSeeded = children.some((c) => typeof c !== 'string' && isSeededLegalLink(c));
  if (hasSeeded) {
    const next: Node[] = [];
    let placed = false;
    for (const child of children) {
      if (typeof child !== 'string' && isSeededLegalLink(child)) {
        if (!placed) {
          placed = true;
          // Its own column so the links stack; `heading: ''` because the column it is
          // joining already has one.
          next.push(hostCore(HOST_KEYS.siteLegalLinks, 'flex flex-col gap-3', { heading: '' }));
        }
        continue;
      }
      next.push(child as Node);
    }
    return { ...node, children: next };
  }

  // Not at this level — recurse, rebuilding only the branch that actually changed so the
  // rest of the tree stays byte-identical.
  let changed = false;
  const next = children.map((child) => {
    if (typeof child === 'string' || changed) return child;
    const upgraded = upgradeLegalLinks(child);
    if (!upgraded) return child;
    changed = true;
    return upgraded;
  });
  return changed ? { ...node, children: next } : null;
}

/** Heal a stale frame. Pure — no DB, no IO — so it is safe to run on every studio load
 *  and trivial to test. `changed` lets the caller skip a pointless autosave.
 *
 *  Two independent repairs, each applied only if its own stale shape is present:
 *
 *   1. **Brand** — swap a legacy text-only brand node for the live `site.brand` core.
 *      Scoped to the frame's first `<nav>` on purpose: a `Wordmark` an author deliberately
 *      placed in the footer or mid-page is THEIR content, and rewriting it would be the
 *      platform overreaching. The header mark is the one the platform seeded and the one
 *      that is broken.
 *   2. **Legal links** — swap the seeded `/privacy-policy` + `/terms-of-service` anchors
 *      for the live `site.legal-links` core, scoped to the `<footer>` where they were
 *      seeded. Strictly better in both directions: a tenant who published those pages now
 *      gets EVERY legal document they published (cookie policy, returns…), and one who
 *      hasn't gets nothing instead of two 404s. */
export function upgradeFrameChrome(root: Node): { root: Node; changed: boolean } {
  if (!isElement(root)) return { root, changed: false };

  let next: Element = root;
  let changed = false;

  /** Rewrite the frame's first `<tag>` child through `repair`, or leave `next` alone
   *  (same object identity) when there is nothing to repair. */
  const healRegion = (tag: string, repair: (region: Element) => Node | null): void => {
    const children = next.children ?? [];
    const index = children.findIndex((c) => typeof c !== 'string' && isElement(c) && c.tag === tag);
    if (index === -1) return;
    const repaired = repair(children[index] as Element);
    if (!repaired) return;
    const swapped = [...children];
    swapped[index] = repaired;
    next = { ...next, children: swapped };
    changed = true;
  };

  // Idempotent, and a no-op for anyone who already dragged the core in by hand.
  if (!alreadyHasBrandCore(next)) healRegion('nav', upgradeNav);
  if (!hasHostCore(next, HOST_KEYS.siteLegalLinks)) healRegion('footer', upgradeLegalLinks);

  return { root: next, changed };
}
