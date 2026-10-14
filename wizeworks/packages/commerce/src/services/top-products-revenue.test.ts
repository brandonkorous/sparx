// A best seller's sales are what its lines sold for: after their discount,
// before sales tax.
//
// The list summed each order line's `lineTotal`, which carries the line's tax.
// Web orders wrote no tax on their lines until sparx persona issue 226, so the
// list was right for them by accident; with each line keeping its own tax, Utah's
// 7.25% would have been counted as Gillett's sales.

import { describe, expect, it, vi } from 'vitest';

const groupBy = vi.fn();
const tx = {
  orderItem: { groupBy },
  product: {
    findMany: vi.fn(() =>
      Promise.resolve([{ id: 'p-rails', title: 'Bosch Fuel Rail, 6.7L Cummins (0445226044)' }])
    ),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { topProducts } = await import('./reporting-service');

describe('top products', () => {
  it('counts what the lines sold for, not the tax on them', async () => {
    // Five fuel rails at $377.88, $1,889.40, with $136.98 of tax on the line.
    groupBy.mockImplementation((args: { _sum: Record<string, boolean> }) => {
      const sums: Record<string, number> = {
        quantity: 5,
        lineSubtotal: 1889.4,
        discountAmount: 0,
        lineTotal: 2026.38,
      };
      return Promise.resolve([
        {
          productId: 'p-rails',
          _sum: Object.fromEntries(Object.keys(args._sum).map((k) => [k, sums[k] ?? null])),
        },
      ]);
    });
    const rows = await topProducts(
      { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' },
      { range: { from: '2026-10-01', to: '2026-10-31' } }
    );
    expect(rows[0]?.revenueCents).toBe(188_940);
  });

  it('takes a discount off', async () => {
    groupBy.mockImplementation(() =>
      Promise.resolve([
        {
          productId: 'p-rails',
          _sum: { quantity: 1, lineSubtotal: 42, discountAmount: 6.3, lineTotal: 35.7 },
        },
      ])
    );
    const rows = await topProducts(
      { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' },
      { range: { from: '2026-10-01', to: '2026-10-31' } }
    );
    expect(rows[0]?.revenueCents).toBe(3_570);
  });
});
