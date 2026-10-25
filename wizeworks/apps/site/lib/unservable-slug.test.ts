import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSlugMiss } from './slug-miss';
import { joinSlug, MAX_PAGE_SLUG, unservableSlug } from './unservable-slug';

// WW-3: a 300-char scanner path and missed `/_next/static/chunks/…` files reached
// api-rest, came back VALIDATION_ERROR, and the storefront page threw a 500.

const API_PUBLIC = '../../../services/api-rest/src/routes/v1/public';

function schemaMax(file: string, schema: string): number {
  const source = readFileSync(new URL(`${API_PUBLIC}/${file}`, import.meta.url), 'utf8');
  const block = source.slice(source.indexOf(`const ${schema} = z.object({`));
  const match = /slug: z\.string\(\)\.min\(1\)\.max\((\d+)\)/.exec(block);
  if (!match) throw new Error(`no slug limit in ${file} ${schema}`);
  return Number(match[1]);
}

describe('unservableSlug', () => {
  it.each([
    ['_next/static/chunks/x', 'asset'],
    ['_next/static/chunks/(..)/a.js', 'asset'],
    ['a'.repeat(300), 'too-long'],
    ['about/team', null],
    ['a'.repeat(MAX_PAGE_SLUG), null],
    ['next-steps', null],
  ])('%s is %s', (slug, why) => {
    expect(unservableSlug(slug)).toBe(why);
  });

  // Shorter would 404 a real CMS page; the builder's 160 is a VALIDATION_ERROR isSlugMiss turns into null.
  it('is pinned to the longest api-rest page-lookup limit', () => {
    const limits = [schemaMax('builder.ts', 'PageQuery'), schemaMax('content.ts', 'BySlugQuery')];
    expect(MAX_PAGE_SLUG).toBe(Math.max(...limits));
  });
});

describe('joinSlug', () => {
  it('decodes and joins the segments', () => {
    expect(joinSlug(['about', 'our%20team'])).toBe('about/our team');
  });

  it('is null for a broken escape', () => {
    expect(joinSlug(['%c0'])).toBeNull();
  });
});

describe('isSlugMiss', () => {
  it.each([
    ['NOT_FOUND', true],
    ['VALIDATION_ERROR', true],
    ['INTERNAL_ERROR', false],
    [undefined, false],
  ])('%s is %s', (code, miss) => {
    expect(isSlugMiss(Object.assign(new Error('x'), { code }))).toBe(miss);
  });
});
