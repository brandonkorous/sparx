// EVERY KIND A SCAN CAN BE HAS SOMETHING THAT LOOKS IT UP.
//
// `ALL_KINDS` is the list the resolver advertises: it is what `expect` is
// validated against, what the MCP tool offers, and what the console's match
// cards switch on. A kind can be missing from it while the rest of the platform
// behaves as though it is there, and nothing goes red — which is what happened
// to `pick_list`:
//
//   · `document-label.tsx` printed a Code 128 on a walk sheet under the words
//     "Scanning it in warehouse mode opens this pick list straight away".
//   · `warehouse-mode.tsx` explained that the Pick job is deliberately not
//     scan-first BECAUSE "scanning a printed walk sheet still works: it resolves
//     through the Look-it-up job like any other document".
//
// Neither was true. The scan came back "Nothing matches PICK-000003", with the
// advice "if this is something you stock, add the code to the item".
// [[feedback_a_promise_in_copy_is_a_contract]]
//
// This reads the source rather than the database, for the reason
// `pick-expiry-gate.test.ts` does: the behaviour needs a tenant and rows, and CI
// skips the DB suites. The denominator is asserted so it cannot go green over a
// scan that found nothing. [[feedback_structural_checks_go_blind]]

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ALL_KINDS } from './scan';

const SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'scan.ts'), 'utf8');

/** The kinds the `documents` table-driven block queries for. */
function documentKinds(src: string): string[] {
  const block = /const documents: \{[\s\S]*?\n {4}\];/.exec(src)?.[0] ?? '';
  return [...block.matchAll(/kind: '([a-z_]+)'/g)].map((m) => m[1] ?? '');
}

/** The kinds handled by a branch of their own, outside the documents block. */
function branchKinds(src: string): string[] {
  return [...src.matchAll(/wanted\.has\('([a-z_]+)'\)/g)].map((m) => m[1] ?? '');
}

describe('every scan kind can actually be resolved', () => {
  it('advertises the nine kinds', () => {
    expect(ALL_KINDS).toEqual([
      'variant',
      'bin',
      'purchase_order',
      'goods_receipt',
      'transfer',
      'count',
      'pick_list',
      'lot',
      'serial',
    ]);
  });

  it('queries for five document kinds, pick lists among them', () => {
    const kinds = documentKinds(SOURCE);
    expect(kinds.length).toBe(5);
    expect(kinds).toContain('pick_list');
  });

  it('leaves no advertised kind without a lookup', () => {
    const covered = new Set([...documentKinds(SOURCE), ...branchKinds(SOURCE)]);
    // `variant` is the first path and is not gated on `wanted.has` the same way.
    covered.add('variant');
    expect(branchKinds(SOURCE).length).toBeGreaterThanOrEqual(3);
    const missing = ALL_KINDS.filter((k) => !covered.has(k));
    expect(missing).toEqual([]);
  });

  it('is the one list: the REST route and the MCP tool must not re-declare it', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const mcp = readFileSync(join(here, '..', 'mcp', 'scan-tools.ts'), 'utf8');
    expect(mcp).not.toMatch(/const SCAN_KINDS = \[/);
    expect(mcp).toMatch(/ALL_KINDS/);
  });
});
