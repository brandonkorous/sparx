// No route a buyer can call names a line's cost or margin (sparx persona issue 086).
//
// Every quote line keeps what it cost the business so staff see their margin as
// they price. These routes answer shoppers and trade buyers, so none of them may
// so much as select those fields. Read with the TypeScript parser, so a comment
// explaining the rule does not trip it; only code that touches the field does.

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname);

/** The staff-only fields on a billing line, and the margin worked out from them. */
const STAFF_ONLY = new Set([
  'costCents',
  'cost_cents',
  'explicitCostCents',
  'appliedMarkup',
  'applied_markup',
  'marginPct',
  'markupPct',
  'costBasisValueCents',
]);

function routeFiles(): string[] {
  return fs
    .readdirSync(ROOT)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => path.join(ROOT, name));
}

/** Every staff-only name a file's CODE uses, as `file:line name`. */
function uses(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && STAFF_ONLY.has(node.text)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      found.push(`${path.basename(file)}:${String(line + 1)} ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('public routes', () => {
  it('are where this test looks for them', () => {
    // A moved folder must fail here rather than scan nothing and pass.
    expect(fs.existsSync(path.join(ROOT, 'b2b-portal.ts'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'estimates.ts'))).toBe(true);
    expect(routeFiles().length).toBeGreaterThan(20);
  });

  it('never read or send what a line cost, or its margin', () => {
    expect(routeFiles().flatMap(uses)).toEqual([]);
  });
});
