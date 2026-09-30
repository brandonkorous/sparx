// Expired stock must never be chosen, whatever the warehouse's strategy is.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// `resolveFefoLot` is the ONLY thing anywhere in the sell path that excludes an
// expired or recalled batch — grep the package for `expires_at > now()` and it
// is the single hit. It was called like this:
//
//     const lot = input.strategy === 'fefo' ? await resolveFefoLot(...) : null;
//
// MEASURED 2026-09-19 on the local database: **87 of 87 warehouses are `fifo`**
// and not one is `fefo`. So the exclusion had never run for any tenant, while 4
// expired batches holding 137 units sat in those warehouses, fully shippable.
//
// Meanwhile "Expiring stock" showed the owner a red alert reading:
//
//     "That stock is excluded from picking automatically, so nothing will ship
//      it, but it is still counted as stock you own until somebody writes it
//      off."
//
// A promise in copy is a contract, and this one was kept for a configuration
// that does not exist. [[feedback_a_promise_in_copy_is_a_contract]]
// [[feedback_screen_over_a_function_nobody_calls]]
//
// ── Why the source, and not a behavioral test ────────────────────────────────
//
// Allocation needs a transaction, so a behavioral test is one of the DB suites
// CI skips — which is how a `fefo`-only guard survives a green run. This reads
// the file, the same way `adjustment-import-columns.test.ts` does, and asserts
// the source it found is not empty so it cannot quietly cover nothing.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'pick-allocation.ts'),
  'utf8'
);

/** Comments discuss the old gate on purpose; the code must not reinstate it. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');

describe('the expiry exclusion is not a strategy preference', () => {
  it('reads the file it is asserting about', () => {
    expect(source.length).toBeGreaterThan(2000);
    expect(code).toContain('resolveFefoLot');
  });

  it('calls the lot resolver without asking what the strategy is', () => {
    // The resolver itself is what drops expired and recalled batches. A caller
    // that only reaches it for one strategy leaves every other warehouse with
    // no expiry check at all.
    const call = /const lot =([\s\S]{0,400}?)resolveFefoLot\(/.exec(code);
    expect(call, 'allocationsForOrderLine no longer resolves a lot').not.toBeNull();
    expect(call?.[1]).not.toMatch(/strategy/);
  });

  it('still drops expired and recalled batches in the resolver', () => {
    // If these ever leave the query, the caller being ungated protects nothing.
    expect(code).toContain('expires_at > now()');
    expect(code).toMatch(/recall_status IS NULL OR recall_status = 'cleared'/);
  });
});
