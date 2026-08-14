// Regenerates docs/150-inventory-api-reference.md from the registered routes.
//
// The inventory module publishes ~337 endpoints across 38 route files — an order
// of magnitude more than any other domain in docs/06. Transcribing that by hand
// produces a document that is wrong within a week, so the listing is DERIVED and
// the prose is not: every group's heading and description lives in GROUPS below,
// and the endpoints under it are read out of the source.
//
// Run: node scripts/gen-inventory-api-reference.mjs
// Check: node scripts/check-inventory-api-docs.mjs   (fails the build on drift)
//
// Zero dependencies on purpose, same as the other structural scripts.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROUTE_DIR = 'services/api-rest/src/routes/v1/inventory';
export const DOC = 'docs/150-inventory-api-reference.md';

/** Route file → the capability it serves, in the words a person would use.
 *  Ordered: this is the reading order of the document. A file missing from here
 *  is a hard error rather than a silent "Other" bucket — a new capability
 *  deserves a sentence from whoever added it. */
export const GROUPS = [
  [
    'api',
    'The contract-stable core',
    'The four endpoints promised not to change shape. Everything else in this document is real, supported and versioned the same way, but these are the ones an integration should build on first.',
  ],
  [
    'locations',
    'Locations',
    'The places stock physically sits — owned sites, third-party warehouses, vans, virtual locations.',
  ],
  [
    'stock',
    'Stock levels and the grid',
    'Reading and setting quantities, including the spreadsheet-style bulk grid and its CSV round trip.',
  ],
  [
    'movements',
    'The movement ledger',
    'Every change to every quantity, as an append-only record. On-hand is only ever written through this.',
  ],
  [
    'integrity',
    'Integrity — can this number be trusted',
    'Re-derives on-hand from the ledger and records where the two disagree. Never auto-corrects: a silent fix destroys the evidence.',
  ],
  ['provenance', 'Provenance', 'Where one number came from, reachable from any stock surface.'],
  ['counts', 'Counts', 'Cycle, full and opening counts, through submit → approve → post.'],
  ['schedules', 'Count schedules', 'Which items get counted how often, and what is due.'],
  [
    'transfers',
    'Transfers between locations',
    'Two-phase, so stock is conserved while it is on a van.',
  ],
  [
    'bins',
    'Bins and put-away',
    'Shelf-level positions inside a location, and where a delivery should go.',
  ],
  [
    'barcodes',
    'Barcodes',
    'The codes that make a scanner resolve to an item, including conflicts.',
  ],
  [
    'scanning',
    'Scanning',
    'Receive, count, transfer and put away from a scanner or a phone camera.',
  ],
  [
    'picking',
    'Picking and packing',
    'Pick lists, the guided pick walk, short picks, and pack verification.',
  ],
  [
    'lots',
    'Lots, serials and recalls',
    'Batch and unit traceability, expiry, and the recall lifecycle.',
  ],
  [
    'uom',
    'Units of measure',
    'Buying in cases and selling in singles, without two numbers that disagree.',
  ],
  [
    'assemblies',
    'Bills of materials and assembly',
    'What a thing is made of, how many you could build, and running a build.',
  ],
  [
    'costing',
    'Cost',
    'Moving-average and FIFO layers, landed cost, and what a delivery actually cost once freight is in.',
  ],
  ['suppliers', 'Suppliers', 'Who you buy from and the per-item purchasing links.'],
  ['purchase-orders', 'Purchase orders', 'Raising, sending, receiving and closing an order.'],
  [
    'po-approvals',
    'Purchase-order approvals',
    'Who has to sign off on what spend, and what is waiting.',
  ],
  ['receipts', 'Goods receipts', 'What actually turned up against what was ordered.'],
  [
    'advance-ship-notices',
    'Advance ship notices',
    'What a supplier says is on its way, before it arrives.',
  ],
  [
    'supplier-performance',
    'Supplier performance',
    'On-time rate, fill rate, price variance and lead-time reliability.',
  ],
  ['supplier-returns', 'Supplier returns', 'Stock sent back, and the credits still owed for it.'],
  ['supplier-bills', 'Supplier bills', 'Matching an invoice to what was received.'],
  ['reorder', 'Reordering', 'What to buy today, and the suggested orders that follow from it.'],
  ['planning', 'Planning', 'Stockout risk, slow movers, holding cost, and the policy behind them.'],
  [
    'demand',
    'Demand and forecasting',
    'Consumption history, forecasts, and the commitments already made against stock.',
  ],
  [
    'classifications',
    'Value and predictability',
    'Which items are worth attention, and which have demand steady enough to forecast.',
  ],
  ['backorders', 'Backorders', 'What has been promised and cannot yet be shipped.'],
  [
    'reporting',
    'Reports',
    'The report registry — one code path shared by the export button, the scheduler and an assistant.',
  ],
  ['analytics-reports', 'Analytics reports', 'Valuation, turnover, ageing and dead stock.'],
  ['reports', 'Report delivery', 'Scheduled report sends and their history.'],
  [
    'accounting',
    'Accounting',
    'Journals, the GL reconciliation, and the connectors that carry them out.',
  ],
  [
    'sources',
    'External stock feeds',
    'ERP and WMS feeds into the one ledger, and whether each is still telling the truth.',
  ],
  ['sync', 'Feed sync', 'Running a sync and reading its outcome.'],
  [
    'onboarding',
    'Getting set up',
    'The guided setup, spreadsheet import with column mapping, opening balances and tenant-defined columns.',
  ],
  ['agent', 'Bridge agent', 'Enrolment and heartbeat for the on-premise bridge.'],
  ['links', 'Deep links', 'Addresses that open a specific inventory surface in the workbench.'],
];

