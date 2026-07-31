// The broken-link check.
//
// THE FAILURE THIS EXISTS FOR. A link is the one thing on a page whose brokenness is
// completely invisible to the person who made it. Nothing renders differently, the
// canvas shows no warning, and the author never clicks their own navigation — so a
// `/about-us` that should have been `/about` ships, and the first person to find out
// is a visitor who leaves. Every comparable builder has this hole; a site is
// published, and only a crawler weeks later says anything.
//
// WHAT IS PROVABLE. Only internal destinations. An external URL cannot be checked
// without a network call, which would make this engine impure, slow, and wrong the
// moment a site is behind a login — so `https://` links pass untouched. Everything
// else divides cleanly: an in-page `#anchor` is checkable against the ids in the
// composed document, a `/path` against the page roster, and `/products/<handle>`
// against the handles the caller supplied.

import type { DocumentInventory, VisitedNode } from './walk';
import { attr, bindsAttr, isElement, prop, typeOf } from './walk';
import type { RawFinding } from './finding';
import type { LinkTargets } from './types';
import {
  BUILTIN_PATHS,
  DYNAMIC_ROUTES,
  inOpenSubtree,
  normalizePath,
  resolveRelative,
} from './routes';

/** What kind of destination an href names. */
export type HrefKind =
  /** Somewhere on this site. */
  | 'internal'
  /** Another site — unverifiable here, by design. */
  | 'external'
  /** `#section` — checkable against the ids in this document. */
  | 'anchor'
  /** `mailto:` / `tel:` / anything else with a scheme. */
  | 'scheme'
  /** `#`, `javascript:void(0)`, or empty — a link that goes nowhere at all. */
  | 'nowhere';

export interface ClassifiedHref {
  kind: HrefKind;
  /** For `internal`: the normalized path. For `anchor`: the id, without the `#`.
   *  For `scheme`: the part after the colon. */
  value: string;
}

/**
 * Classify one authored href.
 *
 * `fromPath` is the page the link was authored on, needed only to resolve a relative
 * href the way a browser would. Pass null on a collection template — its path is a
 * pattern, not a location, so a relative href there has no single answer and is
 * treated as unverifiable rather than guessed at.
 */
export function classifyHref(raw: string, fromPath: string | null): ClassifiedHref {
  const href = raw.trim();
  if (!href || href === '#') return { kind: 'nowhere', value: href };
  if (/^javascript:/i.test(href)) return { kind: 'nowhere', value: href };
  if (href.startsWith('#')) return { kind: 'anchor', value: href.slice(1) };
  // Protocol-relative (`//cdn.example.com/x`) is another host, not a root path.
  if (href.startsWith('//')) return { kind: 'external', value: href };
  if (href.startsWith('/')) return { kind: 'internal', value: normalizePath(href) };

  const scheme = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(href);
  if (scheme) {
    const name = scheme[1]!.toLowerCase();
    if (name === 'http' || name === 'https') return { kind: 'external', value: href };
    return { kind: 'scheme', value: `${name}:${scheme[2] ?? ''}` };
  }

  if (fromPath === null) return { kind: 'external', value: href };
  return { kind: 'internal', value: resolveRelative(href, fromPath) };
}

/** The rosters, resolved once per lint run rather than per link. */
export interface ResolvedTargets {
  /** Every bare path known to resolve, or null when the caller did not say — in
   *  which case bare paths are not checked at all (see `LinkTargets.paths`). */
  paths: Set<string> | null;
  handles: Partial<Record<(typeof DYNAMIC_ROUTES)[number]['roster'], Set<string>>>;
}

/** Build the comparison sets: the storefront's built-in routes, the pages being
 *  linted, and whatever else the caller supplied. */
