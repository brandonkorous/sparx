// One set of words for where a sale came from, kept in one file.
//
// The console had four. Devi's single till sale read "In person or by phone" on
// Money, "Added by your team" on the selling report, "Entered by your team" on
// the order itself and "Orders you enter by hand" in the price-list picker --
// same order, same $96, four answers (issue 260). Nothing was broken, nothing
// failed to build, and the same sale had four names.
//
// The words now live in lib/console/channels.ts. This fails when a screen
// starts its own table again, which is the only way the four came about last
// time: each was written by someone who could not see the other three.
//
// WHAT COUNTS AS A TABLE. An object literal whose keys are channel slugs. One
// or two slugs is a pane making a local distinction (a filter with `storefront`
// and `b2b_portal` options, say); three or more is a vocabulary, and a
// vocabulary belongs in one place.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const WORKBENCH = join(import.meta.dirname, '..', '..');
const HOUSE = join('lib', 'console', 'channels.ts');

/** The stored values. A screen naming three of these is writing a vocabulary. */
const SLUGS = new Set([
  'storefront',
  'b2b_portal',
  'admin',
  'pos',
  'subscription',
  'mcp',
  'import',
  'marketplace',
  'sparx_market',
]);

const SKIP = new Set(['node_modules', '.next', 'dist', '.turbo']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(full) && !full.endsWith('.test.ts') && !full.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

interface Table {
  file: string;
  line: number;
  slugs: string[];
}

function findTables(): { tables: Table[]; filesScanned: number } {
  const tables: Table[] = [];
  let filesScanned = 0;

  for (const file of sourceFiles(WORKBENCH)) {
    filesScanned += 1;
    const rel = file.slice(WORKBENCH.length + 1);
    if (rel === HOUSE) continue;
    const src = readFileSync(file, 'utf8');
    // Cheap reject first: a file naming no slug at all cannot hold a table.
    if (!src.includes('storefront') && !src.includes('b2b_portal')) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const keys: string[] = [];
        for (const prop of node.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const name = prop.name;
          const key = ts.isIdentifier(name)
            ? name.text
            : ts.isStringLiteral(name)
              ? name.text
              : null;
          // Only a table that maps a slug to WORDS. `{ storefront: 3 }` is a
          // tally, and `{ storefront: <Icon/> }` is an icon set; neither is a
          // second set of names for the same thing.
          if (key !== null && SLUGS.has(key) && ts.isStringLiteral(prop.initializer)) {
            keys.push(key);
          }
        }
        if (keys.length >= 3) {
          tables.push({
            file: rel.split('\\').join('/'),
            line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            slugs: keys,
          });
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return { tables, filesScanned };
}

describe('the words for where a sale came from', () => {
  const { tables, filesScanned } = findTables();

  it('scans the whole console', () => {
    // A scan that quietly reaches nothing prints the same green as a clean tree.
    expect(filesScanned).toBeGreaterThan(300);
  });

  it('live in one file, not one per screen', () => {
    expect(
      tables.map((table) => `${table.file}:${String(table.line)} [${table.slugs.join(', ')}]`),
      'these are second vocabularies for a channel; call channelLabel() instead'
    ).toEqual([]);
  });
});
