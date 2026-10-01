// EVERY PATH THAT WRITES AN ORDER MUST WORK OUT THE BUYER'S OWN FIGURES.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and `\b` inside a template literal is a BACKSPACE character, not
// a word boundary — which is how a spelling guard once scanned 686 files and
// reported everything clean over four real drifts (issue 583). Every pattern
// below is `String.raw`.
//
// ── What this guards, and why it is a guard and not a test ──────────────────
//
// `customers.total_spent` / `total_ordered` / `order_count` / `first_order_at` /
// `last_order_at` are the figures every customer screen, every saved group and
// every scoring rule reads. They used to be NUDGED — the `order.created`
// consumer did `{ increment: payload.total }` — and an increment is only ever as
// reliable as its delivery. Three of five orders on one shop never reached the
// buyer's record, the bus swallowed the failure, and because the refund half
// kept working one customer's lifetime spend rendered as -$42.00.
//
// The fix was to DERIVE them, from the orders, inside the transaction that
// writes the order: `recomputeCustomerCommerce`. `order-events.ts` still carries
// the paragraph explaining why it no longer does this itself.
//
// That makes the rule a property of EVERY writer, and a rule spread across
// several files is exactly the rule a new writer is not told about. Four learned
// it — orderService create, orderService update, the payment path and channel
// ingest. Two did not:
//
//     billing-document-conversion-service.ts   a QUOTE becoming an order
//     import-worker/processors/orders.ts       an order history moved in
//
// So Devi's wholesale buyer, who accepted a quote that morning, had a record
// reading "Orders 3" and "Last order a week ago" and "Their orders come to
// $599.20" four inches above the order itself, dated that day, for $1,008.00.
// And the customer importer next door REFUSES a `total_spent` column from the
// spreadsheet, telling the person in the file report that the figure is "worked
// out from the person's orders" — a promise its neighbour did not keep.
// (issue 894) [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// A test of any one writer would have stayed green through all of this. Only a
// question asked of ALL of them goes red, so that is the question asked here.
//
// ── How it reads the tree ────────────────────────────────────────────────────
//
// It finds every file under the platform's packages and services that creates
// an Order ROW — `<anything>.order.create(` or `.order.createMany(` with the
// comments blanked out first, so the worked example in `after-commit.ts` and the
// explanatory paragraphs above do not count as either a writer or a fix. Seeds
// and sample data are excluded on purpose: they build a whole world in one pass
// and compute the figures themselves.
//
// Every file that survives that filter must also NAME `recomputeCustomerCommerce`.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `wizeworks/`, four levels up from `packages/crm/src/services`. */
const WIZEWORKS = join(__dirname, '..', '..', '..', '..');
const ROOTS = [join(WIZEWORKS, 'packages'), join(WIZEWORKS, 'services')];

/** A row being written to the `order` model, through any client or transaction
 *  handle. The handle is deliberately unconstrained — `tx`, `prisma`, `db` and
 *  `client` have all been used — because what matters is the model, not who
 *  holds it. */
const CREATES_ORDER = String.raw`\.order\.create(?:Many)?\s*\(`;

/** The rule every one of them has to follow — CALLED, not merely named.
 *
 *  The open bracket is load-bearing and was learned the hard way. The first
 *  version of this guard asked whether the file CONTAINED the word, and when the
 *  call was taken back out of the conversion service to prove the guard could
 *  go red, it stayed green: the `import { recomputeCustomerCommerce }` line at
 *  the top of the file satisfied it. An unused import is the exact residue a
 *  deleted call leaves behind, so the one shape this has to tell apart is the
 *  one shape it could not. [[feedback_a_test_that_cannot_go_red]] */
const RECOMPUTE_CALL = String.raw`\brecomputeCustomerCommerce\s*\(`;

/** Seeds and sample data build the whole world in one pass and compute these
 *  figures themselves; a test file's job is to say what should happen, not to
 *  do it. */
const EXEMPT = [
  `${sep}node_modules${sep}`,
  `${sep}seed`,
  `${sep}sample-data${sep}`,
  '.test.ts',
  '.spec.ts',
  `${sep}test${sep}`,
  `${sep}__tests__${sep}`,
];

