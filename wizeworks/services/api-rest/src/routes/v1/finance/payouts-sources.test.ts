// The payouts page settles every gateway that holds a charge (sparx persona issue 342).
//
// It kept a private list of four: Stripe, PayPal, Square and sparx Pay. A shop paid
// through Your own Stripe, Authorize.net or 1stPayGateway saw no deposits at all,
// while the comment above the list promised them the derived view. The list is now
// the one in `@wizeworks/payments`, and each console's "source" filter offers the
// same set.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GATEWAY_PROCESSORS } from '@wizeworks/payments';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const ROOT = '../../../../../../../';
const CONSOLES = [
  `${ROOT}sparx/apps/workbench/surfaces/finance/payouts-list.tsx`,
  `${ROOT}piggles/apps/workbench/surfaces/finance/payouts-list.tsx`,
];

/** The values in a console's PROCESSOR_FILTERS, without "all". */
function filterValues(source: string): string[] {
  const block = /const PROCESSOR_FILTERS = \[([\s\S]*?)\] as const;/.exec(source)?.[1] ?? '';
  return [...block.matchAll(/value: '([a-z_]+)'/g)].map((m) => m[1]!).filter((v) => v !== 'all');
}

describe('payout sources', () => {
  it('the route reads the shared list, not its own', () => {
    const route = read('./payouts.ts');
    expect(route).toContain("import { GATEWAY_PROCESSORS } from '@wizeworks/payments';");
    expect(route).not.toMatch(/const GATEWAY_PROCESSORS\s*=/);
  });

  it.each(CONSOLES)('%s offers every source the route settles', (path) => {
    expect(filterValues(read(path)).sort()).toEqual([...GATEWAY_PROCESSORS].sort());
  });
});
