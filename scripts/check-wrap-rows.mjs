#!/usr/bin/env node
// In a row that wraps, the words that grow keep a width of their own (persona
// issue 266).
//
// Tailwind's `flex-1` is `flex: 1 1 0%`: a starting width of NOTHING. In a
// `flex flex-wrap` row the browser decides what fits on a line from those
// starting widths, so a `flex-1` name counts as zero, every badge and button
// joins it on the first line, and the name gets what is left. Measured on
// Gillett's "Won and lost, by person": "Unassigned" drawn 2px wide, read as "I".
// A board card's title did the same (issue 262).
//
// A grower that may shrink to nothing (`min-w-0`, `truncate`) in a wrapping row
// therefore needs a starting width: `basis-*`, or a `min-w-*` above zero. Then
// the others wrap below it instead.
//
// Run: node scripts/check-wrap-rows.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CONSOLES = ['sparx/apps/workbench', 'piggles/apps/workbench'];
const SCAN = ['surfaces', 'components'];

/** Piggles files over its 250-line rule, left until each is split (the owner's
 *  choice for this kind of sweep, 2026-10-13). An entry that no longer offends fails. */
const PIGGLES_DEBT = [
  'piggles/apps/workbench/components/launcher-rows.tsx',
  'piggles/apps/workbench/surfaces/ai-connections/ai-connections.tsx',
  'piggles/apps/workbench/surfaces/automations/automations-reports.tsx',
  'piggles/apps/workbench/surfaces/automations/run-detail.tsx',
  'piggles/apps/workbench/surfaces/b2b/account-statement.tsx',
  'piggles/apps/workbench/surfaces/b2b/pricing-tier-detail.tsx',
  'piggles/apps/workbench/surfaces/cms/media-picker.tsx',
  'piggles/apps/workbench/surfaces/cms/taxonomy-detail.tsx',
  'piggles/apps/workbench/surfaces/commerce/market.tsx',
  'piggles/apps/workbench/surfaces/commerce/price-list-detail.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-filing.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-pricing.tsx',
  'piggles/apps/workbench/surfaces/commerce/shipping-rate-editor.tsx',
  'piggles/apps/workbench/surfaces/commerce/shipping.tsx',
  'piggles/apps/workbench/surfaces/commerce/tax-exemptions-section.tsx',
  'piggles/apps/workbench/surfaces/commerce/tax-zone-detail.tsx',
  'piggles/apps/workbench/surfaces/commerce/tax.tsx',
  'piggles/apps/workbench/surfaces/crm/associations-panel.tsx',
  'piggles/apps/workbench/surfaces/crm/customer-merge.tsx',
  'piggles/apps/workbench/surfaces/crm/duplicates.tsx',
  'piggles/apps/workbench/surfaces/crm/reports.tsx',
  'piggles/apps/workbench/surfaces/dropship/order-detail.tsx',
  'piggles/apps/workbench/surfaces/dropship/profitability.tsx',
  'piggles/apps/workbench/surfaces/finance/expense-detail.tsx',
  'piggles/apps/workbench/surfaces/inventory/preorders.tsx',
  'piggles/apps/workbench/surfaces/partner/partner-access.tsx',
  'piggles/apps/workbench/surfaces/scheduling/booking-service-record.tsx',
  'piggles/apps/workbench/surfaces/scheduling/calendar-connections.tsx',
  'piggles/apps/workbench/surfaces/seo/audits-list.tsx',
  'piggles/apps/workbench/surfaces/social/cadence.tsx',
  'piggles/apps/workbench/surfaces/social/composer.tsx',
  'piggles/apps/workbench/surfaces/social/connections.tsx',
  'piggles/apps/workbench/surfaces/social/insights.tsx',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(p);
  }
  return out;
}

/** The class words of a JSX element, when its className is a plain string. */
function classWords(element) {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  for (const attr of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || attr.name.getText() !== 'className') continue;
    const init = attr.initializer;
    if (init && ts.isStringLiteral(init)) return init.text.split(/\s+/).filter(Boolean);
    return null;
  }
  return null;
}

const isWrapRow = (w) =>
  (w.includes('flex') || w.includes('inline-flex')) &&
  w.includes('flex-wrap') &&
  !w.includes('flex-col');

/** Lets the browser shrink it to zero: without one of these it keeps at least
 *  its longest word, which is narrow but still readable. */
const MAY_VANISH = ['min-w-0', 'truncate', 'overflow-hidden', 'text-ellipsis'];

const startsAtNothing = (w) =>
  w.includes('flex-1') &&
  w.some((c) => MAY_VANISH.includes(c) || c.startsWith('line-clamp-')) &&
  !w.some((c) => c.startsWith('basis-')) &&
  !w.some((c) => c.startsWith('min-w-') && c !== 'min-w-0');

/** Every grower with no width of its own inside a wrapping row, as file lines. */
export function findOffenders(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = [];
  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const words = classWords(node);
      if (words && isWrapRow(words)) {
        for (const child of node.children) {
          if (!ts.isJsxElement(child) && !ts.isJsxSelfClosingElement(child)) continue;
          const cw = classWords(child);
          if (cw && startsAtNothing(cw)) {
            lines.push(sf.getLineAndCharacterOfPosition(child.getStart(sf)).line + 1);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return lines;
}

let files = 0;
const offenders = new Map();
for (const console_ of CONSOLES) {
  for (const sub of SCAN) {
    const dir = join(ROOT, console_, sub);
    if (!existsSync(dir)) {
      console.error(
        `check:wrap-rows: ${console_}/${sub} is missing, so this check would see nothing.`
      );
      process.exit(1);
    }
    for (const file of walk(dir)) {
      files++;
      const rel = relative(ROOT, file).split(sep).join('/');
      const found = findOffenders(file, readFileSync(file, 'utf8'));
      if (found.length > 0) offenders.set(rel, found);
    }
  }
}

if (files < 100) {
  console.error(
    `check:wrap-rows: scanned only ${String(files)} files; the console folders have moved.`
  );
  process.exit(1);
}

const stale = PIGGLES_DEBT.filter((p) => !offenders.has(p));
const fresh = [...offenders.keys()].filter((p) => !PIGGLES_DEBT.includes(p));
if (fresh.length > 0 || stale.length > 0) {
  for (const p of fresh)
    console.error(
      `  ${p}:${offenders.get(p).join(',')}  flex-1 in a wrapping row with no width of its own; add basis-*`
    );
  for (const p of stale)
    console.error(`  ${p}  is in PIGGLES_DEBT but no longer offends; take it off the list`);
  console.error(`\n✗ check:wrap-rows: ${String(fresh.length + stale.length)} problem(s).`);
  process.exit(1);
}
console.log(
  `✓ check:wrap-rows: ${String(files)} files: every grower in a wrapping row keeps a width (${String(PIGGLES_DEBT.length)} Piggles files listed as debt).`
);
