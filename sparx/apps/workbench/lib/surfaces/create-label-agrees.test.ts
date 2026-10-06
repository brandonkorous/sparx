// A LIST'S OWN CREATE BUTTON SAYS WHAT ITS `+` SAYS.
//
// Every list pane wrote its own button text, and nothing compared it with the
// `+` beside its nav row. Measured in the Piggles console for issue 743, ten
// lists offered one action under two names, "New pipeline" on the rail and "New
// process" on the pane. This console had the same shape, so it has the same
// guard; here the rail's words are the catalog's own.
//
// The rule, as a test. A list counts as having its own create control when one
// of its files opens the create surface with `'new'`; such a list must show the
// rail's words, either through `createLabelFor(key)` or as the same text. A list
// with no button of its own is skipped rather than failed, because the rail's
// `+` is its only way in and that is fine. Read with the TypeScript parser, not
// a regex, and every root is asserted to exist, so a moved folder fails here
// instead of scanning nothing. [[feedback_structural_checks_go_blind]]

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const WORKBENCH = path.resolve(__dirname, '../..');
const CATALOG = path.join(WORKBENCH, 'lib/surfaces/catalog');
const SURFACES = path.join(WORKBENCH, 'surfaces');

/** The rail's words for a list. This console has no brand layer over the
 *  catalog, so they are the catalog's. */
function railLabel(_key: string, catalogLabel: string | undefined): string | undefined {
  return catalogLabel;
}

interface CreateRow {
  key: string;
  createSurface: string;
  label: string;
  paneFile: string;
}

function stringProp(node: ts.ObjectLiteralExpression, name: string): string | undefined {
  for (const prop of node.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === name &&
      ts.isStringLiteralLike(prop.initializer)
    ) {
      return prop.initializer.text;
    }
  }
  return undefined;
}

function identifierProp(node: ts.ObjectLiteralExpression, name: string): string | undefined {
  for (const prop of node.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === name &&
      ts.isIdentifier(prop.initializer)
    ) {
      return prop.initializer.text;
    }
  }
  return undefined;
}

function resolveModule(fromDir: string, spec: string): string | undefined {
  const base = path.resolve(fromDir, spec);
  return [
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
  ].find((candidate) => fs.existsSync(candidate));
}

function catalogRows(): CreateRow[] {
  const rows: CreateRow[] = [];
  for (const name of fs.readdirSync(CATALOG).filter((file) => file.endsWith('.ts'))) {
    const file = path.join(CATALOG, name);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
    const imports = new Map<string, string>();
    for (const statement of source.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        for (const element of statement.importClause.namedBindings.elements) {
          imports.set(element.name.text, statement.moduleSpecifier.text);
        }
      }
    }
    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const key = stringProp(node, 'key');
        const createSurface = stringProp(node, 'createSurface');
        const label = key && railLabel(key, stringProp(node, 'createLabel'));
        const component = identifierProp(node, 'component');
        const spec = component && imports.get(component);
        if (key && createSurface && label && spec?.startsWith('.')) {
          const paneFile = resolveModule(CATALOG, spec);
          if (!paneFile) throw new Error(`${key}: cannot find ${spec}`);
          rows.push({ key, createSurface, label, paneFile });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return rows;
}

/** The pane's file and the files beside it that it imports: where its toolbar,
 *  empty state and create button actually live. */
function paneFamily(paneFile: string): string[] {
  const dir = path.dirname(paneFile);
  const text = fs.readFileSync(paneFile, 'utf8');
  const family = [paneFile];
  for (const match of text.matchAll(/from '(\.\/[^']+)'/g)) {
    const resolved = resolveModule(dir, match[1] ?? '');
    if (resolved) family.push(resolved);
  }
  return family;
}

const rows = catalogRows();

describe('a list pane and its `+` name the create action the same way', () => {
  it('reads the catalog and the surfaces it points at', () => {
    expect(fs.existsSync(CATALOG)).toBe(true);
    expect(fs.existsSync(SURFACES)).toBe(true);
    // The denominator. Fifty-odd lists carry a `+`; a parse that found a handful
    // would pass every assertion below while checking almost nothing.
    expect(rows.length).toBeGreaterThan(40);
  });

  it('shows the same words wherever the pane opens its own create form', () => {
    const disagree: string[] = [];
    let checked = 0;
    for (const row of rows) {
      const texts = paneFamily(row.paneFile).map((file) => fs.readFileSync(file, 'utf8'));
      const opensNew = texts.some(
        (text) => text.includes(`'${row.createSurface}'`) && text.includes(`'new'`)
      );
      if (!opensNew) continue;
      checked += 1;
      const agrees = texts.some(
        (text) => text.includes(`createLabelFor('${row.key}')`) || text.includes(row.label)
      );
      if (!agrees) disagree.push(`${row.key}: the + says "${row.label}"`);
    }
    expect(disagree).toEqual([]);
    expect(checked).toBeGreaterThan(30);
  });

  it('only asks for the words of a list that has some', () => {
    const known = new Set(rows.map((row) => row.key));
    const unknown: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          for (const match of fs
            .readFileSync(full, 'utf8')
            .matchAll(/createLabelFor\('([^']+)'\)/g)) {
            if (!known.has(match[1] ?? '')) unknown.push(`${entry.name}: ${match[1]}`);
          }
        }
      }
    };
    walk(SURFACES);
    expect(unknown).toEqual([]);
  });
});
