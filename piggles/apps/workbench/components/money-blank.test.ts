// A money field never draws a missing amount as zero (sparx persona issue 086).
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// The Pricing tab drew "What it cost you" and "Was" like this:
//
//     <MoneyInput value={draft.cost ?? 0}
//       onValueChange={(next) => onChange({ cost: next === 0 ? null : next })} />
//
// `MoneyInput` took a plain number, so a cost nobody had entered had to be
// turned into one, and the only number to hand was zero. All 777 of Gillett
// Diesel's versions have no cost on record and every one read 0.00, which is a
// cost of nothing, measured. The way back was wrong the other way: a typed 0
// became "not set", so a part that really did cost nothing could never be saved
// as one. Margin is worked out from that box, so both mistakes reach a figure
// somebody makes decisions on. [[feedback_never_present_absence_as_measurement]]
//
// ── The rule ─────────────────────────────────────────────────────────────────
//
// An amount that can be missing goes in as `<MoneyInput optional value={x}>`,
// which shows null as an empty box, reports a cleared box as null and a typed 0
// as 0. Never `value={x ?? 0}`.
//
// ── Why the source ───────────────────────────────────────────────────────────
//
// The component is right either way; the defect is in what a surface hands it.
// So this reads every surface, the way `money-seed.test.ts` does, and counts the
// fields it found so it cannot go green over an empty scan.
// [[feedback_structural_checks_go_blind]]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURFACES = resolve(HERE, '..', 'surfaces');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

interface Field {
  where: string;
  label: string;
  value: string;
  optional: boolean;
}

/** The text of one `<MoneyInput … />`, read to its own closing `/>` by brace
 *  depth, so an arrow function's `=>` inside a prop does not end it early. */
function element(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (depth === 0 && ch === '/' && source[i + 1] === '>') return source.slice(start, i + 2);
  }
  return source.slice(start);
}

/** The expression inside `name={…}`, or a quoted `name="…"`, or null. */
function prop(text: string, name: string): string | null {
  const at = text.search(new RegExp(String.raw`\s${name}=`));
  if (at < 0) return null;
  const open = text.indexOf('=', at) + 1;
  if (text[open] === '"') return text.slice(open + 1, text.indexOf('"', open + 1));
  if (text[open] !== '{') return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i).trim();
    }
  }
  return null;
}

function moneyFields(): Field[] {
  const fields: Field[] = [];
  for (const file of walk(SURFACES)) {
    const source = readFileSync(file, 'utf8');
    const where = relative(SURFACES, file).split(sep).join('/');
    for (const match of source.matchAll(/<MoneyInput\b/g)) {
      const text = element(source, match.index);
      fields.push({
        where,
        label: prop(text, 'aria-label') ?? '(no label)',
        value: prop(text, 'value') ?? '',
        optional: /\soptional(\s|=\{true\}|\/>)/.test(text),
      });
    }
  }
  return fields;
}

/**
 * Where zero and "none" are ONE answer by design, so 0.00 is the truth.
 *
 * A core deposit of zero is refused by the server ("Clear it instead to take no
 * core"), and the line editor sends a zero as no deposit. A box reading 0.00
 * there says "no deposit", which is exactly what is stored.
 */
const ZERO_IS_NONE = new Set(['Core deposit per unit']);

describe('a money field that can be missing', () => {
  it('scans a real set of money fields', () => {
    // The denominator. A moved `surfaces` directory, or a renamed component,
    // would find nothing and pass the assertion below without looking.
    expect(moneyFields().length).toBeGreaterThanOrEqual(25);
  });

  it('is never handed zero in place of nothing', () => {
    const coerced = moneyFields().filter(
      (field) => /\?\?\s*0$/.test(field.value) && !ZERO_IS_NONE.has(field.label)
    );
    expect(
      coerced.map((field) => `${field.where}  ${field.label}  value={${field.value}}`),
      'pass `optional` and the nullable value instead'
    ).toEqual([]);
  });

  it('on the Pricing tab, cost and was-price can each be left blank', () => {
    const pricing = moneyFields().filter((field) => field.where === 'commerce/product-pricing.tsx');
    const byLabel = new Map(pricing.map((field) => [field.label, field]));
    expect(byLabel.get('Cost')?.optional).toBe(true);
    expect(byLabel.get('Was price')?.optional).toBe(true);
    // And the price itself cannot: every version has one.
    expect(byLabel.get('Price')?.optional).toBe(false);
  });
});
