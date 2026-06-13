import { describe, expect, it } from 'vitest';

import {
  collectEmailPaths,
  collectEmailSourceKeys,
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
