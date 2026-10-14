#!/usr/bin/env node
// A FAILED LOAD THAT BLAMES THE CONNECTION, WHATEVER WENT WRONG.
//
// Persona issue 260. When a sparx console pane could not load, it said "This is
// a problem reaching the server". That sentence is true for ONE cause, and each
// screen wrote it by hand, so it was said for all four:
//
//     no connection     could not reach the server             (true)
//     5xx               something went wrong at our end         (said: the connection)
//     404, 400, 422     that thing is no longer here, no retry  (said: the connection,
//                                                                 over a Try again
//                                                                 that always fails)
//     401, 403          your account cannot open this           (said: the connection)
//
// It sends a business owner off to restart a router over a fault that is ours.
//
// `paneLoadReason` in sparx/apps/workbench/lib/api-error.ts is the one place that
// tells the causes apart, and the words for the other three live beside it. Two
// doors lead there, and a screen's own "reaching the server" sentence may only
// stand behind one of them:
//
//   <PaneLoadError title=... description=... error={query.error} />
//       for a failed FIRST load, where nothing is on screen. The description is
//       used only when the error really was the connection.
//
//   loadFailureWords(query.error, 'This is a problem reaching the server. ...')
//       for anything else that reports a failed read: an <Alert> over the last
//       good data, a toast, a line of text. The sentence is the SECOND argument,
//       and it is returned only for the unreachable case.
//
// ── WHAT FAILS ──────────────────────────────────────────────────────────────
//
//   (a) a `<PaneLoadError` with neither `error=` nor `reason=`. Without one of
//       them the box cannot know the cause and falls back to the caller's
//       sentence, which is the bug. 35 of 135 boxes did this on 2026-10-13. A
//       spread (`{...(failed ? { error } : { reason: 'missing' })}`) counts as
//       handing one over, because that is the only reason to write one there.
//   (b) the words `problem reaching the server` anywhere except inside a
//       `<PaneLoadError ...>` open tag or the second argument of
//       `loadFailureWords(`. 161 places wrote them into a plain
//       <EmptyState>, an <Alert> or a toast on the same date.
//
// A whole-line comment is not a screen and is not scanned, so a comment may
// still quote the old sentence to explain why it went.
//
// Both consoles are scanned: sparx's and Piggles'. Piggles still has files over
// RULE #0.5's 250 lines that offend; they are listed by path in PIGGLES_DEBT, and
// the list may only shrink (an entry that no longer offends fails too).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_ROOTS = [
  ['sparx', join(ROOT, 'sparx', 'apps', 'workbench')],
  ['piggles', join(ROOT, 'piggles', 'apps', 'workbench')],
];

/**
 * Places that may still say the sentence outside the two doors, each with its
 * reason, as [repo-relative path, a piece of the offending line]. Every entry
 * must still match something, or the check fails, so the list can only shrink.
 *
 * Empty: the bulk-dialog WRITES that used to be listed here word their failure
 * through lib/api/write-failure.ts in both consoles now. Add an entry only with its
 * reason, and only for something that truly has no error to read.
 */
const EXCEPTIONS = [];

