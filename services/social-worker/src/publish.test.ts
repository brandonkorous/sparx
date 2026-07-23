import { describe, expect, it } from 'vitest';

import { derivePostStatus } from './publish.js';

describe('derivePostStatus', () => {
  it('is publishing while any target is still pending', () => {
    expect(derivePostStatus(['published', 'pending'])).toBe('publishing');
    expect(derivePostStatus(['publishing'])).toBe('publishing');
  });

  it('is published when every non-skipped target published', () => {
    expect(derivePostStatus(['published', 'published'])).toBe('published');
  });

  it('treats skipped opt-outs as not demoting a full success', () => {
    expect(derivePostStatus(['published', 'skipped'])).toBe('published');
  });

  it('is partially_published when some published and some failed', () => {
    expect(derivePostStatus(['published', 'failed'])).toBe('partially_published');
  });

  it('is failed when nothing published', () => {
    expect(derivePostStatus(['failed', 'failed'])).toBe('failed');
    expect(derivePostStatus(['failed', 'skipped'])).toBe('failed');
    expect(derivePostStatus(['skipped'])).toBe('failed');
  });
});
