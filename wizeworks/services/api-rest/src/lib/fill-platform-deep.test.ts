import { describe, expect, it } from 'vitest';
import { fillDeep } from './fill-platform-deep.js';

describe('fillDeep', () => {
  it('fills the brand name in every string, at any depth', () => {
    const filled = fillDeep(
      {
        displayName: '{platform} Shipping',
        vendor: '{platform}',
        configSchema: { fields: [{ label: 'Your {platform} key', required: true }] },
        tags: ['by {platform}'],
        rank: 3,
        logo: null,
      },
      'sparx'
    );
    expect(filled).toEqual({
      displayName: 'sparx Shipping',
      vendor: 'sparx',
      configSchema: { fields: [{ label: 'Your sparx key', required: true }] },
      tags: ['by sparx'],
      rank: 3,
      logo: null,
    });
  });

  it('leaves text without the token as it was', () => {
    expect(fillDeep('Stripe', 'sparx')).toBe('Stripe');
  });
});