// The owner chose on 2026-10-13 to leave these until each file is split for RULE #0.5 (persona issue 260).
const PIGGLES_DEBT = [
  'piggles/apps/workbench/surfaces/ai-connections/ai-connections.tsx',
  'piggles/apps/workbench/surfaces/ai/overview.tsx',
  'piggles/apps/workbench/surfaces/ai/prompt-editor.tsx',
  'piggles/apps/workbench/surfaces/ai/prompts-list.tsx',
  'piggles/apps/workbench/surfaces/ai/tool-policies.tsx',
  'piggles/apps/workbench/surfaces/analytics/dashboard-view.tsx',
  'piggles/apps/workbench/surfaces/automations/automations-reports.tsx',
  'piggles/apps/workbench/surfaces/b2b/accounts-list.tsx',
  'piggles/apps/workbench/surfaces/b2b/invoices-list.tsx',
  'piggles/apps/workbench/surfaces/b2b/orders-list.tsx',
  'piggles/apps/workbench/surfaces/b2b/quotes-list.tsx',
  'piggles/apps/workbench/surfaces/builder/blueprints-list.tsx',
  'piggles/apps/workbench/surfaces/builder/saved-piece-detail.tsx',
  'piggles/apps/workbench/surfaces/builder/saved-pieces-list.tsx',
  'piggles/apps/workbench/surfaces/builder/site-identity.tsx',
  'piggles/apps/workbench/surfaces/chat/inbox.tsx',
  'piggles/apps/workbench/surfaces/chat/overview.tsx',
  'piggles/apps/workbench/surfaces/chat/quick-replies.tsx',
  'piggles/apps/workbench/surfaces/chat/settings.tsx',
  'piggles/apps/workbench/surfaces/cms/content-detail.tsx',
  'piggles/apps/workbench/surfaces/cms/content-list.tsx',
  'piggles/apps/workbench/surfaces/cms/legal-placements.tsx',
  'piggles/apps/workbench/surfaces/cms/media-list.tsx',
  'piggles/apps/workbench/surfaces/cms/taxonomy-detail.tsx',
  'piggles/apps/workbench/surfaces/commerce/channels.tsx',
  'piggles/apps/workbench/surfaces/commerce/checkout-list.tsx',
  'piggles/apps/workbench/surfaces/commerce/commerce-settings.tsx',
  'piggles/apps/workbench/surfaces/commerce/configurator-template-detail.tsx',
  'piggles/apps/workbench/surfaces/commerce/fitment-chooser.tsx',
  'piggles/apps/workbench/surfaces/commerce/fitment-list.tsx',
  'piggles/apps/workbench/surfaces/commerce/fitment-nodes.tsx',
  'piggles/apps/workbench/surfaces/commerce/market.tsx',
  'piggles/apps/workbench/surfaces/commerce/orders-list.tsx',
  'piggles/apps/workbench/surfaces/commerce/payment-provider-detail.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-channels.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-configurator.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-dropship.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-fitment.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-pricing.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-reviews.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-scope.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-stock.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-subscriptions.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-trade-pricing.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-translations.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-types-list.tsx',
  'piggles/apps/workbench/surfaces/commerce/products-list.tsx',
  'piggles/apps/workbench/surfaces/commerce/qa-list.tsx',
  'piggles/apps/workbench/surfaces/commerce/qa-queue.tsx',
  'piggles/apps/workbench/surfaces/commerce/repeat-order-new.tsx',
  'piggles/apps/workbench/surfaces/commerce/reviews-list.tsx',
  'piggles/apps/workbench/surfaces/commerce/reviews-queue.tsx',
  'piggles/apps/workbench/surfaces/commerce/shipping-rate-editor.tsx',
  'piggles/apps/workbench/surfaces/commerce/shipping.tsx',
  'piggles/apps/workbench/surfaces/commerce/tax-zone-detail.tsx',
  'piggles/apps/workbench/surfaces/commerce/tax.tsx',
  'piggles/apps/workbench/surfaces/crm/companies-list.tsx',
  'piggles/apps/workbench/surfaces/crm/customer-overview.tsx',
  'piggles/apps/workbench/surfaces/crm/customers-list.tsx',
  'piggles/apps/workbench/surfaces/crm/deals-list.tsx',
  'piggles/apps/workbench/surfaces/crm/duplicates.tsx',
  'piggles/apps/workbench/surfaces/crm/segments-list.tsx',
  'piggles/apps/workbench/surfaces/crm/sla-policies.tsx',
  'piggles/apps/workbench/surfaces/crm/snippets-list.tsx',
  'piggles/apps/workbench/surfaces/crm/templates-list.tsx',
  'piggles/apps/workbench/surfaces/crm/tickets-list.tsx',
  'piggles/apps/workbench/surfaces/dropship/profitability.tsx',
  'piggles/apps/workbench/surfaces/dropship/supplier-detail.tsx',
  'piggles/apps/workbench/surfaces/email/broadcasts-list.tsx',
  'piggles/apps/workbench/surfaces/email/email-settings.tsx',
  'piggles/apps/workbench/surfaces/email/sequence-enrollments.tsx',
  'piggles/apps/workbench/surfaces/email/suppressions-list.tsx',
  'piggles/apps/workbench/surfaces/finance/bills-to-pay.tsx',
  'piggles/apps/workbench/surfaces/finance/job-profit.tsx',
  'piggles/apps/workbench/surfaces/finance/payouts-list.tsx',
  'piggles/apps/workbench/surfaces/finance/profit.tsx',
  'piggles/apps/workbench/surfaces/finance/receivables.tsx',
  'piggles/apps/workbench/surfaces/finance/recurring-costs.tsx',
  'piggles/apps/workbench/surfaces/finance/spending-list.tsx',
  'piggles/apps/workbench/surfaces/finance/subscription.tsx',
  'piggles/apps/workbench/surfaces/finance/vendors-list.tsx',
  'piggles/apps/workbench/surfaces/industry/industry.tsx',
  'piggles/apps/workbench/surfaces/integrations/integration-detail.tsx',
  'piggles/apps/workbench/surfaces/integrations/integrations-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/assemblies-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/backorders.tsx',
  'piggles/apps/workbench/surfaces/inventory/barcodes-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/boms-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/cost-variance.tsx',
  'piggles/apps/workbench/surfaces/inventory/costing-settings.tsx',
  'piggles/apps/workbench/surfaces/inventory/count-schedules-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/counts-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/expiring-stock.tsx',
  'piggles/apps/workbench/surfaces/inventory/gl-reconciliation.tsx',
  'piggles/apps/workbench/surfaces/inventory/lots-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/movements-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/performance.tsx',
  'piggles/apps/workbench/surfaces/inventory/pick-lists-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/pick-throughput.tsx',
  'piggles/apps/workbench/surfaces/inventory/planning-classes.tsx',
  'piggles/apps/workbench/surfaces/inventory/planning-idle.tsx',
  'piggles/apps/workbench/surfaces/inventory/planning-settings.tsx',
  'piggles/apps/workbench/surfaces/inventory/planning.tsx',
  'piggles/apps/workbench/surfaces/inventory/po-approvals.tsx',
  'piggles/apps/workbench/surfaces/inventory/preorders.tsx',
  'piggles/apps/workbench/surfaces/inventory/purchase-order-procurement.tsx',
  'piggles/apps/workbench/surfaces/inventory/purchase-orders-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/receipt-detail.tsx',
  'piggles/apps/workbench/surfaces/inventory/receiving-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/report-schedules.tsx',
  'piggles/apps/workbench/surfaces/inventory/sources-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/stock-grid.tsx',
  'piggles/apps/workbench/surfaces/inventory/supplier-bills-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/supplier-returns-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/supplier-scorecards.tsx',
  'piggles/apps/workbench/surfaces/inventory/suppliers-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/transfers-list.tsx',
  'piggles/apps/workbench/surfaces/inventory/units-list.tsx',
  'piggles/apps/workbench/surfaces/modules/modules-list.tsx',
  'piggles/apps/workbench/surfaces/notifications/notifications.tsx',
  'piggles/apps/workbench/surfaces/partner/partner-access.tsx',
  'piggles/apps/workbench/surfaces/pulse/needs-you.tsx',
  'piggles/apps/workbench/surfaces/sample-data/sample-data.tsx',
  'piggles/apps/workbench/surfaces/scheduling/availability-settings.tsx',
  'piggles/apps/workbench/surfaces/scheduling/calendar-connections.tsx',
  'piggles/apps/workbench/surfaces/scheduling/reports.tsx',
  'piggles/apps/workbench/surfaces/scheduling/waitlist-list.tsx',
  'piggles/apps/workbench/surfaces/seo/audits-list.tsx',
  'piggles/apps/workbench/surfaces/seo/performance.tsx',
  'piggles/apps/workbench/surfaces/seo/search-console.tsx',
  'piggles/apps/workbench/surfaces/sites/sites-list.tsx',
  'piggles/apps/workbench/surfaces/social/approvals.tsx',
  'piggles/apps/workbench/surfaces/social/calendar.tsx',
  'piggles/apps/workbench/surfaces/social/composer.tsx',
  'piggles/apps/workbench/surfaces/social/connections.tsx',
  'piggles/apps/workbench/surfaces/social/inbox.tsx',
  'piggles/apps/workbench/surfaces/social/insights.tsx',
  'piggles/apps/workbench/surfaces/social/queue.tsx',
  'piggles/apps/workbench/surfaces/staff/certifications.tsx',
  'piggles/apps/workbench/surfaces/staff/people.tsx',
  'piggles/apps/workbench/surfaces/staff/schedule.tsx',
  'piggles/apps/workbench/surfaces/staff/time-off.tsx',
  'piggles/apps/workbench/surfaces/staff/timesheets.tsx',
  'piggles/apps/workbench/surfaces/team/index.tsx',
  'piggles/apps/workbench/surfaces/team/member.tsx',
];

