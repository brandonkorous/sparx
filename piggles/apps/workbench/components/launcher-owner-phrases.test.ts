// What an owner types reaches the screen that does it: phrases from persona runs,
// ranked against the REAL screen list, read with the TypeScript parser (importing
// the catalog pulls in every pane). A moved catalog folder fails, never passes.

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createActions } from './launcher-create';
import { rankEntries, type Entry } from './launcher-match';

const CATALOG = path.resolve(__dirname, '../lib/surfaces/catalog');

/** Phrase typed → the screen it has to put FIRST. */
const PHRASES: [string, string][] = [
  // sparx persona issue 031
  ['shipping policy', 'cms.legal.list'],
  ['refund policy', 'cms.legal.list'],
  // sparx persona issue 044
  ['cookie banner', 'cms.legal.list'],
  // A parts counter's own words for the cores list (sparx persona issue 051).
  ['cores owed', 'commerce.cores.list'],
  // Moving a business in, in the owner's words (sparx persona issue 052).
  ['import products', 'platform.migrate'],
  ['move my products from shopify', 'platform.migrate'],
  ['import customers', 'platform.migrate'],
  ['core deposit', 'commerce.cores.list'],
  ['old part', 'commerce.cores.list'],
  // A core charge the old store faked as a choice (sparx persona issue 057). The
  // matcher reads a singular and its plural as one word, so the screen NAMED
  // "Core charges" leads for both; each screen's empty state points at the other.
  ['core charge', 'commerce.core-choices.list'],
  ['core charge choices', 'commerce.core-choices.list'],
  ['core charges', 'commerce.core-choices.list'],
  ['convert core charge', 'commerce.core-choices.list'],
  ['accept core charge', 'commerce.core-choices.list'],
  ['defer core charge', 'commerce.core-choices.list'],
  ['ship when core received', 'commerce.core-choices.list'],
  // sparx persona issue 036
  ['new discount', 'commerce.discounts.list'],
  ['add a discount', 'commerce.discounts.list'],
  ['invoice template', 'invoicing.templates'],
  ['product page', 'builder.page'],
  // Asking to MAKE one puts the row that makes one first.
  ['new social post', 'create:social.calendar'],
  // P01 act 4: the persona's own run log calls them "stock locations" (sparx issue 068).
  ['stock locations', 'inventory.warehouses.list'],
  ['where my stock is kept', 'inventory.warehouses.list'],
  // P01 act 5: setting what dealers and fleets pay. "Price tiers" is the
  // screen's name; nobody walks in calling it that (issue 074).
  ['dealer prices', 'b2b.pricing-tiers.list'],
  ['fleet pricing', 'b2b.pricing-tiers.list'],
  ['wholesale prices', 'b2b.pricing-tiers.list'],
  ['trade discount', 'b2b.pricing-tiers.list'],
  // P01 act 5: a reseller's or a ranch's certificate. It is kept on the
  // wholesale customer, in its Tax exemption section (sparx issue 075).
  ['tax exempt', 'b2b.accounts.list'],
  ['tax exemption', 'b2b.accounts.list'],
  ['resale certificate', 'b2b.accounts.list'],
  ['exemption certificate', 'b2b.accounts.list'],
  // P01 act 5: Salt Lake County's own price on one product. The screen is
  // "Product trade pricing"; the owner says what it is (issue 074).
  ['contract price', 'commerce.product.trade-pricing'],
  ['agreed price', 'commerce.product.trade-pricing'],
  ['special price for one customer', 'commerce.product.trade-pricing'],
  // The /b2b page says "A/R aging"; the screen is "Owed to you" (issue 086).
  ['ar aging', 'finance.receivables'],
  ['accounts receivable', 'finance.receivables'],
  // Pricing a quote: the line editor offered rules no screen could make (086).
  ['markup rules', 'commerce.markup-rules.list'],
  ['markup', 'commerce.markup-rules.list'],
  ['cost plus', 'commerce.markup-rules.list'],
  ['margin', 'commerce.markup-rules.list'],
  ['price from cost', 'commerce.markup-rules.list'],
];

function literalProp(node: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const prop of node.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === name) {
      return prop.initializer;
    }
  }
  return undefined;
}

interface CatalogRow {
  key: string;
  module: string;
  title: string;
  keywords: string[];
  section?: string;
  createSurface?: string;
  createLabel?: string;
}

/** Every listed screen with a plain-text title, plus the `+` rows the launcher
 *  builds from them (launcher-entries.ts), as the launcher builds its rows. */
function catalogRows(): Entry[] {
  const screens = catalogScreens();
  // As useNavEntries builds them (launcher-entries.ts): the module and the
  // section heading are searchable too, and the box scores them.
  const rows: Entry[] = screens.map((s) => ({
    id: s.key,
    group: s.module,
    label: s.title,
    keywords: [...s.keywords, s.module, ...(s.section ? [s.section] : [])],
    run: () => undefined,
  }));
  for (const action of createActions(
    screens,
    (s) => s.createLabel,
    (s) => s.title
  )) {
    rows.push({
      id: action.id,
      group: action.surface.module,
      label: action.label,
      keywords: action.keywords,
      run: () => undefined,
    });
  }
  return rows;
}