export function resolveTargets(
  pageSlugs: readonly string[],
  targets: LinkTargets | undefined
): ResolvedTargets {
  const handles: ResolvedTargets['handles'] = {};
  for (const route of DYNAMIC_ROUTES) {
    const roster = targets?.[route.roster];
    if (roster) handles[route.roster] = new Set(roster.map((h) => h.trim()).filter(Boolean));
  }

  if (!targets?.paths) return { paths: null, handles };

  const paths = new Set<string>(BUILTIN_PATHS);
  for (const slug of pageSlugs) paths.add(normalizePath(slug));
  for (const extra of targets.paths) paths.add(normalizePath(extra));
  return { paths, handles };
}

/** Why an internal path does not resolve — or null when it does, or cannot be
 *  judged. The `noun` names what is missing so the finding can say "product" rather
 *  than repeating the URL back at the owner. */
export interface BrokenPath {
  path: string;
  /** `'page'` for a bare path; the record noun for a parameterized route. */
  noun: string;
}

export function checkInternalPath(path: string, targets: ResolvedTargets): BrokenPath | null {
  if (path === '/' || inOpenSubtree(path)) return null;

  for (const route of DYNAMIC_ROUTES) {
    if (!path.startsWith(route.prefix)) continue;
    const rest = path.slice(route.prefix.length);
    // `/products/a/b` matches no route: the record routes are exactly one segment
    // deep. That is broken regardless of what the roster holds.
    if (rest.includes('/')) return { path, noun: route.noun };
    const roster = targets.handles[route.roster];
    // No roster means the caller did not tell us what exists — see `LinkTargets`.
    if (!roster) return null;
    return roster.has(rest) ? null : { path, noun: route.noun };
  }

  if (!targets.paths) return null;
  return targets.paths.has(path) ? null : { path, noun: 'page' };
}

/* ── Finding the links in a document ────────────────────────────────────────── */

/** One authored destination found on a node, with everything needed to judge it. */
export interface FoundLink {
  visited: VisitedNode;
  href: string;
  /** True when this node is a real link/button rather than, say, a `<link>` tag —
   *  used to word the finding as "link" or "button". */
  isButton: boolean;
}

const LINK_COMPONENTS = new Set(['button', 'link', 'navlink', 'anchor']);

/**
 * A `<Button>` that acts on its FORM rather than going anywhere.
 *
 * `type="submit"` / `type="reset"` is the whole contract of a form's own button: it
 * sends or clears the fields it sits in, and having no destination is correct, not a
 * defect. Without this, every contact form on the platform reported "This button
 * doesn't go anywhere" against a Send button that works perfectly — and the fix the
 * finding suggests (open it and choose a page) would break it. Caught on the shipped
 * `sparx` blueprint, where it fired once per blueprint × 21 blueprints.
 *
 * Deliberately narrow: only the two types the HTML spec gives a non-navigating
 * meaning. A button with no `type` at all still reports, because a bare
 * `<Button>Learn more</Button>` outside a form really does do nothing.
 */
function isFormControl(node: VisitedNode['node']): boolean {
  const type = prop(node, 'type').toLowerCase();
  return type === 'submit' || type === 'reset';
}

/**
 * Every authored destination in the document.
 *
 * Two carriers: an `<a>` element holds it in `attrs.href`, and a silica atom
 * (`Button`, `Link`) holds it in `props.href`. A node whose href is filled by a data
 * binding is skipped — its destination is a record's, resolved at render, and the
 * authored value is empty by design.
 */
export function findLinks(nodes: readonly VisitedNode[]): FoundLink[] {
  const found: FoundLink[] = [];
  for (const visited of nodes) {
    const { node } = visited;
    const type = typeOf(node).toLowerCase();
    const isAnchor = isElement(node) && type === 'a';
    const isAtom = node.kind === 'component' && LINK_COMPONENTS.has(type);
    if (!isAnchor && !isAtom) continue;
    if (bindsAttr(node, 'href')) continue;
    if (isAtom && isFormControl(node)) continue;

    const href = isAnchor ? attr(node, 'href') : prop(node, 'href');
    // An `<a>` with no href at all is not a link — it is text that looks like one.
    // That is the dead-CTA rule's business (`content.ts`), not this file's, unless
    // the author wrote an explicit dead value.
    if (!href && !isAtom) continue;
    found.push({ visited, href, isButton: isAtom || /\bbtn\b/.test(node.class ?? '') });
  }
  return found;
}