// 250 lines or fewer, but the error they need lives only in the file over 250 named beside each; they move with it.
const PIGGLES_DEBT_HELD_BY_PARENT = [
  'piggles/apps/workbench/surfaces/commerce/products-list-notices.tsx', // products-list.tsx
  'piggles/apps/workbench/surfaces/commerce/sale-sellable-picker.tsx', // bundles-data.ts (useVariantSearch)
  'piggles/apps/workbench/surfaces/inventory/stock-list-body.tsx', // stock-list.tsx
];
const ALL_DEBT = [...PIGGLES_DEBT, ...PIGGLES_DEBT_HELD_BY_PARENT];

const PHRASE = /problem\s+reaching\s+the\s+server/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx') && !entry.endsWith('.spec.tsx'))
      out.push(p);
  }
  return out;
}

/**
 * Blank out comments, keeping every offset and newline where it was so a line
 * number still points at the right line.
 *
 * Only comments that START a line (after whitespace, or after the `{` of a JSX
 * comment) are blanked. A tokenizer that tried to find every comment would have
 * to know which apostrophes open strings, and JSX text is full of apostrophes
 * that do not. A trailing comment that quotes the sentence is therefore still
 * scanned, which over-reports rather than letting a screen through.
 */
function maskComments(src) {
  const out = src.split('');
  const blank = (from, to) => {
    for (let i = from; i < to; i++) if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
  };
  let lineStart = 0;
  while (lineStart < src.length) {
    const nl = src.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? src.length : nl;
    const lead = /^[ \t]*\{?[ \t]*/.exec(src.slice(lineStart, lineEnd))[0].length;
    const at = lineStart + lead;
    if (src.startsWith('//', at)) {
      blank(at, lineEnd);
      lineStart = lineEnd + 1;
      continue;
    }
    if (src.startsWith('/*', at)) {
      const close = src.indexOf('*/', at + 2);
      const end = close === -1 ? src.length : close + 2;
      blank(at, end);
      const next = src.indexOf('\n', end);
      lineStart = next === -1 ? src.length : next + 1;
      continue;
    }
    lineStart = lineEnd + 1;
  }
  return out.join('');
}

/** End (exclusive) of the balanced bracket that starts at `open`. */
function closeBracket(src, open) {
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const stack = [];
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === '}' || c === ')' || c === ']') {
      stack.pop();
      if (stack.length === 0) return i + 1;
    }
  }
  return src.length;
}

