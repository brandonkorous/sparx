// Every shipped header fits a phone with the logo in it (sparx persona issue 291).
//
// WHY THIS EXISTS. Twenty two designs ship the header captured from the golden `sparx`
// bundle: a bar of the brand and a group holding the desktop links, a `<details>` Menu,
// the light/dark switch, the account link and a filled button. On a 360px phone the
// group needed more than the bar had, and the brand was the only flex item allowed to
// shrink, so the logo was drawn 0px wide and the page still scrolled sideways. Nothing
// failed: the tree was valid, every class compiled, and the header rendered.
//
// WHAT IT ASSERTS. The shape that keeps it from happening, on the bytes that ship (not
// after the platform's repair, which is checked in silica-catalog):
//
//   1. the brand never shrinks (`shrink-0`, or no class, which wears the component's
//      default that already has it);
//   2. below the bar's switch the only things IN the bar beside the brand are the Menu
//      and the account link: everything else in the group carries `hidden`;
//   3. a filled button hidden from the bar has a copy in the Menu, so a phone visitor
//      can still reach it;
//   4. the group switches at ONE width: a group whose links come back at `@sm` while its
//      button waits for `@5xl` is the same overflow at tablet width.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HOST_KEYS } from '@wizeworks/silica-catalog';
import { describe, expect, it } from 'vitest';

import { BLUEPRINTS, blueprintSlugs } from './blueprints-dir';

interface Loose {
  kind?: string;
  tag?: string;
  class?: string;
  component?: string;
  attrs?: Record<string, unknown>;
  children?: unknown[];
}

const words = (n: Loose | undefined): string[] => (n?.class ?? '').split(/\s+/).filter(Boolean);

const childrenOf = (n: Loose): Loose[] =>
  (n.children ?? []).filter((c): c is Loose => !!c && typeof c === 'object');

function find(node: Loose, match: (n: Loose) => boolean): Loose | undefined {
  if (match(node)) return node;
  for (const c of childrenOf(node)) {
    const hit = find(c, match);
    if (hit) return hit;
  }
  return undefined;
}

function all(node: Loose, out: Loose[] = []): Loose[] {
  out.push(node);
  for (const c of childrenOf(node)) all(c, out);
  return out;
}

/** The phone Menu: a `<details>` hidden from some container width up. */
const isMenu = (n: Loose): boolean =>
  n.tag === 'details' && words(n).some((w) => /^@[a-z0-9]+:hidden$/.test(w));

/** The account link: the live core, or the stamped sign-in link the captured golden
 *  still carries (the platform's repair swaps that for the core on install). */
const isAccountLink = (n: Loose): boolean =>
  (n.kind === 'host' && n.component === HOST_KEYS.siteAccountLink) ||
  (n.tag === 'a' && typeof n.attrs?.href === 'string' && n.attrs.href.startsWith('/account'));

interface Header {
  brand: Loose | undefined;
  group: Loose;
  menu: Loose;
}

/** The captured header shape in a bundle's frame, or null when its header is another. */
function capturedHeader(slug: string): Header | null {
  const site = JSON.parse(readFileSync(join(BLUEPRINTS, slug, 'site.json'), 'utf8')) as {
    frame?: { root?: Loose } | null;
  };
  const root = site.frame?.root;
  if (!root) return null;
  const nav = find(root, (n) => n.tag === 'nav');
  if (!nav) return null;
  const group = find(nav, (n) => childrenOf(n).some(isMenu));
  if (!group) return null;
  return {
    brand: find(nav, (n) => n.kind === 'host' && n.component === HOST_KEYS.siteBrand),
    group,
    menu: childrenOf(group).find(isMenu)!,
  };
}

/** Each bundle's problems with its phone header, as `slug · what`. */
function phoneHeaderProblems(slug: string, header: Header): string[] {
  const problems: string[] = [];
  const { brand, group, menu } = header;

  if (brand?.class !== undefined && !words(brand).includes('shrink-0')) {
    problems.push(`${slug} · the logo can shrink to nothing (brand has no shrink-0)`);
  }

  for (const child of childrenOf(group)) {
    if (child === menu) continue;
    if (isAccountLink(child)) continue;
    if (!words(child).includes('hidden')) {
      const what = child.component ?? `${child.tag ?? 'node'}.${words(child).join('.')}`;
      problems.push(`${slug} · ${what} still takes room in the phone bar`);
    }
  }

  const menuHrefs = new Set(
    all(menu)
      .filter((n) => n.tag === 'a' && words(n).includes('btn-primary'))
      .map((n) => n.attrs?.href)
  );
  for (const child of childrenOf(group)) {
    if (child.tag !== 'a' || !words(child).includes('btn-primary')) continue;
    if (!menuHrefs.has(child.attrs?.href)) {
      problems.push(`${slug} · the button to ${String(child.attrs?.href)} is not in the Menu`);
    }
  }

  const switches = new Set(
    all(group)
      .flatMap(words)
      .map((w) => /^(@[a-z0-9]+):/.exec(w)?.[1])
      .filter((w): w is string => !!w)
  );
  if (switches.size > 1) {
    problems.push(`${slug} · the bar switches at ${[...switches].join(' and ')}, not one width`);
  }

  return problems;
}

describe('every shipped header fits a phone', () => {
  const headers = blueprintSlugs()
    .map((slug) => [slug, capturedHeader(slug)] as const)
    .filter((entry): entry is readonly [string, Header] => entry[1] !== null);

  it('finds the captured header in the designs that ship it', () => {
    // A guard on the guard: if this stops recognising the shape, every check below
    // passes over nothing. Twenty two at the time of writing (the golden, its twenty
    // themed clones, and the Piggles starter).
    expect(headers.length).toBeGreaterThanOrEqual(22);
  });

  it('keeps the logo, and keeps everything but the Menu and the account off the phone bar', () => {
    const problems = headers.flatMap(([slug, header]) => phoneHeaderProblems(slug, header));
    expect(problems).toEqual([]);
  });
});
