// What Check tells a tenant about the site sparx just built them.
//
// `catalog-sweep.test.ts` holds each SECTION to the standard, one at a time. Nobody
// ever ran the assembled STARTER — the whole site every new tenant lands on — through
// `lintSite`. That is the first thing an owner clicks Check on, and it is the one site
// they did not write a word of, so every finding on it is sparx's to answer for.
//
// The bar here is deliberately not "zero findings". A starter legitimately ships things
// only the owner can finish: real copy, a real picture, a real destination. What it must
// not ship is a finding the owner cannot act on, or one that is sparx's own mistake
// wearing the owner's name.

import { describe, expect, it } from 'vitest';
import { starterFrame, starterPages, SPARX_THEMES } from '@sparx/silica-catalog';

import { lintSite } from './lint';
import type { LintablePage } from './types';

const FLAGS = { commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true };

const pages: LintablePage[] = starterPages(FLAGS).map((p, i) => ({
  id: `p${i}`,
  name: p.name,
  slug: p.slug,
  root: p.root,
}));

const report = () =>
  lintSite({
    pages,
    frame: { root: starterFrame(FLAGS).root },
    theme: SPARX_THEMES[0] ?? null,
  });

describe('Check, run on the starter a new tenant is given', () => {
  it('walks a site worth checking', () => {
    // Guard on the guard: if the starter ever collapses, every assertion below would
    // pass by vacuity.
    expect(pages.length).toBeGreaterThanOrEqual(5);
    expect(report().pagesChecked).toBe(pages.length);
  });

  it('does not grade the pages sparx built to make the site work', () => {
    // Before `isUtilityPage`, an untouched site reported 30 findings: 15
    // `seo-description-missing` and 15 `seo-title-missing`, six of each on the cart,
    // the search page and the four account pages. Nobody writes a search description
    // for "Reset password", and Google should not have been offered any of them.
    const graded = new Set(report().findings.map((f) => f.location.ownerName));
    for (const name of ['Cart', 'Search', 'Login', 'Register', 'Forgot password', 'Reset password'])
      expect(graded, name).not.toContain(name);

    // And the pages a business IS found by are still graded — the exemption must not
    // have swallowed the real ones.
    expect(graded).toContain('Home');
    expect(graded).toContain('About');
  });

  it('reports nothing at ERROR severity', () => {
    // An error is "this is broken", not "this is unfinished". sparx shipping the site
    // means sparx does not get to hand the owner a broken one.
    const errors = report()
      .findings.filter((f) => f.severity === 'error')
      .map((f) => `${f.rule} — ${f.title}`);
    expect(errors.join('\n')).toBe('');
  });

  it('every finding names something the owner can open', () => {
    // A finding whose owner the switcher cannot show is unactionable by construction:
    // the owner is told to fix something they cannot navigate to. `ownerName` is what
    // the author calls it — "Home", "Header & footer" — so an unknown one is a dead end.
    const names = new Set<string>([...pages.map((p) => p.name), 'Header & footer']);
    const orphans = report()
      .findings.filter((f) => !f.location.ownerName.trim() || !names.has(f.location.ownerName))
      .map((f) => `${f.rule} → owner "${f.location.ownerName}"`);
    expect([...new Set(orphans)].join('\n')).toBe('');
  });

  it('every finding says what to do about it', () => {
    // A message with no instruction is a complaint. These land in front of people who
    // do not write software, so "og-image-missing" alone is not a finding, it is a
    // riddle.
    // `title` names the problem; `detail` is why it matters and what to do. A finding
    // missing either is a complaint rather than an instruction.
    const mute = report()
      .findings.filter((f) => f.title.trim().length < 8 || f.detail.trim().length < 12)
      .map((f) => `${f.rule} — title "${f.title}" / detail "${f.detail}"`);
    expect([...new Set(mute)].join('\n')).toBe('');
  });
});