/** The open tag starting at `start`: its end and its top-level attribute names. */
function openTag(src, start) {
  const names = [];
  let quote = null;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    // A comment between attributes is prose, and prose that says "error" is
    // not an `error=` prop.
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      const end = src[i + 1] === '/' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2) + 1;
      i = end <= 0 ? src.length : end;
      continue;
    }
    if (c === '{') {
      // A spread hands over props this scan cannot see.
      if (/^\{\s*\.\.\./.test(src.slice(i, i + 8))) names.push('...');
      i = closeBracket(src, i) - 1;
      continue;
    }
    if (c === '>') return { end: i + 1, names };
    const name = /^\s([A-Za-z][\w-]*)(?=\s*=|\s|\/?>)/.exec(src.slice(i - 1, i + 40));
    if (name && /\s/.test(src[i - 1])) {
      names.push(name[1]);
      i += name[1].length - 1;
    }
  }
  return { end: src.length, names };
}

/** The span of the second argument of the call whose `(` is at `open`. */
function secondArgument(src, open) {
  const close = closeBracket(src, open) - 1;
  let quote = null;
  for (let i = open + 1; i < close; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') {
      i = closeBracket(src, i) - 1;
      continue;
    }
    if (c === ',') return [i + 1, close];
  }
  return null;
}

const lineOf = (src, offset) => src.slice(0, offset).split('\n').length;

/** Every offender under one console: boxes without their error, and strays. */
function scan(scanRoot) {
  if (!existsSync(scanRoot) || !statSync(scanRoot).isDirectory()) {
    console.error(`check:load-failure-words: scan root missing: ${scanRoot}`);
    process.exit(1);
  }
  const files = walk(scanRoot);
  const result = { files: files.length, boxes: 0, noError: [], strays: [] };
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    // The component defines the props; it is not a caller.
    if (rel.endsWith('/components/pane-load-error.tsx')) continue;
    scanFile(rel, maskComments(readFileSync(file, 'utf8')), result);
  }
  return result;
}

