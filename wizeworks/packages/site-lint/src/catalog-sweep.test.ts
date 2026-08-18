// Every section in the platform library, graded against every real sparx theme.
//
// WHY THIS EXISTS AS A SEPARATE SWEEP. `sections/sections.test.ts` already asserts a lot
// about the library — unique keys, declared classes, semantic tags, no eyebrows, no faded
// text, a 16px floor — but it renders each section with an INERT host and NO THEME. That
// is the right shape for structural rules and it cannot see the one class of failure that
// only appears in a tenant's database: **a token pair that is legible on one theme and
// illegible on another.** `bg-accent` + `text-accent-content` is correct by construction
// and still unreadable if a particular theme's accent lands where neither black nor white
// carries — and the author who finds out is a business owner reading their own homepage.
//
// So this runs the REAL linter — the same `lintSite` that grades tenant sites and feeds
// the studio's Check panel — over a synthetic site whose pages are the catalog sections,
// once per shipped theme. No new heuristics: if a finding appears here it is a finding a
// tenant would have seen, in the same words.
//
// It lives in site-lint rather than silica-catalog because the dependency already points
// this way (site-lint → silica-catalog), and inverting it for a test would be a cycle.
//
// STAMPING IS WHY THIS MATTERS MORE THAN A USUAL TEST. A section is COPIED into the page
// at insert and frozen at publish. Fixing a composite reaches the next tenant and no
// existing one, so a contrast bug that ships is permanent for everybody who already
// dropped that block.

import { describe, expect, it } from 'vitest';
import type { Node as SilicaNode, Theme } from '@wizeworks/silicaui-html';
import {
  SPARX_CATALOG,
  SPARX_THEMES,
  TEMPLATE_THEMES,
  CONTENT_THEMES,
} from '@wizeworks/silica-catalog';

import { lintSite } from './lint';
import type { LintablePage, SiteLintReport } from './types';

// Every theme a stamped section can end up living under: the general trade shelf a
// business picks from (`SPARX_THEMES`), the ten bespoke commerce looks (`TEMPLATE_THEMES`)
// AND the ten bespoke content looks (`CONTENT_THEMES`). The overlay sections in particular
// are authored FOR the templates, so a contrast pair that is fine on the shelves and breaks
// under `roastery`'s terracotta, `flux`'s dark page, or `amplitude`'s / `amp`'s dark neon
// grounds would ship the exact bug this sweep exists to catch. One list, swept identically.
const ALL_THEMES: Theme[] = [...SPARX_THEMES, ...TEMPLATE_THEMES, ...CONTENT_THEMES];

/** Every palette item in the platform library, flattened once. */
const ITEMS = SPARX_CATALOG.flatMap((group) =>
  group.items.map((item) => ({ group: group.key, key: item.key, make: item.make }))
);

/** One page per section, so a finding names the section it came from. `slug` is the key,
 *  which also makes every internal link in the report traceable to its source. */
function pagesForSections(): LintablePage[] {
  return ITEMS.map((item) => ({
    id: item.key,
    name: `${item.group}/${item.key}`,
    slug: `/${item.key}`,
    root: item.make(),
    // Sections are not pages and owe no metadata; suppressing SEO keeps the report to
    // what is actually being tested here.
    noindex: true,
  }));
}

function sweep(theme: Theme): SiteLintReport {
  return lintSite({ pages: pagesForSections(), theme });
}

/** Findings of one rule, with the page (== section) that produced them. */
function of(report: SiteLintReport, severity: 'error' | 'warning'): string[] {
  return report.findings
    .filter((f) => f.severity === severity)
    .map((f) => `${f.location.ownerName}: ${f.rule} — ${f.evidence ?? f.title}`);
}

