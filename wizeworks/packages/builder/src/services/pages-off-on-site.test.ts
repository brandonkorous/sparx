// The pages a site does not serve, read for the site check (persona issue 947): a journal
// that switched Selling off was told its Shop had no search title and its product page
// linked to a missing returns policy, about pages no visitor can reach.

import { describe, expect, it } from 'vitest';

import { pagesOffOnSiteTx } from './page-service';

const account = { commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true };
const journal = { commerceEnabled: false, schedulingEnabled: false, cmsEnabled: true };

const page = (id: string, slug: string, kind = 'singleton', recordType: string | null = null) => ({
  id,
  name: id,
  slug,
  kind,
  recordType,
  recordSubtype: null,
  isDefault: false,
  frameId: null,
  publishedAt: new Date(),
  position: 0,
  updatedAt: new Date(),
  createdAt: new Date(),
});

const rows = [
  page('home', '/'),
  page('shop', '/shop'),
  page('each-product', '/products/:handle', 'collection', 'commerce.product'),
  page('book', '/book'),
  page('field', 'field'),
];

const tx = {
  builderPage: {
    findMany: (args: { select?: { silicaPublishedTree?: boolean } }) =>
      Promise.resolve(
        args.select?.silicaPublishedTree
          ? rows.map((r) => ({
              id: r.id,
              silicaPublishedTree:
                r.id === 'shop'
                  ? { kind: 'host', component: 'commerce.plp' }
                  : { kind: 'element', tag: 'div' },
            }))
          : rows
      ),
  },
} as never;

const ctx = { tenantId: 't-1', propertyId: 'site-1', userId: 'u-1' };

describe('pagesOffOnSiteTx', () => {
  it('names the pages this site switched off, and only those', async () => {
    const off = await pagesOffOnSiteTx(tx, ctx, account, journal);
    expect([...off].sort()).toEqual(['book', 'each-product', 'shop']);
  });

  it('names none when the site shows everything the account has', async () => {
    expect((await pagesOffOnSiteTx(tx, ctx, account, account)).size).toBe(0);
  });
});
