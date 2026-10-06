// Where an RSS feed's item links point (found beside sparx persona issue 064).
//
// The feed fell back to `https://<slug>.sparx.works` whenever the tenant had no
// `primaryDomain` setting, which is nearly every tenant. That is the platform's own
// marketing domain and serves no tenant's site, so every link a reader followed went
// nowhere. It now asks the same helper the sitemap and the customer emails use.

import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

vi.mock('@wizeworks/db', () => {
  const tx = {
    property: {
      findFirst: () => Promise.resolve({ id: 'site-primary', slug: 'primary', isPrimary: true }),
    },
    contentType: {
      findFirst: () =>
        Promise.resolve({
          key: 'blog_post',
          name: 'Post',
          pluralName: 'Posts',
          urlPattern: '/blog/{slug}',
        }),
    },
    contentEntry: {
      findMany: () =>
        Promise.resolve([
          {
            id: 'e1',
            slug: 'winter-fleet-checks',
            body: { title: 'Winter fleet checks' },
            seoJson: null,
            publishedAt: new Date('2026-09-30T12:00:00Z'),
            updatedAt: new Date('2026-09-30T12:00:00Z'),
          },
        ]),
    },
  };
  return {
    prisma: {
      tenant: {
        findUnique: () =>
          Promise.resolve({ id: 't1', slug: 'gillettdiesel', name: 'Gillett', settings: {} }),
      },
      domain: { findFirst: () => Promise.resolve(null), findMany: () => Promise.resolve([]) },
    },
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import rssRoutes from './rss.js';

describe('the RSS feed links to the site, not to the platform', () => {
  it("builds every link on the site's own address", async () => {
    const app = Fastify();
    await app.register(rssRoutes);
    const res = await app.inject({ method: 'GET', url: '/v1/rss.xml?tenant=gillettdiesel' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(
      '<link>https://gillettdiesel.sparx.zone/blog/winter-fleet-checks</link>'
    );
    expect(res.body).toContain('<link>https://gillettdiesel.sparx.zone</link>');
    expect(res.body).not.toContain('sparx.works');
    await app.close();
  });
});
