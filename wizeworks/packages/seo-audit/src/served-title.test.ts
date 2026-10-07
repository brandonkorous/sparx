// The length check measures the title a search result shows (sparx persona issue 134).
//
// MEASURED 2026-10-06 on Gillett Diesel: the About page's search title was 54
// characters and the check called it a good length. The site served it with
// " · Gillett Diesel Service" added, 79 characters, which a search engine cuts.

import { describe, expect, it } from 'vitest';
import { auditEntity } from './audit';
import type { AuditableEntity } from './types';

const TYPED = 'About Gillett Diesel: Bluffdale diesel shop since 1986';
const SERVED = `${TYPED} · Gillett Diesel Service`;

function page(overrides: Partial<AuditableEntity>): AuditableEntity {
  return {
    entityType: 'builder_page',
    title: TYPED,
    description:
      'Family-owned in Bluffdale, Utah since 1986: factory authorized pump and turbo rebuilds, a 14-bay shop with a dyno.',
    noindex: false,
    canonical: null,
    slug: 'about',
    inSitemap: true,
    h1Count: 1,
    wordCount: 300,
    imageCount: 1,
    imagesMissingAlt: 0,
    internalLinkCount: 2,
    ogImage: 'custom',
    structuredDataTypes: [],
    inLlmsTxt: true,
    ...overrides,
  };
}

const titleLength = (entity: AuditableEntity) =>
  auditEntity(entity).checks.find((c) => c.id === 'title-length');

describe('how long the title is', () => {
  it('measures the title with the business name the site adds', () => {
    const check = titleLength(page({ servedTitle: SERVED }));
    expect(check?.status).toBe('fail');
    expect(check?.value).toBe('79 characters as search shows it');
    expect(check?.tip).toContain('business name added after it');
  });

  it('measures the title as typed when that is what is served', () => {
    const check = titleLength(page({ servedTitle: null }));
    expect(check?.status).toBe('pass');
    expect(check?.value).toBe('54 characters');
  });

  it('keeps the plain advice for a title that is long as typed', () => {
    const long = `${TYPED} and everything else we do`;
    const check = titleLength(page({ title: long, servedTitle: long }));
    expect(check?.value).toBe(`${long.length} characters`);
    expect(check?.tip).toBe(
      'A long title gets cut off in search results. Trim it to about 60 characters.'
    );
  });
});