/** Blank a comment out without losing a single newline, so the line numbers a
 *  failure reports still point at the real line. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead: string) => lead + ' '.repeat(match.length - 1));
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsFiles(full));
      continue;
    }
    if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

interface Writer {
  path: string;
  recomputes: boolean;
}

function orderWriters(): Writer[] {
  const creates = new RegExp(CREATES_ORDER);
  const out: Writer[] = [];
  for (const root of ROOTS) {
    for (const file of tsFiles(root)) {
      if (EXEMPT.some((fragment) => file.includes(fragment))) continue;
      const code = withoutComments(readFileSync(file, 'utf8'));
      if (!creates.test(code)) continue;
      out.push({
        path: relative(WIZEWORKS, file),
        recomputes: new RegExp(RECOMPUTE_CALL).test(code),
      });
    }
  }
  return out;
}

describe('every writer of an order works out what the buyer is worth', () => {
  it('has both trees to read', () => {
    // A guard that hard-codes a path is one refactor away from scanning nothing
    // and printing green. This says so out loud rather than quietly finding
    // zero files. [[feedback_structural_checks_go_blind]]
    for (const root of ROOTS) {
      expect(existsSync(root), `scan root is missing: ${root}`).toBe(true);
    }
  });

  it('finds the writers it is meant to be checking', () => {
    // The denominator. Four writers were known when this was written and two of
    // them were the defect; if a rename or a move drops the count to nothing,
    // every assertion below passes over an empty list, which is the failure
    // mode this exists to refuse.
    const writers = orderWriters();
    expect(
      writers.length,
      `order writers found:\n${writers.map((w) => w.path).join('\n')}`
    ).toBeGreaterThanOrEqual(4);
  });

  it('names the two that were missing it', () => {
    // Named, not merely counted. These are the two the screen caught, and a
    // future refactor that quietly drops the call from one of them reddens
    // HERE with the file's own name rather than in a general count.
    const writers = orderWriters();
    const byName = (fragment: string) => writers.find((w) => w.path.includes(fragment));

    const conversion = byName('billing-document-conversion-service.ts');
    expect(conversion, 'the quote-to-order writer is no longer in the scan').toBeDefined();
    expect(conversion?.recomputes, 'a quote becoming an order must recompute').toBe(true);

    const importer = byName(join('import-worker', 'src', 'processors', 'orders.ts'));
    expect(importer, 'the order importer is no longer in the scan').toBeDefined();
    expect(importer?.recomputes, 'an imported order must recompute').toBe(true);
  });

  it('lets no writer out of the rule', () => {
    const missing = orderWriters().filter((w) => !w.recomputes);
    expect(
      missing.map((w) => w.path),
      'these write an Order row without working out the buyer’s own figures'
    ).toEqual([]);
  });

  it('is asking about a rule that still does something', () => {
    // `recomputeCustomerCommerce` is matched by NAME above, so a version of it
    // that had stopped writing would leave every assertion green. This pins the
    // five fields it exists to set. [[feedback_a_test_that_cannot_go_red]]
    const rollup = withoutComments(readFileSync(join(__dirname, 'customer-rollup.ts'), 'utf8'));
    expect(rollup).toContain('tx.customer.update');
    for (const field of [
      'totalSpent:',
      'totalOrdered:',
      'orderCount:',
      'firstOrderAt:',
      'lastOrderAt:',
    ]) {
      expect(rollup, `the rollup no longer writes ${field}`).toContain(field);
    }
  });

  it('reads code and not the paragraphs about it', () => {
    // Two files talk about this rule at length without following it — the
    // worked example in `after-commit.ts` and `checkout-service.ts`'s note that
    // orderService will do it a moment later. Neither writes an Order row, and
    // if comment-blanking ever broke, the first would be counted as a writer
    // and the second as a fix.
    const speaking = `
      // const order = await tx.order.create({ data });
      /* recomputeCustomerCommerce is called by orderService.create */
    `;
    expect(new RegExp(CREATES_ORDER).test(withoutComments(speaking))).toBe(false);
    expect(new RegExp(RECOMPUTE_CALL).test(withoutComments(speaking))).toBe(false);
  });

  it('does not accept an import left behind by a deleted call', () => {
    // The hole the first version of this guard had, pinned so it cannot come
    // back. Deleting a call almost never deletes its import — the linter
    // complains, someone silences it, and the file still spells the name.
    const leftover = `
      import { recomputeCustomerCommerce } from './customer-rollup';
      const order = await tx.order.create({ data });
    `;
    expect(new RegExp(CREATES_ORDER).test(leftover)).toBe(true);
    expect(new RegExp(RECOMPUTE_CALL).test(leftover)).toBe(false);
  });
});
