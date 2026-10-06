import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxClient } from '@wizeworks/db';
import type { PropertyContext } from '@wizeworks/builder';

const moduleStates = new Map<string, boolean>();

vi.mock('@wizeworks/auth', () => ({
  isModuleEnabled: (_tenantId: string, key: string) =>
    Promise.resolve(moduleStates.get(key) ?? false),
}));

const { linkChoices } = await import('./link-choices.js');

const CTX: PropertyContext = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  propertyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: undefined,
};

/** A `tx` that answers only the reads `linkChoices` makes and records each one, so
 *  "the module was off, so we never looked" is provable. */
function stubTx(rows: {
  entries?: { typeKey: string; slug: string | null; body: unknown }[];
  products?: { handle: string; title: string }[];
  collections?: { handle: string; name: string }[];
  categories?: { handle: string; name: string }[];
  services?: { id: string; name: string }[];
}) {
  const calls: string[] = [];
  const answer =
    <T>(name: string, list: T[] | undefined) =>
    () => {
      calls.push(name);
      return Promise.resolve(list ?? []);
    };
  const tx = {
    contentEntry: { findMany: answer('contentEntry', rows.entries) },
    product: { findMany: answer('product', rows.products) },
    productCollection: { findMany: answer('productCollection', rows.collections) },
    productCategory: { findMany: answer('productCategory', rows.categories) },
    schedulingService: { findMany: answer('schedulingService', rows.services) },
  } as unknown as TxClient;
  return { tx, calls };
}

beforeEach(() => {
  moduleStates.clear();
});

describe('linkChoices', () => {
  it('names every place a link can go, at the address the site serves it', async () => {
    moduleStates.set('cms', true);
    moduleStates.set('commerce', true);
    moduleStates.set('scheduling', true);
    const { tx } = stubTx({
      entries: [
        { typeKey: 'page', slug: 'refund-policy', body: { title: 'Refund Policy' } },
        { typeKey: 'page', slug: 'cookie-policy', body: { title: 'Cookie Policy' } },
        { typeKey: 'blog_post', slug: 'big-3', body: { title: 'We Repair The Big 3' } },
      ],
      collections: [{ handle: 'cummins', name: 'Cummins' }],
      categories: [{ handle: 'turbos', name: 'Turbochargers' }],
      products: [{ handle: 'bosch-0986435621', title: 'Bosch Remanufactured Fuel Injector' }],
      services: [{ id: 'svc-1', name: 'Diesel diagnostic' }],
    });

    const choices = await linkChoices(tx, CTX);

    expect(choices).toContainEqual({ href: '/refund-policy', label: 'Refund Policy' });
    expect(choices).toContainEqual({ href: '/blog/big-3', label: 'Post: We Repair The Big 3' });
    expect(choices).toContainEqual({ href: '/products', label: 'All products' });
    expect(choices).toContainEqual({ href: '/collections/cummins', label: 'Collection: Cummins' });
    expect(choices).toContainEqual({ href: '/category/turbos', label: 'Category: Turbochargers' });
    expect(choices).toContainEqual({
      href: '/products/bosch-0986435621',
      label: 'Product: Bosch Remanufactured Fuel Injector',
    });
    expect(choices).toContainEqual({ href: '/book/svc-1', label: 'Book: Diesel diagnostic' });
    // Policy pages are sorted by name, so the owner finds them where he looks.
    const pages = choices.filter((c) => c.href.endsWith('-policy')).map((c) => c.label);
    expect(pages).toEqual(['Cookie Policy', 'Refund Policy']);
  });

  it('offers nothing from a module that is off, and never asks for it', async () => {
    moduleStates.set('cms', true);
    const { tx, calls } = stubTx({
      entries: [{ typeKey: 'page', slug: 'refund-policy', body: { title: 'Refund Policy' } }],
      products: [{ handle: 'x', title: 'X' }],
    });

    const choices = await linkChoices(tx, CTX);

    expect(choices).toEqual([{ href: '/refund-policy', label: 'Refund Policy' }]);
    expect(calls).toEqual(['contentEntry']);
  });

  it('names an untitled page by its address rather than leaving the name blank', async () => {
    moduleStates.set('cms', true);
    const { tx } = stubTx({
      entries: [{ typeKey: 'page', slug: 'warranty', body: { title: '   ' } }],
    });

    expect(await linkChoices(tx, CTX)).toEqual([{ href: '/warranty', label: 'warranty' }]);
  });
});
