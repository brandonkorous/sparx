import { describe, expect, it } from 'vitest';

import { cookiePolicyNote } from './cookie-banner-data';

const off = { mode: 'off' } as Parameters<typeof cookiePolicyNote>[2];

describe('cookiePolicyNote', () => {
  it('warns when a published policy promises a banner the site does not show', () => {
    expect(cookiePolicyNote('cookie-policy', 'published', off, true)).toContain('cookie banner');
  });

  it('says nothing about a policy that promises no banner (persona issue 947)', () => {
    expect(cookiePolicyNote('cookie-policy', 'published', off, false)).toBeNull();
  });
});