describe('the platform section library, against every real theme', () => {
  it('ships a library worth sweeping', () => {
    // A guard on the guard: if the catalog is ever restructured and this flattens to a
    // handful, every assertion below would pass by vacuity.
    expect(ITEMS.length).toBeGreaterThan(40);
    expect(SPARX_THEMES.length).toBeGreaterThanOrEqual(20);
    expect(TEMPLATE_THEMES.length).toBeGreaterThanOrEqual(10);
  });

  it('every section is legible on every shipped theme', () => {
    // The claim this file was written for. One assertion, every theme × every section,
    // through the same contrast rule a tenant's Check panel runs — across BOTH the trade
    // shelves and the ten bespoke template looks.
    const broken: string[] = [];
    for (const theme of ALL_THEMES) {
      const report = sweep(theme);
      const contrast = report.findings.filter(
        (f) => f.rule.startsWith('contrast') && f.severity !== 'suggestion'
      );
      for (const f of contrast) {
        broken.push(`${theme.name ?? 'theme'} · ${f.location.ownerName}: ${f.evidence ?? f.title}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('no section is BROKEN for a visitor, beyond the picture it is waiting for', () => {
    // Errors are the linter's "a visitor would hit this and it would not work" tier — a
    // link to nowhere, an image with no file, a page with nothing on it.
    //
    // `image-no-source` is EXCLUDED, and the reason is the interesting part. A section
    // that shows imagery ships from `_shell.ts`'s `picture()` with `src: ''` on purpose:
    // there is no record behind it, so the author has to choose the picture, and this
    // finding is exactly how the pre-publish check tells them. Handing it a placeholder
    // instead — the way the commerce and CMS composites do — would be wrong here, because
    // those images are BOUND: their placeholder only ever appears on the studio canvas and
    // a real product supplies the `src` before anything publishes. An unbound placeholder
    // would silence the warning and let a grey SVG go live.
    //
    // So this is the check working, not the library failing, and the next test pins that
    // it fires for precisely the sections that are waiting on a picture.
    for (const theme of ALL_THEMES) {
      const errors = of(sweep(theme), 'error').filter((f) => !f.includes('image-no-source'));
      expect(errors, theme.name ?? 'theme').toEqual([]);
    }
  });

  it('asks for a picture on every section that shows one, and on no other', () => {
    // The flip side of the exclusion above. If `picture()` ever starts emitting a real
    // `src`, this fails — which is the alarm worth having, because the silent version is
    // a tenant publishing grey placeholder boxes with a clean pre-publish check.
    const report = sweep(SPARX_THEMES[0]!);
    const waiting = new Set(
      report.findings
        .filter((f) => f.rule === 'image-no-source')
        .map((f) => f.location.ownerName.split('/')[1])
    );
    expect(waiting.size).toBeGreaterThan(10);

    // Every section reporting it must actually contain an `<img>` with no source, and
    // every section containing one must report it.
    const hasEmptyImage = (root: SilicaNode): boolean => {
      const nodes: unknown[] = [root];
      while (nodes.length) {
        const n = nodes.pop() as { kind?: string; tag?: string; attrs?: Record<string, unknown> };
        if (!n || typeof n !== 'object') continue;
        if (n.kind === 'element' && n.tag === 'img' && !n.attrs?.src) return true;
        for (const c of (n as { children?: unknown[] }).children ?? []) nodes.push(c);
      }
      return false;
    };
    for (const item of ITEMS) {
      expect(waiting.has(item.key), item.key).toBe(hasEmptyImage(item.make()));
    }
  });

  it('reports the same findings whatever the theme, apart from contrast', () => {
    // Everything except contrast is theme-independent, so a rule that starts varying by
    // theme means a palette is leaking into a structural check. Comparing the first theme
    // against all the others catches that without pinning an expected list.
    const structural = (theme: Theme) =>
      sweep(theme)
        .findings.filter((f) => !f.rule.startsWith('contrast'))
        .map((f) => `${f.location.ownerName}:${f.rule}`)
        .sort();

    const first = ALL_THEMES[0]!;
    const baseline = structural(first);
    for (const theme of ALL_THEMES.slice(1)) {
      expect(structural(theme), theme.name ?? 'theme').toEqual(baseline);
    }
  });

  it('grades each section the same way whether it is alone or beside the others', () => {
    // `checkThemeContrast` is deliberately site-wide — it checks a theme's pairs ONCE, for
    // the colors the site actually paints with. That makes the report order-sensitive in a
    // way a per-section check is not, so this pins that a section's OWN findings do not
    // change because of what else is on the site.
    const theme = SPARX_THEMES[0]!;
    const together = sweep(theme);
    const one = ITEMS[0]!;
    const alone = lintSite({
      pages: [{ id: one.key, name: one.key, slug: `/${one.key}`, root: one.make(), noindex: true }],
      theme,
    });

    const forSection = (report: SiteLintReport, name: string) =>
      report.findings
        .filter((f) => f.location.ownerName === name && !f.rule.startsWith('contrast-theme'))
        .map((f) => f.rule)
        .sort();

    expect(forSection(alone, one.key)).toEqual(
      forSection(together, `${one.group}/${one.key}`).filter(Boolean)
    );
  });
});
