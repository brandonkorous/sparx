// Where an RSS feed's item links point (found beside sparx persona issue 064), and
// what it lists (P09).
//
// The feed fell back to `https://<slug>.sparx.works` whenever the tenant had no
// `primaryDomain` setting, which is nearly every tenant. That is the platform's own
// marketing domain and serves no tenant's site, so every link a reader followed went
// nowhere. It now asks the same helper the sitemap and the customer emails use.
//
// It also listed only blog posts unless told otherwise, so a journal whose writing
// is Articles had a feed of nothing; and it read the whole account, not the site.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const state = vi.hoisted(() => ({
  siteOff: [] as string[],
  entriesWhere: [] as unknown[],
}));

vi.mock('../../lib/property.js', () => ({
  resolvePublicPropertyId: () => Promise.resolve('site-primary'),
  resolveActivePropertyName: () => Promise.resolve('The Marrow Review'),
  siteDisabledModules: () => Promise.resolve(state.siteOff),
  contentSiteVisibilityWhere: (propertyId: string) => ({ visibleOn: propertyId }),
}));

vi.mock('@wizeworks/db', () => {
  const tx = {
    property: {
      findFirst: () => Promise.resolve({ id: 'site-primary', slug: 'primary', isPrimary: true }),
    },
    contentType: {
      findMany: () =>
        Promise.resolve([
          {
            key: 'article',
            name: 'Article',
            pluralName: 'Articles',
            urlPattern: '/articles/{slug}',
            schemaJson: {
              fields: [
                { key: 'title', type: 'text' },
                { key: 'standfirst', type: 'long_text' },
              ],
            },
          },
          {
            key: 'blog_post',
            name: 'Post',
            pluralName: 'Posts',
            urlPattern: '/blog/{slug}',
            schemaJson: { fields: [{ key: 'title', type: 'text' }] },
          },
        ]),
    },
    contentEntry: {
      findMany: (args: { where: unknown }) => {
        state.entriesWhere.push(args.where);
        return Promise.resolve([
          {
            id: 'e1',
            typeKey: 'article',
            slug: 'the-last-mill-on-the-nene',
            body: { title: 'The last mill on the Nene', standfirst: 'Seven water mills.' },
            seoJson: null,
            publishedAt: new Date('2026-10-01T05:00:00Z'),
            updatedAt: new Date('2026-10-01T05:00:00Z'),
          },
          {
            id: 'e2',
            typeKey: 'blog_post',
            slug: 'winter-fleet-checks',
            body: { title: 'Winter fleet checks' },
            seoJson: null,
            publishedAt: new Date('2026-09-30T12:00:00Z'),
            updatedAt: new Date('2026-09-30T12:00:00Z'),
          },
        ]);
      },
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
    contentSiteVisibilityWhere: (propertyId: string) => ({ visibleOn: propertyId }),
  };
});

import rssRoutes from './rss.js';

async function feed(url: string) {
  const app = Fastify();
  await app.register(rssRoutes);
  const res = await app.inject({ method: 'GET', url });
  await app.close();
  return res;
}

beforeEach(() => {
  state.siteOff = [];
  state.entriesWhere = [];
});

describe('the RSS feed links to the site, not to the platform', () => {
  it("builds every link on the site's own address", async () => {
    const res = await feed('/v1/rss.xml?tenant=gillettdiesel&type=blog_post');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(
      '<link>https://gillettdiesel.sparx.zone/blog/winter-fleet-checks</link>'
    );
    expect(res.body).toContain('<link>https://gillettdiesel.sparx.zone</link>');
    expect(res.body).not.toContain('sparx.works');
  });
});

describe('what the feed lists', () => {
  it('lists every kind of writing the site serves when no kind is named', async () => {
    const res = await feed('/v1/rss.xml?tenant=gillettdiesel');
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('/articles/the-last-mill-on-the-nene</link>');
    expect(res.body).toContain('<description>Seven water mills.</description>');
    expect(res.body).toContain('<title>The Marrow Review</title>');
    expect(res.body).toContain('href="https://gillettdiesel.sparx.zone/feed.xml"');
  });

  it("reads this site's pieces, not the whole account's", async () => {
    await feed('/v1/rss.xml?tenant=gillettdiesel');
    expect(JSON.stringify(state.entriesWhere[0])).toContain('"visibleOn":"site-primary"');
  });

  it('has no feed on a site that switched its writing off', async () => {
    state.siteOff = ['cms'];
    const res = await feed('/v1/rss.xml?tenant=gillettdiesel');
    expect(res.statusCode).toBe(404);
  });
});
