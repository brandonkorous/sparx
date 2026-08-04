import { describe, expect, it } from 'vitest';

import { assemble } from './page-performance.js';
import type { PagePathMetrics } from './site-analytics-reports.js';

type PageRow = Parameters<typeof assemble>[0][number];
type Audits = Parameters<typeof assemble>[2];

function page(overrides: Partial<PageRow> & { id: string; name: string }): PageRow {
  return {
    slug: '/',
    kind: 'singleton',
    recordType: null,
    noindex: false,
    ...overrides,
  };
}

function metric(overrides: Partial<PagePathMetrics> & { path: string }): PagePathMetrics {
  return {
    views: 0,
    visitors: 0,
    orders: 0,
    revenueCents: 0,
    loadMs: null,
    loadSamples: 0,
    ...overrides,
  };
}

const NO_AUDITS: Audits = new Map();

describe('assemble', () => {
  it('matches a page to its traffic however either side spells the slug', () => {
    const report = assemble(
      [page({ id: 'p1', name: 'About', slug: 'about' })],
      [metric({ path: '/about/', views: 40, visitors: 25 })],
      NO_AUDITS,
      true
    );
    expect(report.pages[0]?.views).toBe(40);
    expect(report.pages[0]?.visitors).toBe(25);
    expect(report.otherPaths).toEqual([]);
  });

  it('keeps a page nobody visited, rather than reporting only what already worked', () => {
    // The row with 0 views is the most actionable one on the list. A report that
    // filters it out answers the question the owner already knew the answer to.
    const report = assemble(
      [
        page({ id: 'p1', name: 'Home', slug: '/' }),
        page({ id: 'p2', name: 'Warranty', slug: '/warranty' }),
      ],
      [metric({ path: '/', views: 100, visitors: 60 })],
      NO_AUDITS,
      true
    );
    expect(report.pages.map((p) => p.name)).toEqual(['Home', 'Warranty']);
    expect(report.pages[1]?.views).toBe(0);
    // No visitors means no conversion RATE — not a rate of zero, which reads as
    // failure rather than as silence.
    expect(report.pages[1]?.conversionPct).toBeNull();
  });

  it('gives a collection template the traffic of every record it renders', () => {
    // A visitor never lands on the template's own slug, so matching it literally would
    // report the product template — often a site's busiest page by far — as unvisited.
    const report = assemble(
      [
        page({
          id: 'p1',
          name: 'Product page',
          slug: '/product-template',
          kind: 'collection',
          recordType: 'commerce.product',
        }),
      ],
      [
        metric({
          path: '/products/brake-kit',
          views: 30,
          visitors: 20,
          orders: 2,
          revenueCents: 0,
        }),
        metric({ path: '/products/oil-filter', views: 10, visitors: 8 }),
        metric({ path: '/about', views: 5, visitors: 5 }),
      ],
      NO_AUDITS,
      true
    );

    const row = report.pages[0];
    expect(row?.pathPrefix).toBe('/products/');
    expect(row?.pathsCovered).toBe(2);
    expect(row?.views).toBe(40);
    expect(row?.orders).toBe(2);
    // `/about` belongs to no page here, so it stays visible in the leftovers rather
    // than vanishing — otherwise the totals would not reconcile with the traffic card.
    expect(report.otherPaths.map((p) => p.path)).toEqual(['/about']);
  });

  it('weights a folded load time by how many measurements each path had', () => {
    // Averaging two averages treats a path measured twice as equal to one measured
    // two thousand times, which is how a report ends up confidently wrong.
    const report = assemble(
      [
        page({
          id: 'p1',
          name: 'Product page',
          slug: '/t',
          kind: 'collection',
          recordType: 'commerce.product',
        }),
      ],
      [
        metric({ path: '/products/a', views: 1, loadMs: 400, loadSamples: 99 }),
        metric({ path: '/products/b', views: 1, loadMs: 4000, loadSamples: 1 }),
      ],
      NO_AUDITS,
      true
    );
    expect(report.pages[0]?.loadMs).toBe(436);
    expect(report.pages[0]?.loadSamples).toBe(100);
  });

  it('leaves load time null when no browser ever reported one', () => {
    const report = assemble(
      [page({ id: 'p1', name: 'Home' })],
      [metric({ path: '/', views: 10, visitors: 10 })],
      NO_AUDITS,
      true
    );
    expect(report.pages[0]?.loadMs).toBeNull();
    expect(report.pages[0]?.loadSamples).toBe(0);
  });

  it('carries the stored search grade, and null for a page never audited', () => {
    const audits: Audits = new Map([
      ['p1', { score: 82, grade: 'good', fixFirst: 'Write a description for this page.' }],
    ]);
    const report = assemble(
      [page({ id: 'p1', name: 'Home' }), page({ id: 'p2', name: 'Terms', slug: '/terms' })],
      [metric({ path: '/', views: 1 })],
      audits,
      true
    );
    expect(report.pages[0]?.seoScore).toBe(82);
    expect(report.pages[0]?.seoFixFirst).toBe('Write a description for this page.');
    expect(report.pages[1]?.seoScore).toBeNull();
  });

  it('reports no money at all when Commerce is off', () => {
    // A permanently-empty revenue column on a publisher's report is noise, not
    // information — and the orders exist in the table whether or not the module is on.
    const report = assemble(
      [page({ id: 'p1', name: 'Home' })],
      [metric({ path: '/', views: 10, visitors: 10, orders: 3, revenueCents: 9900 })],
      NO_AUDITS,
      false
    );
    expect(report.commerce).toBe(false);
    expect(report.pages[0]?.orders).toBe(0);
    expect(report.pages[0]?.revenueCents).toBe(0);
    expect(report.pages[0]?.conversionPct).toBeNull();
    expect(report.totals.revenueCents).toBe(0);
    // Traffic is still traffic.
    expect(report.totals.views).toBe(10);
  });

  it('computes conversion as orders per visitor, to one decimal', () => {
    const report = assemble(
      [page({ id: 'p1', name: 'Home' })],
      [metric({ path: '/', views: 300, visitors: 240, orders: 7 })],
      NO_AUDITS,
      true
    );
    expect(report.pages[0]?.conversionPct).toBe(2.9);
  });

  it('ranks by traffic, then by name so the quiet tail is stable', () => {
    const report = assemble(
      [
        page({ id: 'p1', name: 'Zebra', slug: '/z' }),
        page({ id: 'p2', name: 'Apple', slug: '/a' }),
        page({ id: 'p3', name: 'Busy', slug: '/b' }),
      ],
      [metric({ path: '/b', views: 99 })],
      NO_AUDITS,
      true
    );
    expect(report.pages.map((p) => p.name)).toEqual(['Busy', 'Apple', 'Zebra']);
  });

  it('totals every path, owned or not, so the figures reconcile', () => {
    const report = assemble(
      [page({ id: 'p1', name: 'Home' })],
      [
        metric({ path: '/', views: 10, visitors: 8, orders: 1, revenueCents: 5000 }),
        metric({ path: '/blog/hello', views: 4, visitors: 4, orders: 1, revenueCents: 2500 }),
      ],
      NO_AUDITS,
      true
    );
    expect(report.totals).toEqual({ views: 14, visitors: 12, orders: 2, revenueCents: 7500 });
  });

  // An UNADDRESSED page (slug null) used to fall onto `/` via `page.slug ?? '/'`, so it read
  // the home page's metrics row and rendered as a second `/` with identical figures. Reading
  // down the People column then double-counted the busiest page on the site.
  it('does not let a slugless page claim the home page traffic', () => {
    const report = assemble(
      [
        page({ id: 'p1', name: 'Home', slug: '' }),
        page({ id: 'p2', name: 'Home — Landing', slug: null }),
      ],
      [metric({ path: '/', views: 103, visitors: 10 })],
      NO_AUDITS,
      true
    );

    const home = report.pages.find((p) => p.name === 'Home');
    const orphan = report.pages.find((p) => p.name === 'Home — Landing');

    expect(home?.views).toBe(103);
    expect(home?.visitors).toBe(10);
    // Still listed — a page nobody can reach is worth surfacing — but owning nothing.
    expect(orphan).toBeDefined();
    expect(orphan?.views).toBe(0);
    expect(orphan?.visitors).toBe(0);
    expect(orphan?.path).toBe('');
    expect(orphan?.pathsCovered).toBe(0);
    // The column now sums to the traffic that actually happened.
    expect(report.pages.reduce((n, p) => n + p.visitors, 0)).toBe(10);
    // And `/` is still credited, so it is not double-counted as unowned either.
    expect(report.totals.views).toBe(103);
  });
});
