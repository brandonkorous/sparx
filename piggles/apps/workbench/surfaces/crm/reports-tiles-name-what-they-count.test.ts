// A HEADLINE FIGURE MUST BE LABELED WITH THE THING IT COUNTS.
//
// The CRM overview drew `tenantSnapshot().companies` — a plain
// `tx.company.count()` over the CRM's "businesses your customers work for or buy
// through" — under the label **Wholesale accounts**, and clicking it opened a
// pane titled **Companies**.
//
// So a shop whose retail customers happen to work for seven different firms read
// "Wholesale accounts 7" while selling wholesale to nobody. Measured when this
// was found: every tenant on the platform holding a company record had ZERO
// wholesale customers, so the figure was wrong for all of them and right for
// none.
//
// This scans the source rather than rendering, because the defect is the PAIRING
// of a label with a field, which no render can catch: both halves were correct
// on their own. It asserts its own denominator and refuses on a tile it cannot
// classify, so a rewrite that moves the tiles cannot leave it silently scanning
// nothing.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), 'reports.tsx');

/** Which snapshot field each label is allowed to draw. A label naming a
 *  DIFFERENT population than its field is the defect this file exists for. */
const EXPECTED: Record<string, string> = {
  Customers: 'customers',
  Companies: 'companies',
  'Open deals': 'openDeals',
  'Pipeline value': 'pipelineValue',
  'Open tasks': 'openTasks',
  'Overdue tasks': 'overdueTasks',
  'Active segments': 'activeSegments',
};

interface Tile {
  label: string;
  field: string;
}

/** Every `<KpiTile>` whose value comes from the tenant snapshot (`s.<field>`).
 *  Tiles fed by another query are not this file's business. */
function snapshotTiles(): Tile[] {
  const source = readFileSync(SOURCE, 'utf8');
  const out: Tile[] = [];

  // Split on the opening tag, so each chunk is one tile's props.
  const chunks = source.split('<KpiTile').slice(1);
  expect(chunks.length, 'no <KpiTile> in reports.tsx at all').toBeGreaterThan(0);

  for (const chunk of chunks) {
    const end = chunk.indexOf('/>');
    const props = end === -1 ? chunk : chunk.slice(0, end);
    if (!/\bs\?\s*\./.test(props) && !/\bs\./.test(props)) continue;

    const label = /label="([^"]+)"/.exec(props);
    const field = /\bs\.([A-Za-z]+)/.exec(props);
    // Refuse loudly rather than skipping: a tile shaped in a way this cannot
    // read is exactly the tile that would go unchecked.
    expect(
      label,
      `a snapshot tile with no literal label: ${props.trim().slice(0, 120)}`
    ).not.toBeNull();
    expect(
      field,
      `a snapshot tile with no s.<field>: ${props.trim().slice(0, 120)}`
    ).not.toBeNull();

    out.push({ label: label![1]!, field: field![1]! });
  }

  return out;
}

describe('the CRM overview tiles', () => {
  it('draw every figure the snapshot reports, and no more', () => {
    const tiles = snapshotTiles();
    // The denominator. Seven fields come back from `tenantSnapshot`, and a scan
    // that quietly found two of them would pass every check below.
    expect(tiles).toHaveLength(Object.keys(EXPECTED).length);
    expect(new Set(tiles.map((tile) => tile.field)).size).toBe(tiles.length);
  });

  it('name the population they count, not a different one', () => {
    for (const tile of snapshotTiles()) {
      expect(EXPECTED[tile.label], `no expected field for the label "${tile.label}"`).toBeDefined();
      expect(tile.field, `the "${tile.label}" tile`).toBe(EXPECTED[tile.label]);
    }
  });

  it('never calls the company count a trade figure', () => {
    // The property, stated the way the bug read on screen: `companies` counts
    // any business a customer is attached to, and nothing about it says trade.
    const companies = snapshotTiles().find((tile) => tile.field === 'companies');
    expect(companies, 'the companies tile has gone').toBeDefined();
    for (const word of ['wholesale', 'trade', 'account', 'b2b']) {
      expect(companies!.label.toLowerCase().includes(word), `"${companies!.label}"`).toBe(false);
    }
  });
});
