import { describe, it, expect } from 'vitest';

import { auditEntity } from './audit';
import type { AuditableEntity } from './types';

// A deliberately healthy entity — every scored check passes. Tests override one
// axis at a time so a failure points at a single check, not a tangle.
function healthy(overrides: Partial<AuditableEntity> = {}): AuditableEntity {
  return {
    entityType: 'cms_page',
    title: 'A solid, descriptive page title for SEO testing',
    description:
      'A meta description that lands comfortably inside the seventy to one hundred sixty character window recommended for search.',
    noindex: false,
    canonical: null,
    slug: 'guides/diesel-maintenance',
    inSitemap: true,
    h1Count: 1,
    wordCount: 800,
    imageCount: 4,
    imagesMissingAlt: 0,
    internalLinkCount: 3,
    ogImage: 'custom',
    structuredDataTypes: ['BreadcrumbList'],
    inLlmsTxt: true,
    ...overrides,
  };
}

const byId = (card: ReturnType<typeof auditEntity>, id: string) =>
  card.checks.find((c) => c.id === id);

describe('auditEntity', () => {
  it('scores a healthy page 100 / excellent with nothing to fix', () => {
    const card = auditEntity(healthy());
    expect(card.score).toBe(100);
    expect(card.grade).toBe('excellent');
    expect(card.fixFirst).toBeNull();
  });

  it('returns the four categories summing to 100 points', () => {
    const card = auditEntity(healthy());
    const total = card.categories.reduce((s, c) => s + c.max, 0);
    expect(total).toBe(100);
    expect(card.categories.map((c) => c.key)).toEqual(['meta', 'index', 'content', 'social']);
  });

  it('fails a missing title and recommends a fix', () => {
    const card = auditEntity(healthy({ title: null }));
    expect(byId(card, 'title-present')?.status).toBe('fail');
    expect(card.score).toBeLessThan(100);
    expect(card.fixFirst).not.toBeNull();
    // The empty title must not double-message: length check stays quiet.
    expect(byId(card, 'title-length')?.tip).toBeUndefined();
  });

  it('warns (not fails) on an over-long title', () => {
    const card = auditEntity(healthy({ title: 'x'.repeat(65) }));
    expect(byId(card, 'title-length')?.status).toBe('warn');
  });

  it('treats noindex as info and removes its weight from the denominator', () => {
    // An otherwise-perfect page that is intentionally noindex should NOT be
    // penalized — the two index checks go info and the score normalizes over 83.
    const card = auditEntity(healthy({ noindex: true }));
    expect(byId(card, 'indexable')?.status).toBe('info');
    expect(byId(card, 'in-sitemap')?.status).toBe('info');
    expect(card.score).toBe(100);
    const denominator = card.categories.reduce((s, c) => s + c.max, 0);
    expect(denominator).toBe(83); // 100 − 9 (indexable) − 8 (sitemap)
  });

  it('does not award alt-text points to a page with no pictures', () => {
    // This test used to assert `pass`, which handed a page with no images the
    // full 10 points — the heaviest check in the catalog — for a test that
    // never ran, and filed it under "Already good · these are set up
    // correctly". It was not a rule anyone would defend out loud; it was the
    // bug written down. The `noindex` case directly above already had the
    // right answer: not applicable is `info`, and info leaves the denominator.
    const card = auditEntity(healthy({ imageCount: 0, imagesMissingAlt: 0 }));
    expect(byId(card, 'image-alt')?.status).toBe('info');
    expect(byId(card, 'image-alt')?.value).toBe('no pictures on this page');

    const denominator = card.categories.reduce((s, c) => s + c.max, 0);
    expect(denominator).toBe(90); // 100 − 10 (image-alt)
    // And an otherwise-perfect page still reads 100, over what was measured.
    expect(card.score).toBe(100);
  });

  it('does not complain about the summary twice when there is no summary', () => {
    // She saw both in "Worth fixing": "The page has a short summary · not
    // written yet" AND "How long the summary is · nothing written". One
    // missing thing, two rows, and the second carried no advice because its
    // tip was already gated on there being something to measure.
    const card = auditEntity(healthy({ description: '' }));
    expect(byId(card, 'desc-present')?.status).toBe('warn');
    expect(byId(card, 'desc-length')?.status).toBe('info');
    expect(byId(card, 'desc-length')?.value).toBe('nothing to measure yet');

    const complaints = card.checks.filter((c) => c.status === 'warn' || c.status === 'fail');
    expect(complaints.map((c) => c.id)).toEqual(['desc-present']);
  });

  it('charges one missing summary once, not twice', () => {
    // A `warn` earns half its weight, so the old pair cost 3 of 6 AND 2 of 4
    // for the same absence. The length check now leaves the denominator
    // entirely until there is a length to judge.
    const card = auditEntity(healthy({ description: '' }));
    const denominator = card.categories.reduce((s, c) => s + c.max, 0);
    expect(denominator).toBe(96); // 100 − 4 (desc-length)
    expect(card.score).toBe(97); // lost 3 of 6 on desc-present, over 96
  });

  it('never puts advice on a fact', () => {
    // The first cut of the no-pictures fix kept the tip, because it was gated
    // on `!== 'pass'` and `info` is not `pass`. So a page with no pictures was
    // told "Write one for each". A fact is not a task; `finalize` strips both
    // the tip and the action off every `info` check so the next one that turns
    // out not to apply cannot bring its advice along.
    const noPictures = auditEntity(healthy({ imageCount: 0, imagesMissingAlt: 0 }));
    const noSummary = auditEntity(healthy({ description: '' }));
    const noIndex = auditEntity(healthy({ noindex: true }));
    for (const card of [noPictures, noSummary, noIndex]) {
      for (const check of card.checks.filter((c) => c.status === 'info')) {
        expect(check.tip, check.id).toBeUndefined();
        expect(check.action, check.id).toBeUndefined();
      }
    }
    // And the same check DOES advise once it applies.
    const someMissing = auditEntity(healthy({ imageCount: 8, imagesMissingAlt: 3 }));
    expect(byId(someMissing, 'image-alt')?.tip).toBeDefined();
  });

  it('judges the length again as soon as there is one', () => {
    const short = auditEntity(healthy({ description: 'Too short.' }));
    expect(byId(short, 'desc-length')?.status).toBe('warn');
    expect(byId(short, 'desc-length')?.value).toBe('10 characters');
  });

  it('fails alt-text when a third or more images lack alt', () => {
    const card = auditEntity(healthy({ imageCount: 8, imagesMissingAlt: 3 }));
    expect(byId(card, 'image-alt')?.status).toBe('fail');
    expect(byId(card, 'image-alt')?.value).toBe('5 of 8 described');
  });

  it('warns a few missing alts but does not fail', () => {
    const card = auditEntity(healthy({ imageCount: 10, imagesMissingAlt: 2 }));
    expect(byId(card, 'image-alt')?.status).toBe('warn');
  });

  it('fails a page with no H1 and warns one with several', () => {
    expect(byId(auditEntity(healthy({ h1Count: 0 })), 'heading-h1')?.status).toBe('fail');
    expect(byId(auditEntity(healthy({ h1Count: 3 })), 'heading-h1')?.status).toBe('warn');
  });

  it('warns a generated OG card but passes a custom upload', () => {
    expect(byId(auditEntity(healthy({ ogImage: 'generated' })), 'og-image')?.status).toBe('warn');
    expect(byId(auditEntity(healthy({ ogImage: 'none' })), 'og-image')?.status).toBe('fail');
    expect(byId(auditEntity(healthy({ ogImage: 'custom' })), 'og-image')?.status).toBe('pass');
  });

  it('requires the Product schema for products specifically', () => {
    const withProduct = auditEntity(
      healthy({ entityType: 'product', structuredDataTypes: ['Product'] })
    );
    const withoutProduct = auditEntity(
      healthy({ entityType: 'product', structuredDataTypes: ['BreadcrumbList'] })
    );
    expect(byId(withProduct, 'structured-data')?.status).toBe('pass');
    expect(byId(withoutProduct, 'structured-data')?.status).toBe('warn');
  });

  it('uses an entity-aware word threshold (product blurb passes, prose would not)', () => {
    const product = auditEntity(
      healthy({ entityType: 'product', wordCount: 60, internalLinkCount: 1 })
    );
    const prose = auditEntity(healthy({ entityType: 'cms_page', wordCount: 60 }));
    expect(byId(product, 'content-depth')?.status).toBe('pass');
    expect(byId(prose, 'content-depth')?.status).toBe('warn');
  });

  it('picks the largest point shortfall as fixFirst (alt-text fail over a title warn)', () => {
    const card = auditEntity(
      healthy({ imageCount: 8, imagesMissingAlt: 3, title: 'x'.repeat(65) })
    );
    // image-alt fail = −10; title-length warn = −4 → fixFirst is the alt-text tip.
    // Asserted against the check's own tip rather than a literal fragment, so a
    // reworded message cannot make this test claim the wrong check won.
    expect(card.fixFirst).toBe(byId(card, 'image-alt')?.tip);
  });

  it('drops to needs-work / poor as failures stack', () => {
    const card = auditEntity(
      healthy({
        title: null,
        description: null,
        h1Count: 0,
        imageCount: 8,
        imagesMissingAlt: 6,
        ogImage: 'none',
        structuredDataTypes: [],
      })
    );
    expect(card.score).toBeLessThan(70);
    expect(['needs-work', 'poor']).toContain(card.grade);
  });
});
