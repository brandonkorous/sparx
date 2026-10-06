// The starter's own words, found on a site that kept them (sparx persona issue 046).
//
// Built on the REAL starter every new tenant gets, so the test fails if the rule ever
// stops recognising the copy that actually ships.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Node as SilicaNode } from '@wizeworks/silicaui-html';
import { starterFrame, starterPages, SPARX_THEMES } from '@wizeworks/silica-catalog';

import { BLUEPRINTS } from './blueprints-dir';
import { lintSite } from './lint';
import { starterLinesOf } from './starter-text';
import type { LintablePage, StarterText } from './types';

const FLAGS = { commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true };

const shipped: LintablePage[] = starterPages(FLAGS).map((p, i) => ({
  id: `p${String(i)}`,
  name: p.name,
  slug: p.slug,
  root: p.root,
}));
const frame = starterFrame(FLAGS).root;

const starterText: StarterText = {
  pages: Object.fromEntries(shipped.map((p) => [p.id, starterLinesOf(p.root)])),
  frame: starterLinesOf(frame),
};

const home = shipped.find((p) => p.slug === null || p.slug === '' || p.slug === '/');

const starterFindings = (pages: LintablePage[], text: StarterText | undefined) =>
  lintSite({
    pages,
    frame: { root: frame },
    theme: SPARX_THEMES[0] ?? null,
    starterText: text,
  }).findings.filter((f) => f.rule === 'starter-text');

/** Replace every string child equal to `from` with `to`, anywhere in the tree. */
function rewrite(node: SilicaNode, from: string, to: string): SilicaNode {
  if (node.kind === 'outlet') return node;
  return {
    ...node,
    children: node.children?.map((c) =>
      typeof c === 'string'
        ? c.replace(/\s+/g, ' ').trim() === from
          ? to
          : c
        : rewrite(c, from, to)
    ),
  };
}

describe('starter words', () => {
  it('reads copy out of the real starter', () => {
    // Guard on the guard: with no lines the rule below passes by vacuity.
    expect(home).toBeDefined();
    expect(starterText.pages?.[home?.id ?? '']?.length).toBeGreaterThanOrEqual(2);
  });

  it('finds the pitch Gillett Diesel’s design put on his home page', () => {
    // The marketplace design he installed, as shipped. Its home page sells the
    // platform and talks to the owner; every visitor read it as his shop's voice.
    const site = JSON.parse(
      readFileSync(join(BLUEPRINTS, 'sparx-garage', 'site.json'), 'utf8')
    ) as { pages: { name: string; slug?: string; root: SilicaNode }[] };
    const page = site.pages.find((p) => !p.slug);
    if (!page) throw new Error('the Garage design has no home page');
    const lines = starterLinesOf(page.root);
    expect(lines.some((l) => l.includes('starting point'))).toBe(true);
    const findings = lintSite({
      pages: [{ id: 'home', name: 'Home', slug: '', root: page.root }],
      starterText: { pages: { home: lines } },
    }).findings.filter((f) => f.rule === 'starter-text');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toMatch(new RegExp(`^${String(lines.length)} lines on this page`));
  });

  it('finds the starter words on an untouched home page, and quotes them', () => {
    const findings = starterFindings(shipped, starterText);
    const onHome = findings.find((f) => f.location.ownerName === home?.name);
    expect(onHome?.severity).toBe('warning');
    expect(onHome?.detail).toMatch(/still the design's own words/);
    expect(onHome?.detail).toMatch(/“/);
  });

  it('stops counting a line once the owner changes it', () => {
    const lines = starterText.pages?.[home?.id ?? ''] ?? [];
    const first = lines[0] ?? '';
    const edited = shipped.map((p) =>
      p.id === home?.id
        ? { ...p, root: rewrite(p.root, first, 'Diesel Done Right Since 1986!') }
        : p
    );
    const before = starterFindings(shipped, starterText).find(
      (f) => f.location.ownerName === home?.name
    );
    const after = starterFindings(edited, starterText).find(
      (f) => f.location.ownerName === home?.name
    );
    expect(before?.evidence).toBe(first);
    expect(after?.detail ?? '').not.toContain(first.slice(0, 20));
  });

  it('is silent on a page whose every line is the owner’s', () => {
    if (!home) throw new Error('the starter has no home page');
    let root = home.root;
    for (const line of starterText.pages?.[home?.id ?? ''] ?? []) {
      root = rewrite(root, line, `Our own words about ${line.length.toString()} things`);
    }
    const mine = shipped.map((p) => (p.id === home?.id ? { ...p, root } : p));
    const onHome = starterFindings(mine, starterText).filter(
      (f) => f.location.ownerName === home?.name
    );
    expect(onHome).toEqual([]);
  });

  it('says nothing when the caller did not look', () => {
    expect(starterFindings(shipped, undefined)).toEqual([]);
  });

  it('leaves short labels alone', () => {
    expect(starterLinesOf(frame).every((l) => l.split(' ').length >= 4)).toBe(true);
  });
});
