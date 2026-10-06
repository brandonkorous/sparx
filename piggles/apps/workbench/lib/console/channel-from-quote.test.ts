// An order made from a quote says which quote. The conversion stamps the
// source `document:<number>` and leaves the channel `admin`, which alone read
// "Added by hand" about an order nobody typed (sparx persona issue 085).

import { describe, expect, it } from 'vitest';

import { channelLabel } from './channels';

describe('an order made from a quote', () => {
  it('names the quote it was made from', () => {
    expect(channelLabel('admin', 'document:Q-000008')).toBe('Made from Q-000008');
    expect(channelLabel('b2b_portal', 'document:Q-000006')).toBe('Made from Q-000006');
  });

  it('still says "Added by hand" for an order somebody typed in', () => {
    expect(channelLabel('admin', null)).toBe('Added by hand');
    expect(channelLabel('admin', 'document:')).toBe('Added by hand');
  });
});
