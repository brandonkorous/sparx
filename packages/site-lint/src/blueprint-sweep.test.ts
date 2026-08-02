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

  it('sizes itself against its own block, not the browser window', () => {
    // A `sm:`/`lg:` variant is measured against the VIEWPORT, so the editor's phone and
    // tablet previews — which resize the block, not the window — show no change and the
    // author cannot check the design before publishing. The header's phone/desktop nav
    // swap was expressed this way, which is the worst case: the one piece of responsive
    // behaviour on the page, invisible in the preview built to check it.
    const found = slugs().flatMap((slug) => lines(slug, grade(slug), 'class-preview-blind'));
    expect(found).toEqual([]);
  });

  it('gives every card in a repeater somewhere to go', () => {
    // The product and post cards sit inside `kind: "collection"` repeaters, so each one
    // renders per RECORD and its `href` has to be BOUND (`{kind:'value', ref:'url',
    // attr:'href'}`) rather than authored. The capture that produced these bundles lost
    // the binding, which is invisible in the JSON — an `<a>` with no href reads the same
    // whether it is bound or forgotten — and shipped a featured-products grid where none
    // of the real products could be clicked.
    const found = slugs().flatMap((slug) => lines(slug, grade(slug), 'button-does-nothing'));
    expect(found).toEqual([]);
  });

  it('gives every page a search description', () => {
    // Without one, the search result and the link preview are filled with whatever text
    // happens to sit near the top of the page. The starter copy is written to be true for
    // any trade, so an owner who never touches it still has a usable result.
    const found = slugs().flatMap((slug) => lines(slug, grade(slug), 'seo-description-missing'));
    expect(found).toEqual([]);
  });

  it('has nothing left but the one accepted exception', () => {
    // The catch-all, so a NEW rule or a new bundle cannot land findings quietly. The
    // sparx ember (`--color-primary` #e04631) sits at 4.1:1 on white and 3.2:1 in dark
    // against its own `-content` pair — short of the 4.5:1 the rule wants. That is the
    // BRAND, accepted as-is by Brandon on 2026-07-31; it is a theme-token decision, not
    // an authoring defect, and it is the only thing this sweep tolerates.
    const remaining = slugs().flatMap((slug) =>
      grade(slug)
        .findings.filter((f) => !(f.rule === 'contrast-low' && f.location.scope === 'site'))
        .map((f) => `${slug} · ${f.location.ownerName} · ${f.rule} — ${f.evidence ?? f.title}`)
    );
    expect(remaining).toEqual([]);
  });
});
