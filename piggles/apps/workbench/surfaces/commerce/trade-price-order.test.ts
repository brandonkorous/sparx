// THE SCREEN'S ORDER, CHECKED AGAINST THE CODE THAT CHARGES.
//
// `STRENGTH_ORDER_SENTENCE` is a claim about what a business will be billed, and
// the pane lists its rules in that order. Nothing rendered can tell a right
// order from a wrong one, which is how the pane came to say the reverse of what
// `pricingService.resolve` does and list them that way for as long as it shipped.
//
// So this reads the charging code. A contract price must be consulted BEFORE the
// `resolve_b2b_price()` waterfall that holds the per-business and per-group
// rules, and must return the moment it finds one — that "returns first" is the
// whole of why an agreement wins, and a refactor that dropped it would leave
// this file's sentence lying without any test noticing.
//
// It also reads the pane, so the list's order and the sentence cannot drift.
// Issue 742. [[feedback_a_test_that_cannot_go_red]]
// [[feedback_structural_checks_go_blind]]

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { STRENGTH_ORDER_SENTENCE, TRADE_PRICE_STRENGTH } from './trade-price-order';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The repo root, found rather than counted: five `..`s is one tree move from
 *  scanning nothing and passing. */
function repoRoot(): string {
  let at = HERE;
  for (let up = 0; up < 12; up += 1) {
    if (existsSync(join(at, 'pnpm-workspace.yaml'))) return at;
    const parent = dirname(at);
    if (parent === at) break;
    at = parent;
  }
  throw new Error(`No pnpm-workspace.yaml above ${HERE}. This test scanned nothing.`);
}

function read(...parts: string[]): string {
  const path = resolve(repoRoot(), ...parts);
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist. This test scanned nothing.`);
  }
  return readFileSync(path, 'utf8');
}

describe('the price that actually gets charged', () => {
  const service = read(
    'wizeworks',
    'packages',
    'commerce',
    'src',
    'services',
    'pricing-service.ts'
  );

  it('consults a signed agreement before the per-business waterfall', () => {
    const contract = service.indexOf("source: 'contract_price'");
    const waterfall = service.indexOf("source: 'b2b_pricing_tier'");
    expect(contract, 'no contract_price step in pricing-service').toBeGreaterThan(-1);
    expect(waterfall, 'no b2b_pricing_tier step in pricing-service').toBeGreaterThan(-1);
    expect(contract).toBeLessThan(waterfall);
  });

  it('stops at the agreement rather than letting a later rule undercut it', () => {
    // The `return` is what makes an agreement win. Without it the per-business
    // price would be applied on top whenever it happened to be lower, and the
    // sentence on the pane would be false again.
    const contract = service.indexOf("source: 'contract_price'");
    const waterfall = service.indexOf("source: 'b2b_pricing_tier'");
    const between = service.slice(contract, waterfall);
    expect(between).toContain('return finishLine(');
  });
});

describe('the sentence the pane shows', () => {
  // The pane sits beside this test, in whichever console this copy lives in.
  const panePath = join(HERE, 'product-trade-pricing.tsx');
  if (!existsSync(panePath)) {
    throw new Error(`${panePath} does not exist. This test scanned nothing.`);
  }
  const pane = readFileSync(panePath, 'utf8').replace(/\r\n/g, '\n');

  it('is the one place the order is written down', () => {
    expect(pane).toContain('description={STRENGTH_ORDER_SENTENCE}');
  });

  it('lists the rules in the order it claims', () => {
    const agreement = pane.indexOf('data.contractPrices.map');
    const business = pane.indexOf('data.accountOverrides.map');
    const group = pane.indexOf('data.tierOverrides.map');
    expect(agreement, 'the pane does not render agreements').toBeGreaterThan(-1);
    expect(agreement).toBeLessThan(business);
    expect(business).toBeLessThan(group);
  });

  it('names them strongest first', () => {
    expect([...TRADE_PRICE_STRENGTH]).toEqual(['agreement', 'one business', 'a group']);
    const sentence = STRENGTH_ORDER_SENTENCE;
    expect(sentence.indexOf('agreement')).toBeLessThan(sentence.indexOf('one business'));
    expect(sentence.indexOf('one business')).toBeLessThan(sentence.indexOf('group'));
  });
});