function scanFile(rel, src, result) {
  const lines = src.split('\n');
  const allowed = [];

  for (const m of src.matchAll(/<PaneLoadError\b/g)) {
    result.boxes++;
    const tag = openTag(src, m.index);
    allowed.push([m.index, tag.end]);
    if (!tag.names.some((n) => n === 'error' || n === 'reason' || n === '...'))
      result.noError.push([rel, lineOf(src, m.index)]);
  }

  // workFailureWords is the same rule for a calculation (a tax quote, a preview).
  for (const m of src.matchAll(/\b(?:load|work)FailureWords\s*\(/g)) {
    const span = secondArgument(src, m.index + m[0].length - 1);
    if (span) allowed.push(span);
  }

  for (const m of src.matchAll(PHRASE)) {
    if (allowed.some(([from, to]) => m.index >= from && m.index < to)) continue;
    const line = lineOf(src, m.index);
    const exception = EXCEPTIONS.find(
      ([path, snippet]) => path === rel && lines[line - 1].includes(snippet)
    );
    if (exception) excepted.add(exception);
    else result.strays.push([rel, line]);
  }
}

const excepted = new Set();
const noError = [];
const strays = [];
const debtSeen = new Set();
let files = 0;
let boxes = 0;

for (const [name, scanRoot] of SCAN_ROOTS) {
  const found = scan(scanRoot);
  // A check that scans nothing prints green. [[feedback_structural_checks_go_blind]]
  if (found.files === 0 || found.boxes === 0) {
    console.error(
      `check:load-failure-words: scanned ${String(found.files)} ${name} file(s) and found ${String(found.boxes)} <PaneLoadError> element(s). The scan root or the component has moved, so this check is seeing nothing.`
    );
    process.exit(1);
  }
  files += found.files;
  boxes += found.boxes;
  for (const [list, into] of [
    [found.noError, noError],
    [found.strays, strays],
  ]) {
    for (const [rel, line] of list) {
      if (name === 'piggles' && ALL_DEBT.includes(rel)) debtSeen.add(rel);
      else into.push(`${rel}:${String(line)}`);
    }
  }
}

const stale = EXCEPTIONS.filter((entry) => !excepted.has(entry));
const paidDebt = ALL_DEBT.filter((rel) => !debtSeen.has(rel));

if (noError.length > 0 || strays.length > 0 || stale.length > 0 || paidDebt.length > 0) {
  if (noError.length > 0) {
    console.error(
      `\n${String(noError.length)} <PaneLoadError> box(es) without \`error=\` or \`reason=\`, so they cannot tell a server fault, a refusal or a deleted record from a lost connection:\n`
    );
    for (const w of noError) console.error(`  ${w}`);
    console.error("\nPass the failed query's error: `error={productsQuery.error}`.");
  }
  if (strays.length > 0) {
    console.error(
      `\n${String(strays.length)} place(s) say "problem reaching the server" by hand, whatever actually went wrong:\n`
    );
    for (const w of strays) console.error(`  ${w}`);
    console.error(
      '\nA failed first load: <PaneLoadError title=... description=... error={query.error} />.'
    );
    console.error(
      "Anything else: description={loadFailureWords(query.error, 'This is a problem reaching the server. ...')}."
    );
  }
  if (stale.length > 0) {
    console.error('\nEXCEPTIONS entries that no longer match anything (delete them):\n');
    for (const [path, snippet] of stale) console.error(`  ${path}  (${snippet})`);
  }
  if (paidDebt.length > 0) {
    console.error('\nPIGGLES_DEBT entries that no longer offend (delete them from their list):\n');
    for (const rel of paidDebt) console.error(`  ${rel}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `${String(files)} files, ${String(boxes)} load-error boxes across both consoles: every one outside the Piggles debt lists is handed its error, and no screen blames the connection by hand.`
);
console.log(
  `${String(PIGGLES_DEBT.length)} Piggles file(s) over 250 lines left as debt, ${String(PIGGLES_DEBT_HELD_BY_PARENT.length)} held by one, ${String(EXCEPTIONS.length)} exception(s).`
);
