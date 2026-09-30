// The Business column on Wholesale orders. Issue 750.
//
// It was headed Business and drew the person. The business was already on the
// row — joined by the order list, typed in the console, described in the
// service's own comment as being there FOR this lens — and nothing drew it.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { orderBusiness, orderBuyer, type OrderedBy } from './wholesale-order-row';

const LOOM: OrderedBy = {
  customer: {
    firstName: 'Tamsin',
    lastName: 'Vale',
    b2bAccount: { companyName: 'Loom and Larder' },
  },
};

describe('orderBusiness', () => {
  it('names the business the order is for', () => {
    expect(orderBusiness(LOOM)).toBe('Loom and Larder');
  });

  it('is null when the row has no business on it', () => {
    expect(
      orderBusiness({ customer: { firstName: 'Jo', lastName: 'Kim', b2bAccount: null } })
    ).toBeNull();
  });

  it('is null when there is no customer at all', () => {
    expect(orderBusiness({ customer: null })).toBeNull();
  });

  it('treats a blank name as no name rather than as a business called nothing', () => {
    expect(
      orderBusiness({
        customer: { firstName: null, lastName: null, b2bAccount: { companyName: '   ' } },
      })
    ).toBeNull();
  });
});

describe('orderBuyer', () => {
  it('names who rang, under the business', () => {
    expect(orderBuyer(LOOM)).toBe('Tamsin Vale');
  });

  it('says nothing when the person IS the headline', () => {
    // No business above it, so the name is already the first line. Repeating it
    // is a row that looks like it tells you two things.
    expect(
      orderBuyer({ customer: { firstName: 'Jo', lastName: 'Kim', b2bAccount: null } })
    ).toBeNull();
  });

  it('says nothing when the business has no named buyer', () => {
    expect(
      orderBuyer({
        customer: { firstName: null, lastName: null, b2bAccount: { companyName: 'Loom' } },
      })
    ).toBeNull();
  });

  it('copes with half a name', () => {
    expect(
      orderBuyer({
        customer: { firstName: 'Tamsin', lastName: null, b2bAccount: { companyName: 'Loom' } },
      })
    ).toBe('Tamsin');
  });
});

/* ── The column actually draws it ────────────────────────────────────────── */

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error('pnpm-workspace.yaml not found above this test');
}

describe('the Wholesale orders list', () => {
  const pane = () =>
    readFileSync(join(repoRoot(), 'piggles/apps/workbench/surfaces/b2b/orders-list.tsx'), 'utf8');

  it('draws the business under a heading that promises one', () => {
    const body = pane();
    expect(body).toContain('<th className="hidden @lg:table-cell">Business</th>');
    expect(body).toContain('orderBusiness(order)');
  });

  it('still names the buyer somewhere on the row', () => {
    expect(pane()).toContain('orderBuyer(order)');
  });
});