const METHOD_RX = /app\.(get|post|patch|put|delete)\(\s*'(\/v1\/inventory[^']*)'/g;

/** Every registered inventory endpoint, keyed by route-file basename. */
export function readRoutes(root = repoRoot) {
  const dir = join(root, ROUTE_DIR);
  const byFile = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(dir, file), 'utf8');
    const rows = [];
    let match;
    METHOD_RX.lastIndex = 0;
    while ((match = METHOD_RX.exec(source)) !== null) {
      rows.push({ method: match[1].toUpperCase(), path: match[2] });
    }
    if (rows.length > 0) byFile.set(file.replace(/\.ts$/, ''), rows);
  }
  return byFile;
}

/** Stable ordering so a regeneration produces no spurious diff. */
const METHOD_ORDER = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };
function sortRows(rows) {
  return [...rows].sort(
    (a, b) => a.path.localeCompare(b.path) || METHOD_ORDER[a.method] - METHOD_ORDER[b.method]
  );
}

function build(byFile) {
  const known = new Set(GROUPS.map(([key]) => key));
  const missing = [...byFile.keys()].filter((k) => !known.has(k));
  if (missing.length > 0) {
    throw new Error(
      `gen-inventory-api-reference: no group described for ${missing.join(', ')}.\n` +
        `Add an entry to GROUPS in scripts/gen-inventory-api-reference.mjs — a new capability ` +
        `needs a sentence saying what it is for, which cannot be derived from the code.`
    );
  }

  const total = [...byFile.values()].reduce((n, rows) => n + rows.length, 0);
  const lines = [];
  lines.push('# sparx Platform — Inventory API Reference');
  lines.push('');
  lines.push('**Version:** 1.0');
  lines.push('**Author:** Brandon Korous');
  lines.push('**Last Updated:** 2026-08-13');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## What this is');
  lines.push('');
  lines.push(
    `The complete inventory HTTP surface — **${total} endpoints across ${byFile.size} route files**. ` +
      'It lives here rather than in [docs/06](06-api-specification.md) because inventory is an order ' +
      'of magnitude larger than any other domain in that document, and burying the whole platform ' +
      'API under one module would make the spec unusable. docs/06 §7 carries the contract-stable ' +
      'core and a description of every group below; this is the exhaustive list.'
  );
  lines.push('');
  lines.push(
    '**This file is generated.** Run `node scripts/gen-inventory-api-reference.mjs` after adding a ' +
      'route; `node scripts/check-inventory-api-docs.mjs` fails the build when it drifts. Do not ' +
      'hand-edit the endpoint tables — edit `GROUPS` in the generator for the prose.'
  );
  lines.push('');
  lines.push('## Conventions');
  lines.push('');
  lines.push(
    '- Every endpoint is gated on the `inventory` module flag. A disabled module returns ' +
      '`404 MODULE_DISABLED` rather than pretending the data is empty.'
  );
  lines.push(
    '- Reads need `read:inventory`, writes need `write:inventory` for a programmatic key ' +
      '(`Authorization: Bearer sk_live_…`). Staff sessions are gated by role instead — `viewer` ' +
      'reads, `editor` writes, and a few settings surfaces require `admin`.'
  );
  lines.push(
    '- Every write that changes a quantity goes through the movement ledger, so it is ' +
      'concurrency-safe, idempotent and attributed. There is no path that edits on-hand directly.'
  );
  lines.push('- Responses use the standard envelope and pagination described in docs/06 §4–§5.');
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const [key, title, blurb] of GROUPS) {
    const rows = byFile.get(key);
    if (!rows) continue;
    lines.push(`## ${title}`);
    lines.push('');
    lines.push(blurb);
    lines.push('');
    lines.push('```');
    for (const row of sortRows(rows)) {
      lines.push(`${row.method.padEnd(7)} ${row.path}`);
    }
    lines.push('```');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(`- Routes: \`${ROUTE_DIR}\``);
  lines.push('- Capability plan: [docs/146](146-inventory-parity-and-gap-closure.md)');
  lines.push('- Platform API spec: [docs/06](06-api-specification.md)');
  lines.push('');
  return lines.join('\n');
}

export function render(root = repoRoot) {
  return build(readRoutes(root));
}

// Only write when run directly.
if (process.argv[1] && process.argv[1].endsWith('gen-inventory-api-reference.mjs')) {
  const text = render();
  writeFileSync(join(repoRoot, DOC), text, 'utf8');
  const count = text.split('\n').filter((l) => /^(GET|POST|PUT|PATCH|DELETE)\s/.test(l)).length;
  console.log(`gen-inventory-api-reference: wrote ${DOC} — ${count} endpoints`);
}
