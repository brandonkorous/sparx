import { describe, expect, it } from 'vitest';

import {
  catalogMergeTags,
  emailMergeTags,
  filterMergeTags,
  findTokenQuery,
  groupMergeTags,
  insertMergeTag,
} from './merge-tags';
import { emailSampleData, SAMPLE_EMAIL_DATA } from './email-tokens';
import { resolvePath } from './runtime';
import { EMAIL_CATALOG } from './binding';

describe('emailMergeTags', () => {
  const tags = emailMergeTags();
  const byPath = (p: string) => tags.find((t) => t.path === p);

  it('exposes the canonical site identity tokens', () => {
    const name = byPath('site.name');
    expect(name).toBeDefined();
    expect(name?.token).toBe('{{site.name}}');
    expect(name?.label).toBe('Site › Name');
    expect(name?.scope).toBe('per-send');
    expect(byPath('site.url')?.token).toBe('{{site.url}}');
  });

  it('hides the historical recipient alias in favor of customer.*', () => {
    expect(byPath('customer.firstName')).toBeDefined();
    expect(tags.some((t) => t.source.key === 'recipient')).toBe(false);
  });

  it('marks per-recipient sources and carries sample values', () => {
    const first = byPath('customer.firstName');
    expect(first?.scope).toBe('per-recipient');
    expect(first?.sample).toBe('Alex');
  });

  it('omits array sources and list/asset fields (no flat token)', () => {
    // commerce.product is an array source → iterated, never a flat token.
    expect(tags.some((t) => t.path.startsWith('commerce.product'))).toBe(false);
    // order.items is a `list` field → excluded; order.number (text) is included.
    expect(byPath('order.items')).toBeUndefined();
    expect(byPath('order.number')).toBeDefined();
  });

  it('every tag resolves against the sample data', () => {
    for (const tag of tags) {
      // A defined sample must round-trip through the same resolver the renderer uses.
      if (tag.sample !== undefined) {
        expect(String(resolvePath({ root: SAMPLE_EMAIL_DATA }, tag.path))).toBe(tag.sample);
      }
    }
  });
});

describe('catalogMergeTags', () => {
  it('honors excludeKeys', () => {
    const tags = catalogMergeTags(EMAIL_CATALOG, { excludeKeys: ['site'] });
    expect(tags.some((t) => t.source.key === 'site')).toBe(false);
  });
});

describe('site.* / tenant.* back-compat in the sample data', () => {
  it('resolves both the canonical and the alias root', () => {
    expect(resolvePath({ root: SAMPLE_EMAIL_DATA }, 'site.name')).toBe('Acme Supply Co.');
    expect(resolvePath({ root: SAMPLE_EMAIL_DATA }, 'tenant.name')).toBe('Acme Supply Co.');
    // Every URL alias agrees.
    expect(resolvePath({ root: SAMPLE_EMAIL_DATA }, 'site.url')).toBe('#');
    expect(resolvePath({ root: SAMPLE_EMAIL_DATA }, 'tenant.siteUrl')).toBe('#');
    expect(resolvePath({ root: SAMPLE_EMAIL_DATA }, 'tenant.storeUrl')).toBe('#');
  });

  it('emailSampleData merges the real identity into both roots + every url alias', () => {
    const data = emailSampleData({ name: 'Ironleaf Tattoo', siteUrl: 'https://ironleaf.example' });
    expect(resolvePath({ root: data }, 'site.name')).toBe('Ironleaf Tattoo');
    expect(resolvePath({ root: data }, 'tenant.name')).toBe('Ironleaf Tattoo');
    expect(resolvePath({ root: data }, 'site.url')).toBe('https://ironleaf.example');
    expect(resolvePath({ root: data }, 'tenant.siteUrl')).toBe('https://ironleaf.example');
    expect(resolvePath({ root: data }, 'tenant.storeUrl')).toBe('https://ironleaf.example');
  });
});

describe('findTokenQuery', () => {
  it('detects an open token + its path fragment at the caret', () => {
    const v = 'Hi {{site.na';
    expect(findTokenQuery(v, v.length)).toEqual({ start: 3, query: 'site.na' });
  });

  it('returns an empty query right after `{{`', () => {
    const v = 'Hi {{';
    expect(findTokenQuery(v, v.length)).toEqual({ start: 3, query: '' });
  });

  it('tolerates a leading space inside the braces', () => {
    const v = 'Hi {{ site';
    expect(findTokenQuery(v, v.length)).toEqual({ start: 3, query: 'site' });
  });

  it('stops once the token is closed', () => {
    const v = 'Hi {{site.name}} there';
    expect(findTokenQuery(v, v.length)).toBeNull();
  });

  it('stops at a space / fallback clause (no longer a bare path)', () => {
    expect(findTokenQuery('{{site.name ?? "x', 17)).toBeNull();
    expect(findTokenQuery('hello world', 11)).toBeNull();
  });

  it('uses the nearest opening braces before the caret', () => {
    const v = '{{a}} and {{cust';
    expect(findTokenQuery(v, v.length)).toEqual({ start: 10, query: 'cust' });
  });
});

describe('insertMergeTag', () => {
  it('replaces the in-progress fragment with the full token', () => {
    const v = 'Hi {{site.na';
    const res = insertMergeTag(v, 3, v.length, 'site.name');
    expect(res.value).toBe('Hi {{site.name}}');
    expect(res.caret).toBe(res.value.length);
  });

  it('keeps trailing text after the caret', () => {
    const v = 'Hi {{cust, welcome';
    // caret right after `{{cust`
    const res = insertMergeTag(v, 3, 9, 'customer.firstName');
    expect(res.value).toBe('Hi {{customer.firstName}}, welcome');
  });
});

describe('filterMergeTags', () => {
  const tags = emailMergeTags();

  it('returns all tags for an empty query', () => {
    expect(filterMergeTags(tags, '')).toHaveLength(tags.length);
  });

  it('ranks a path-prefix match first', () => {
    const res = filterMergeTags(tags, 'site.');
    expect(res[0]?.path.startsWith('site.')).toBe(true);
  });

  it('matches on the friendly label too', () => {
    const res = filterMergeTags(tags, 'first name');
    expect(res.some((t) => t.path === 'customer.firstName')).toBe(true);
  });
});

describe('groupMergeTags', () => {
  it('groups by source in first-seen order', () => {
    const groups = groupMergeTags(emailMergeTags());
    expect(groups[0]?.source.key).toBe('customer');
    expect(groups.every((g) => g.tags.length > 0)).toBe(true);
  });
});
