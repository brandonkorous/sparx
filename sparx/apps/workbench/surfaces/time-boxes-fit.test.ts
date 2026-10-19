// A time box fits its time (persona issue 285). At 128px wide, "07:30 AM" lost its
// "M" under the clock icon on Availability and Chat settings. A time box with its
// icon and padding needs 9rem (144px).

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SURFACES = path.resolve(__dirname);

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [full] : [];
  });
}

/** Tailwind max-w steps narrower than 9rem. */
const TOO_NARROW = /\bmax-w-(?:[0-9]|[12][0-9]|3[0-5]|xs\b)\b/;

describe('a time box', () => {
  it('is never capped narrower than 9rem', () => {
    const narrow: string[] = [];
    let seen = 0;
    for (const file of tsxFiles(SURFACES)) {
      const text = fs.readFileSync(file, 'utf8');
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
          const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
          const value = (name: string) => {
            const init = attrs.find((a) => a.name.getText(sf) === name)?.initializer;
            return init && ts.isStringLiteral(init) ? init.text : '';
          };
          if (value('type') === 'time') {
            seen += 1;
            if (TOO_NARROW.test(value('className'))) {
              narrow.push(`${path.relative(SURFACES, file)}: ${value('className')}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(seen).toBeGreaterThan(5);
    expect(narrow).toEqual([]);
  });
});
