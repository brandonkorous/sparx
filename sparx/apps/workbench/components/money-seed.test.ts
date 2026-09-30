// A money field holds the same text before it is touched as after.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// `MoneyTextInput` settles itself on BLUR, and only on blur:
//
//     onBlur={() => { onTextChange(settleMoney(text, { allowZero: true })); }}
//
// So whatever a screen seeds it with is what an operator reads until they click
// into the field. "Spending limits" seeded it with
// `(existing.minAmountCents / 100).toString()`, and the list one screen away
// printed the same amount through `formatCents`. One said **$200.00** and the
// other said **200**, for the same number, and neither was wrong on its own.
//
// It is worse than untidy on a bill. `(123450 / 100).toString()` is `"1234.5"` —
// ONE decimal place, beside a piece of paper that says 1,234.50. A person
// checking a supplier bill against its invoice reads that as a truncated number
// and goes looking for the missing digit.
//
// MEASURED 2026-09-19 across both consoles: 18 places seed a money field from a
// stored amount. 10 already settled it; 8 did not, and they were the same four
// files on each side. The rule was the house pattern already and four screens
// were the exception. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── The rule ─────────────────────────────────────────────────────────────────
//
// Seed a money field through `moneyText(cents)`. Never divide by 100 in a
// surface: that is a second definition of what a money field holds, and the two
// only have to disagree in the last digit to cost somebody an afternoon.
//
// ── Why the source, and not a rendering test ─────────────────────────────────
//
// The failure is not in the component — `MoneyTextInput` is correct, and a test
// of it passes either way. It is in what 24 different surfaces HAND it, and each
// one needs its own query, its own fixture and a server. So this reads the
// files, the way `pick-expiry-gate.test.ts` does, and asserts it found a real
// number of them so it cannot go green over an empty scan.
// [[feedback_structural_checks_go_blind]]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { moneyText } from '../lib/read-money';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURFACES = resolve(HERE, '..', 'surfaces');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Anything turning a stored cents value into text, in a file that has a money
 *  field. The name carries the unit, which is why it can be found at all. */
const SEED =
  /([A-Za-z_$][\w.$?[\]]*[Cc]ents[\w.$?[\]]*)\s*\/\s*100\s*\)?\s*\)?\s*\.(toString|toFixed)\(\s*(\d*)\s*\)/g;

interface Seed {
  where: string;
  expr: string;
  settled: boolean;
}

/** Files that actually have a money field. The real denominator: the seeds
 *  below are only the ones that came from a stored amount, and a console can
 *  legitimately have few of those while having plenty of fields. */
function filesWithMoneyField(): string[] {
  return walk(SURFACES).filter((file) => readFileSync(file, 'utf8').includes('MoneyTextInput'));
}

function moneySeeds(): Seed[] {
  const seeds: Seed[] = [];
  for (const file of filesWithMoneyField()) {
    const source = readFileSync(file, 'utf8');
    const where = relative(SURFACES, file).split(sep).join('/');
    source.split('\n').forEach((line, i) => {
      for (const match of line.matchAll(SEED)) {
        seeds.push({
          where: `${where}:${String(i + 1)}`,
          expr: match[0],
          // `.toFixed(2)` is the same answer `moneyText` gives, spelled out. It
          // is allowed rather than encouraged: what must never happen is a
          // shape the field would not leave.
          settled: match[2] === 'toFixed' && match[3] === '2',
        });
      }
    });
  }
  return seeds;
}

describe('moneyText', () => {
  it('always gives two decimals, whatever the amount', () => {
    expect(moneyText(20000)).toBe('200.00');
    expect(moneyText(123450)).toBe('1234.50');
    expect(moneyText(0)).toBe('0.00');
    expect(moneyText(5)).toBe('0.05');
    expect(moneyText(-2500)).toBe('-25.00');
  });

  it('gives a real amount rather than NaN for a missing figure', () => {
    // A field reading "NaN" is worse than one reading nothing, and a stored
    // amount that failed to load is exactly when it would happen.
    expect(moneyText(Number.NaN)).toBe('0.00');
  });

  it('is what `.toString()` is NOT, which is the whole point', () => {
    expect((20000 / 100).toString()).toBe('200');
    expect((123450 / 100).toString()).toBe('1234.5');
  });
});

describe('every money field is seeded settled', () => {
  it('scans a real set of surfaces', () => {
    // The denominator. A moved `surfaces` directory would find nothing and pass
    // the assertion below without having looked at anything.
    expect(walk(SURFACES).length).toBeGreaterThan(200);
    expect(filesWithMoneyField().length).toBeGreaterThanOrEqual(10);
    expect(moneySeeds().length).toBeGreaterThanOrEqual(3);
  });

  it('never hands a money field a shape it would not leave', () => {
    const unsettled = moneySeeds().filter((seed) => !seed.settled);
    expect(
      unsettled.map((seed) => `${seed.where}  ${seed.expr}`),
      'seed it with moneyText(cents) instead'
    ).toEqual([]);
  });
});
