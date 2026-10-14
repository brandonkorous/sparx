// A starter page the owner deleted stays deleted (persona issue 947): a journal deleted
// the design's blog page and the list made it again within the second.

import { describe, expect, it } from 'vitest';

import {
  isStarterAddress,
  rememberRemovedStarterTx,
  removedStarterPaths,
  settleRemovedStartersTx,
} from './removed-starters';

function fakeTx(settings: Record<string, unknown>) {
  const state = { settings };
  const tx = {
    property: {
      findUnique: () => Promise.resolve({ settings: state.settings }),
      update: ({ data }: { data: { settings: Record<string, unknown> } }) => {
        state.settings = data.settings;
        return Promise.resolve({});
      },
    },
  } as never;
  return { tx, state };
}

const ctx = { tenantId: 't-1', propertyId: 'site-1', userId: 'u-1' };

describe('isStarterAddress', () => {
  it('is the blog and about pages the platform serves with no page there', () => {
    expect(isStarterAddress('/blog')).toBe(true);
    expect(isStarterAddress('about')).toBe(true);
  });

  it('is never the home page, a page of her own, or one of the site’s own routes', () => {
    expect(isStarterAddress('/')).toBe(false);
    expect(isStarterAddress('contributors')).toBe(false);
    expect(isStarterAddress('/cart')).toBe(false);
    expect(isStarterAddress('/search')).toBe(false);
  });
});

describe('removed starter pages', () => {
  it('remembers a deleted starter address once, and keeps other settings', async () => {
    const { tx, state } = fakeTx({ contact: { email: 'editors@marrowreview.co.uk' } });
    await rememberRemovedStarterTx(tx, ctx, '/blog');
    await rememberRemovedStarterTx(tx, ctx, 'blog');
    await rememberRemovedStarterTx(tx, ctx, 'contributors');
    expect(removedStarterPaths(state.settings)).toEqual(['blog']);
    expect(state.settings.contact).toEqual({ email: 'editors@marrowreview.co.uk' });
  });

  it('forgets an address once she makes a page there again', async () => {
    const { tx, state } = fakeTx({ removedPages: ['blog', 'about'] });
    const still = await settleRemovedStartersTx(tx, ctx, [{ slug: '/about' }, { slug: 'field' }]);
    expect(still).toEqual(['blog']);
    expect(removedStarterPaths(state.settings)).toEqual(['blog']);
  });
});
