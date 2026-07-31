// Every SHIPPED blueprint, graded by the same linter a tenant's Check panel runs.
//
// WHY THIS EXISTS. `catalog-sweep.test.ts` one level down grades each section in the
// platform library against every theme. This grades the finished article: the starter
// sites in `marketplace-catalog/blueprints/`, which is what a business owner actually
// lands in. A blueprint composes catalog sections into pages, adds a frame, and picks
// a theme — and every one of those steps can introduce a defect the section-level sweep
// cannot see, because it is a property of the composition rather than of any one block.
//
// IT SHIPS BEFORE ANYONE EDITS IT, which is what makes a blueprint defect different in
// kind from a tenant's own mistake. The starter site is the first thing a new owner sees
// and the last thing they will think to question — "the template came like this" — and
// with 20 of the 21 bundles generated as themed clones of the golden `sparx` one, a
// single bad class in the golden header is 21 shipped sites carrying it.
//
// WHAT IT CAUGHT, on the run that motivated it (2026-07-31):
//
//   · `gap-2.5` on the header's brand mark — a half-step the declared scale does not
//     contain, so it emitted no CSS at all. 1 per blueprint, 21 in total.
//   · `text-primary` used as INK on `bg-base-100` for a product price and a card label.
//     `--color-primary` is a FILL token with a `-content` pair for text ON it; as ink it
//     inherits whatever lightness the theme's brand color happens to have. On the pale
//     themes (petal, salon, workshop) that landed at contrast the rule calls unreadable
//     — SIX error-severity findings, on the price. Fixed at the source, in the golden
//     bundle, so every clone inherited it.
//   · A footer column heading at `h3` under the page `h1`, on every page of every
//     blueprint: an outline that jumps a level for anyone navigating by headings.
//
// It also caught a defect in THIS package rather than in the content: a form's own
// `type="submit"` button was reported as "This button doesn't go anywhere", which would
// have told every owner with a working contact form to break it. See `links.ts`.
//
// READS THE REPO, deliberately. The bundles are data files rather than a package export,
// and the thing worth guarding is what is on disk about to be published — not a fixture
// that can drift from it.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { lintSite } from './lint';
import type { LintablePage, SiteLintReport } from './types';

const BLUEPRINTS = join(process.cwd(), '..', '..', 'marketplace-catalog', 'blueprints');

interface BundleSite {
  frame?: { root: unknown } | null;
  /** The home page carries no `slug` — it IS the root — which the linter spells `''`. */
  pages: { name: string; slug?: string; root: unknown }[];
  theme?: unknown;
}

function slugs(): string[] {
  return readdirSync(BLUEPRINTS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function grade(slug: string): SiteLintReport {
  const site = JSON.parse(readFileSync(join(BLUEPRINTS, slug, 'site.json'), 'utf8')) as BundleSite;
  return lintSite({
    pages: site.pages.map((p) => ({ ...p, slug: p.slug ?? '' })) as unknown as LintablePage[],
    frame: (site.frame ?? null) as never,
    theme: (site.theme ?? null) as never,
  });
}

/** One line per finding, naming the blueprint — so a failure says which bundle and what,
 *  not just a count that someone then has to go and reproduce. */
function lines(slug: string, report: SiteLintReport, rule?: string): string[] {
  return report.findings
    .filter((f) => (rule ? f.rule === rule : f.severity === 'error'))
    .map((f) => `${slug} · ${f.location.ownerName} · ${f.rule} — ${f.evidence ?? f.title}`);
}

describe('the shipped blueprints', () => {
  it('ships a catalog worth sweeping', () => {
    // A guard on the guard: if the bundles move or the directory is restructured, every
    // assertion below would otherwise pass by having nothing to check.
    expect(slugs().length).toBeGreaterThanOrEqual(20);
  });

  it('has no unreadable text in any starter site', () => {
    const found = slugs().flatMap((slug) => lines(slug, grade(slug)));
    expect(found).toEqual([]);
  });

  it('carries no styling the stylesheet does not contain', () => {
    // A class outside the declared scale emits nothing — it is neither visible on the
    // canvas nor on the live page, so it is dead weight the owner cannot see or debug.
    const found = slugs().flatMap((slug) => lines(slug, grade(slug), 'class-no-css'));
    expect(found).toEqual([]);
  });

  it('keeps a heading outline a screen reader can follow', () => {
    const found = slugs().flatMap((slug) => lines(slug, grade(slug), 'heading-level-skipped'));
    expect(found).toEqual([]);
  });

  it('never reports a form submit button as a broken link', () => {
    // The regression this pins is a FALSE POSITIVE, which is the more damaging direction:
    // a wrong finding on a working contact form spends the owner's trust in every other
    // finding the panel makes.
    const found = slugs().flatMap((slug) => lines(slug, grade(slug), 'link-no-destination'));
    expect(found).toEqual([]);
  });
});
