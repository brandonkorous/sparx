import { describe, expect, it } from 'vitest';

import {
  collectEmailPaths,
  collectEmailSourceKeys,
  deriveCustomerNames,
  interpolateEmailTokens,
  parseEmailTokens,
} from './email-tokens';
import { seedNode } from './box-to-class';
import type { BuilderNode } from './node';

describe('parseEmailTokens', () => {
  it('extracts a bare path token', () => {
    expect(parseEmailTokens('Invoice {{invoice.number}} is due')).toEqual([
      { raw: '{{invoice.number}}', path: 'invoice.number', fallback: undefined },
    ]);
  });

  it('extracts a path + quoted fallback (double and single quotes)', () => {
    expect(parseEmailTokens('Hi {{customer.firstName ?? "there"}}')[0]).toMatchObject({
      path: 'customer.firstName',
      fallback: 'there',
    });
    expect(parseEmailTokens("Hi {{customer.firstName ?? 'friend'}}")[0]).toMatchObject({
      path: 'customer.firstName',
      fallback: 'friend',
    });
  });

  it('keeps an unquoted fallback verbatim and tolerates loose whitespace', () => {
    expect(parseEmailTokens('{{  tenant.name   ??   Our store  }}')[0]).toMatchObject({
      path: 'tenant.name',
      fallback: 'Our store',
    });
  });

  it('returns every token in order, duplicates kept', () => {
    const got = parseEmailTokens('{{a.b}} then {{c.d ?? "x"}} then {{a.b}}').map((t) => t.path);
    expect(got).toEqual(['a.b', 'c.d', 'a.b']);
  });
});

describe('interpolateEmailTokens', () => {
  const data: Record<string, unknown> = {
    customer: { firstName: 'Ada' },
    invoice: { number: 'INV-9', balance: 0 },
    tenant: { name: '' },
  };
  const resolve = (path: string): unknown =>
    path.split('.').reduce<unknown>((cur, seg) => (cur as Record<string, unknown>)?.[seg], data);

  it('substitutes a resolved value', () => {
    expect(interpolateEmailTokens('Hi {{customer.firstName}}', resolve)).toBe('Hi Ada');
  });

  it('renders a numeric value (including 0)', () => {
    expect(interpolateEmailTokens('Bal {{invoice.balance}}', resolve)).toBe('Bal 0');
  });

  it('uses the fallback when the path resolves empty/missing', () => {
    expect(interpolateEmailTokens('Hi {{customer.lastName ?? "friend"}}', resolve)).toBe(
      'Hi friend'
    );
    // An empty string is "empty" → fallback wins.
    expect(interpolateEmailTokens('{{tenant.name ?? "Our store"}}', resolve)).toBe('Our store');
  });

  it('drops a missing token with no fallback to empty string', () => {
    expect(interpolateEmailTokens('X{{nope.nope}}Y', resolve)).toBe('XY');
  });
});

describe('collectEmailPaths / collectEmailSourceKeys', () => {
  // A small tree exercising all three path carriers: a binding, tokens in string
  // props, and a conditional_block's `props.when`.
  const tree: BuilderNode = seedNode('s', 'Section', {
    layout: { direction: 'stack' },
    children: [
      seedNode('h', 'Heading', { props: { text: 'Invoice {{invoice.number}}' } }),
      seedNode('t', 'line_item_table', { bind: 'invoice.items' }),
      seedNode('c', 'conditional_block', {
        props: { when: 'b2bAccount.creditLimit' },
        children: [seedNode('p', 'Text', { props: { text: 'Limit {{b2bAccount.creditLimit}}' } })],
      }),
      seedNode('b', 'Button', { props: { label: 'Pay', href: '{{invoice.payUrl}}' } }),
    ],
  });

  it('collects binding paths, token paths, and conditional whens (with extras)', () => {
    const paths = collectEmailPaths(tree, ['Subject {{tenant.name}}']);
    expect(paths).toEqual(
      expect.arrayContaining([
        'invoice.number',
        'invoice.items',
        'b2bAccount.creditLimit',
        'invoice.payUrl',
        'tenant.name',
      ])
    );
  });

  it('reduces to the distinct source keys the resolver must load', () => {
    expect(collectEmailSourceKeys(tree, ['Subject {{tenant.name}}'])).toEqual(
      new Set(['invoice', 'b2bAccount', 'tenant'])
    );
  });
});

// The two never-blank names. These exist so a shipped template can say
// `Hi {{customer.greeting}}` instead of `Hi {{customer.firstName ?? "there"}}` — the
// second reads as developer syntax to a business owner AND is the one token shape the
// builder canvas cannot render.
describe('deriveCustomerNames', () => {
  it('fills a greeting and display name from the record', () => {
    const out = deriveCustomerNames({ customer: { firstName: 'Rosa', fullName: 'Rosa Iyer' } });
    expect(out.customer).toMatchObject({ greeting: 'Rosa', displayName: 'Rosa Iyer' });
  });

  it('falls back when the name is absent, empty, or only whitespace', () => {
    for (const customer of [{}, { firstName: '', fullName: '' }, { firstName: '   ' }]) {
      const out = deriveCustomerNames({ customer });
      expect(out.customer, JSON.stringify(customer)).toMatchObject({
        greeting: 'there',
        displayName: 'A customer',
      });
    }
  });

  it('never overwrites a value the caller already computed', () => {
    // A send that localized the greeting, or used a nickname, keeps it.
    const out = deriveCustomerNames({
      customer: { firstName: 'Rosa', greeting: 'Ro', displayName: 'Ro from Harbour' },
    });
    expect(out.customer).toMatchObject({ greeting: 'Ro', displayName: 'Ro from Harbour' });
  });

  it('leaves data with no customer scope untouched, by reference', () => {
    // Pure and allocation-free on the path that has nothing to do.
    const data = { order: { number: '1042' } };
    expect(deriveCustomerNames(data)).toBe(data);
    const weird = { customer: 'not an object' };
    expect(deriveCustomerNames(weird)).toBe(weird);
  });
});