function catalogScreensByFile(): CatalogRow[] {
  const rows: CatalogRow[] = [];
  for (const file of fs.readdirSync(CATALOG).filter((f) => f.endsWith('.ts'))) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(path.join(CATALOG, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const visit = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const key = literalProp(node, 'key');
        const title = literalProp(node, 'title');
        const module = literalProp(node, 'module');
        const listed = literalProp(node, 'listed');
        const keywords = literalProp(node, 'keywords');
        const createSurface = literalProp(node, 'createSurface');
        const createLabel = literalProp(node, 'createLabel');
        const section = literalProp(node, 'section');
        if (
          key &&
          ts.isStringLiteralLike(key) &&
          title &&
          ts.isStringLiteralLike(title) &&
          module &&
          ts.isStringLiteralLike(module) &&
          listed?.kind !== ts.SyntaxKind.FalseKeyword
        ) {
          rows.push({
            key: key.text,
            module: module.text,
            title: title.text,
            keywords:
              keywords && ts.isArrayLiteralExpression(keywords)
                ? keywords.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
                : [],
            ...(createSurface && ts.isStringLiteralLike(createSurface)
              ? { createSurface: createSurface.text }
              : {}),
            ...(createLabel && ts.isStringLiteralLike(createLabel)
              ? { createLabel: createLabel.text }
              : {}),
            ...(section && ts.isStringLiteralLike(section) ? { section: section.text } : {}),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return rows;
}

/**
 * The listed screens in the order the box lists them: the order of
 * `registerSurfaces([...])` in catalog/index.ts, following each `...LIST`
 * spread into the file that declares it.
 *
 * The order matters because equal ranks keep the order they arrive in. Read
 * file by file (alphabetically), "aging" put Owed to you first here while the box
 * put Inventory's Reports first, and 14 other phrases passed only by that luck
 * (sparx persona issue 086). Every screen the file walk finds must turn up here
 * exactly once, so a list shape this cannot follow fails instead of dropping
 * screens.
 */
function catalogScreens(): CatalogRow[] {
  const byKey = new Map(catalogScreensByFile().map((row) => [row.key, row]));
  const lists = new Map<string, ts.NodeArray<ts.Expression>>();
  let registered: ts.NodeArray<ts.Expression> | undefined;
  for (const file of fs.readdirSync(CATALOG).filter((f) => f.endsWith('.ts'))) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(path.join(CATALOG, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        lists.set(node.name.text, node.initializer.elements);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'registerSurfaces' &&
        node.arguments[0] &&
        ts.isArrayLiteralExpression(node.arguments[0])
      ) {
        registered = node.arguments[0].elements;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  if (!registered) throw new Error('registerSurfaces([...]) not found in the catalog');

  const ordered: CatalogRow[] = [];
  const keyOf = (element: ts.Expression): string | undefined => {
    const object = ts.isObjectLiteralExpression(element)
      ? element
      : ts.isCallExpression(element)
        ? element.arguments.find(ts.isObjectLiteralExpression)
        : undefined;
    const key = object ? literalProp(object, 'key') : undefined;
    return key && ts.isStringLiteralLike(key) ? key.text : undefined;
  };
  const walk = (elements: ts.NodeArray<ts.Expression>) => {
    for (const element of elements) {
      if (ts.isSpreadElement(element) && ts.isIdentifier(element.expression)) {
        const list = lists.get(element.expression.text);
        if (!list) throw new Error(`cannot follow ...${element.expression.text}`);
        walk(list);
        continue;
      }
      const key = keyOf(element);
      const row = key ? byKey.get(key) : undefined;
      if (row) ordered.push(row);
    }
  };
  walk(registered);

  const seen = ordered.map((row) => row.key);
  expect(new Set(seen).size).toBe(seen.length);
  expect([...seen].sort()).toEqual([...byKey.keys()].sort());
  return ordered;
}

describe('owner phrases in the search box', () => {
  it('reads a real catalog', () => {
    expect(fs.existsSync(CATALOG)).toBe(true);
    expect(catalogRows().length).toBeGreaterThan(100);
  });

  const rows = catalogRows();
  it('"business hours" offers the opening hours, beside the support reply clock', () => {
    // Both screens honestly hold business hours: when the shop is open, and when
    // support replies count. The owner must see the first (sparx persona issue 036).
    const top = rankEntries(rows, 'business hours')
      .slice(0, 3)
      .map((r) => r.id);
    expect(top).toContain('scheduling.availability');
  });

  it('"aging" offers Owed to you, beside the stock reports', () => {
    // Both screens honestly age something: unpaid invoices, and stock on the
    // shelf. The /b2b page calls the first "A/R aging" (sparx persona issue 086).
    const top = rankEntries(rows, 'aging')
      .slice(0, 3)
      .map((r) => r.id);
    expect(top).toContain('finance.receivables');
  });

  for (const [phrase, key] of PHRASES) {
    it(`"${phrase}" puts ${key} first`, () => {
      expect(rankEntries(rows, phrase)[0]?.id).toBe(key);
    });
  }
});
