// One action, one name, on the empty screen too (persona issue 269).
//
// An empty list showed "New template" in its bar and "Write your first template"
// under the words: one action, two names (the rule of issue 743). A create
// button never says "first"; it says what the bar's button says.

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SURFACES = path.resolve(__dirname, '../../surfaces');
const FIRST = /\b(your|the) first\b/i;

function buttonWords(file: string): { line: number; words: string }[] {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: { line: number; words: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'Button') {
      const words = node.children
        .map((child) => (ts.isJsxText(child) ? child.text : ts.isJsxExpression(child) ? ' … ' : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      found.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, words });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [full] : [];
  });
}

describe('a create button on an empty screen', () => {
  it('uses the words of the button in the bar, never "your first"', () => {
    const files = tsxFiles(SURFACES);
    // The denominator: a moved folder must fail here, not scan nothing.
    expect(files.length).toBeGreaterThan(300);
    const firsts = files.flatMap((file) =>
      buttonWords(file)
        .filter((b) => FIRST.test(b.words))
        .map((b) => `${path.relative(SURFACES, file)}:${String(b.line)} "${b.words}"`)
    );
    expect(firsts).toEqual([]);
  });
});
