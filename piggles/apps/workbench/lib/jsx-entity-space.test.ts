// A SENTENCE THAT STARTS AFTER A VALUE KEEPS ITS SPACE.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC.
//
// Selling › Reports read "$1,900.00in core deposits is still waiting …" (sparx
// persona issue 173). The source had the space: `{formatCents(…)} in core
// deposits is`. The compiler the consoles are built with drops the leading space
// of a JSX text that wraps onto another line AND holds an HTML entity
// (`&rsquo;`, `&rdquo;`, …); the same sentence without an entity keeps it. We do
// not own the compiler, so the rule is ours: in such a text, write the character
// itself (’ ” …), never the entity.
//
// Parsed with the TypeScript compiler, not matched with a pattern, because an
// attribute such as `className="…"` after an expression looks exactly like text
// to a regular expression.

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const WORKBENCH = path.resolve(__dirname, '..');

function tsxFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith('.tsx')) out.push(next);
    }
  };
  for (const dir of ['surfaces', 'components', 'lib', 'app']) {
    const root = path.join(WORKBENCH, dir);
    if (fs.existsSync(root)) walk(root);
  }
  return out;
}

/** JSX texts right after an expression, starting with a space on the same line,
 *  wrapping onto another line, and holding an entity: the shape that loses its
 *  space. */
function spaceLosers(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const children = node.children;
      for (let i = 1; i < children.length; i += 1) {
        const child = children[i];
        const before = children[i - 1];
        if (!child || !before || !ts.isJsxText(child) || !ts.isJsxExpression(before)) continue;
        const raw = child.getFullText(source);
        if (/^[ \t]+\S/.test(raw) && raw.includes('\n') && /&[a-zA-Z]+;/.test(raw)) {
          const line = source.getLineAndCharacterOfPosition(child.getStart(source)).line + 1;
          found.push(`${path.relative(WORKBENCH, file).replaceAll('\\', '/')}:${String(line)}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('a sentence that starts after a value', () => {
  const files = tsxFiles();

  it('scans the console', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('never holds an HTML entity, which would lose its leading space', () => {
    const losers = files.flatMap(spaceLosers);
    expect(losers, 'write the character itself (’ ” …) instead of the entity').toEqual([]);
  });
});