/* ── The rule ───────────────────────────────────────────────────────────────── */

/** What to call the thing the owner clicked on, so the sentence reads naturally
 *  whether they built a text link or a button. */
function noun(link: FoundLink): string {
  return link.isButton ? 'button' : 'link';
}

/**
 * Every link finding for one page's composed document.
 *
 * A collection template's path is a pattern rather than a location (`/products/…`
 * renders once per product), so relative hrefs on one are left unresolved — see
 * `classifyHref`.
 */
export function checkLinks(inventory: DocumentInventory, targets: ResolvedTargets): RawFinding[] {
  const findings: RawFinding[] = [];
  const fromPath = inventory.page.kind === 'collection' ? null : normalizePath(inventory.page.slug);

  for (const link of findLinks(inventory.nodes)) {
    const { visited } = link;
    const base = {
      origin: visited.origin,
      nodeId: visited.node.id ?? null,
      nodePath: visited.nodePath,
    };
    const classified = classifyHref(link.href, fromPath);

    if (classified.kind === 'nowhere') {
      findings.push({
        ...base,
        rule: 'link-no-destination',
        severity: 'warning',
        title: `This ${noun(link)} doesn't go anywhere`,
        detail:
          `Someone who clicks this ${noun(link)} stays exactly where they are — nothing has been ` +
          `set as its destination. Open it and choose the page, product or web address it should ` +
          `open, or remove it so the page doesn't offer something that isn't there.`,
        ...(link.href ? { evidence: link.href } : {}),
      });
      continue;
    }

    if (classified.kind === 'anchor') {
      if (inventory.anchorIds.has(classified.value)) continue;
      findings.push({
        ...base,
        rule: 'link-anchor-missing',
        severity: 'warning',
        title: `This ${noun(link)} jumps to a part of the page that isn't there`,
        detail:
          `It's set to scroll down to "${classified.value}", but no section on this page is named ` +
          `that — so clicking it does nothing. This usually means the section was renamed or ` +
          `deleted after the ${noun(link)} was made.`,
        evidence: `#${classified.value}`,
      });
      continue;
    }

    if (classified.kind === 'scheme') {
      // The only scheme worth judging: `mailto:` with nothing after it opens an
      // empty message with no recipient, which looks like a working contact link
      // right up until someone tries to use it.
      const [scheme = '', rest = ''] = classified.value.split(/:(.*)/s);
      if ((scheme === 'mailto' || scheme === 'tel') && !rest.trim()) {
        findings.push({
          ...base,
          rule: 'link-mailto-empty',
          severity: 'warning',
          title:
            scheme === 'mailto'
              ? 'This email link has no address'
              : 'This phone link has no number',
          detail:
            scheme === 'mailto'
              ? 'Clicking it opens a blank email with nobody in the To field. Add the address you want people to write to.'
              : 'Tapping it on a phone does nothing, because no number is set. Add the number you want people to call.',
          evidence: link.href,
        });
      }
      continue;
    }

    if (classified.kind === 'external') continue;

    const broken = checkInternalPath(classified.value, targets);
    if (!broken) continue;
    findings.push({
      ...base,
      rule: 'link-broken',
      severity: 'error',
      title:
        broken.noun === 'page'
          ? "This link goes to a page that doesn't exist"
          : `This link goes to a ${broken.noun} that doesn't exist`,
      detail:
        broken.noun === 'page'
          ? `Anyone who clicks it lands on a "page not found" screen. Nothing on your site is at ` +
            `${broken.path} — check the address for a typo, or point the link at one of your pages.`
          : `Anyone who clicks it lands on a "page not found" screen. There's no ${broken.noun} at ` +
            `${broken.path} any more — it was probably deleted or its web address was changed after ` +
            `this link was made.`,
      evidence: link.href,
    });
  }

  return findings;
}
