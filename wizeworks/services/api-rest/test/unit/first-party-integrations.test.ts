import { describe, expect, it } from 'vitest';
import { PLATFORM_TOKEN } from '@wizeworks/brand-core';
import { bootstrapProviders } from '../../src/lib/providers-bootstrap.js';
import { firstPartyIntegrations } from '../../src/lib/marketplace/first-party-integrations.js';

// The marketplace shelf is DERIVED from the integration registry. Two ways it went
// wrong (sparx persona issue 035): a filter that kept only `'sparx'` while the
// shared packages had moved to the `{platform}` token, so the shelf listed five
// dropship integrations and nothing else; and a CLI that never filled the
// registry, so the shelf read empty and retracted itself.

describe('first-party integration listings', () => {
  bootstrapProviders();
  const listings = firstPartyIntegrations();
  const categories = new Set(listings.map((l) => l.providerSlug.split(':')[0]));

  it('lists every category the platform registers, not only dropship', () => {
    for (const category of ['payments', 'shipping', 'social', 'dropship']) {
      expect(categories, category).toContain(category);
    }
  });

  it('never publishes the brand token unfilled', () => {
    for (const l of listings) {
      const text = [l.name, l.tagline, l.description, ...l.scopes].join(' ');
      expect(text, l.slug).not.toContain(PLATFORM_TOKEN);
    }
  });
});
