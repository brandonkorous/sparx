// Which hosts an email's links are tagged on (sparx persona issue 064).
//
// The site's own address used to come from `SPARX_SITE_BASE`, which nothing sets,
// so a business with no custom domain had no host to tag and every email shipped
// its links untagged: no visit or order was ever credited to an email. These drive
// the real service and the real site resolver over a faked database, with the
// setting unset.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  /** Verified/active domain rows the service lists. */
  domains: [] as { host: string }[],
}));

vi.mock('@wizeworks/db', () => {
  const tx = {
    tenant: { findUnique: () => Promise.resolve({ slug: 'bobs', settings: {} }) },
    property: {
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve({ id: 'site-parts', slug: 'primary', isPrimary: true }),
    },
    domain: {
      findFirst: () => Promise.resolve(null),
      findMany: ({ where }: { where: { type?: string } }) =>
        Promise.resolve(
          where.type === 'subdomain'
            ? [{ host: 'bobs.sparx.zone', property: { isPrimary: true } }]
            : state.domains
        ),
    },
  };
  return {
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import { resolveEmailTracking } from './email-tracking-service';

const ctx = { tenantId: 'tenant-1' };
const email = { key: 'order_confirmation', name: 'Order confirmation', trackingCampaign: null };

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.domains = [];
});

describe('resolveEmailTracking', () => {
  it("tags the site's own address when it has no custom domain", async () => {
    const tracking = await resolveEmailTracking(ctx, email, null);
    expect(tracking?.hosts).toEqual(['bobs.sparx.zone']);
  });

  it('also tags the origin the links were actually built on', async () => {
    state.domains = [{ host: 'www.bobsparts.example' }];
    const tracking = await resolveEmailTracking(ctx, email, null, 'https://counter.example');
    expect(tracking?.hosts).toEqual(['bobsparts.example', 'bobs.sparx.zone', 'counter.example']);
  });
});
