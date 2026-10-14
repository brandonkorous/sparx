// The till really uses the core and tax helpers: the lines go through
// saleItem, the handover skips a part held for its old part, the total is asked
// WITH the deposits and the sales tax. Moved out of sale-core.test.ts when the
// till was split into smaller files (sparx persona issue 230).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

describe('the till', () => {
  const read = (file: string) =>
    readFileSync(join(repoRoot(), 'piggles/apps/workbench/surfaces/commerce', file), 'utf8');

  it('posts every line through saleItem', () => {
    expect(read('sale-take.ts')).toContain("api.post<Order>('/v1/orders', saleOrderBody(input))");
    expect(read('sale-order-body.ts')).toContain(
      'items: input.lines.map((line) => saleItem(line, tax.get(line.id) ?? 0))'
    );
  });

  it('hands over only what is not waiting for its old part', () => {
    expect(read('sale-take.ts')).toContain('handedOverNow(order.items ?? [])');
  });

  it('asks for the total WITH the deposits and the tax', () => {
    expect(read('use-counter-sale.ts')).toContain(
      'saleTotals(lines, tax.quote?.totalTaxCents ?? 0)'
    );
    expect(read('use-counter-sale.ts')).toContain('total: totals.total');
  });

  it('adds the core deposit into what a made-to-order sale asks for', () => {
    expect(read('sale-made-to-order.ts')).toContain('asked += lineCoreDeposit(line);');
  });

  it('carries the core onto a line picked off the list', () => {
    expect(read('sale-line-from.ts')).toContain('core: sellable.core');
  });
});
