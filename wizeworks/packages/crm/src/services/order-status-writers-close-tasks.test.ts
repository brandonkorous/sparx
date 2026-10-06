// EVERY PATH THAT MOVES AN ORDER'S STATUS CLOSES THE TASKS WAITING ON IT.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC: a heredoc eats a
// backslash, and every pattern below is `String.raw`.
//
// ── What this guards ─────────────────────────────────────────────────────────
//
// A task can wait on an order to leave a status (`tasks.closes_when_order_leaves`):
// the held wholesale order's "waiting for your sign-off" task waits on
// `pending_approval`. It stayed open after the account's approver approved
// O-000014 on the site and the order was placed, because nothing that moved the
// order looked at the tasks. `taskService.closeWhenOrderMovesOn` is the one place
// that closes them, and every place that writes an order's status has to call it,
// with what happened.
//
// That is a rule spread across several files, and a rule spread across several
// files is the one a new writer is not told about. Six write an order's status
// today: the approval service (signed off, turned down), cancel, the refund that
// gives every penny back, and fulfillment (sent out, delivered). Checkout is the
// seventh and the exemption below says why. A test of any one of them stays
// green when the next one is written without the call; only a question asked of
// ALL of them goes red. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── How it reads the tree ────────────────────────────────────────────────────
//
// Every non-test file under the platform's packages and services is read with
// its comments blanked. Each `.order.update(` / `.order.updateMany(` call is
// followed to its closing bracket, and if that argument names a `status:` the
// file is a status writer. A status writer must CALL `closeWhenOrderMovesOn(`, or
// `closeSignOffTasks(` (the approval service's wrapper around it).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `wizeworks/`, four levels up from `packages/crm/src/services`. */
const WIZEWORKS = join(__dirname, '..', '..', '..', '..');
const ROOTS = [join(WIZEWORKS, 'packages'), join(WIZEWORKS, 'services')];

const UPDATES_ORDER = String.raw`\.order\.update(?:Many)?\s*\(`;
const WRITES_STATUS = String.raw`\bstatus\s*:`;
const CLOSES_TASKS = String.raw`\b(?:closeWhenOrderMovesOn|closeSignOffTasks)\s*\(`;

const SKIP = [
  `${sep}node_modules${sep}`,
  `${sep}seed`,
  `${sep}sample-data${sep}`,
  '.test.ts',
  '.spec.ts',
  `${sep}test${sep}`,
  `${sep}__tests__${sep}`,
];

/** Writers that cannot leave a task behind, each with the reason. */
const EXEMPT: Record<string, string> = {
  [join('packages', 'commerce', 'src', 'services', 'checkout-service.ts')]:
    'holds an order it created a moment earlier in the same transaction: nothing can be waiting on it yet',
};

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

/** The text of each `.order.update(…)` argument, bracket-matched. */
export function orderUpdateArguments(code: string): string[] {
  const out: string[] = [];
  const re = new RegExp(UPDATES_ORDER, 'g');
  for (let m = re.exec(code); m; m = re.exec(code)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < code.length && depth > 0) {
      const ch = code[i];
      if (ch === '(' || ch === '{' || ch === '[') depth += 1;
      else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
      i += 1;
    }
    out.push(code.slice(start, i - 1));
  }
  return out;
}

interface Writer {
  path: string;
  closes: boolean;
}

function statusWriters(): Writer[] {
  const out: Writer[] = [];
  for (const root of ROOTS) {
    for (const file of tsFiles(root)) {
      if (SKIP.some((fragment) => file.includes(fragment))) continue;
      const code = withoutComments(readFileSync(file, 'utf8'));
      const writes = orderUpdateArguments(code).some((arg) => new RegExp(WRITES_STATUS).test(arg));
      if (!writes) continue;
      out.push({
        path: relative(WIZEWORKS, file),
        closes: new RegExp(CLOSES_TASKS).test(code),
      });
    }
  }
  return out;
}

describe('every writer of an order status closes the tasks waiting on it', () => {
  it('has both trees to read', () => {
    for (const root of ROOTS) {
      expect(existsSync(root), `scan root is missing: ${root}`).toBe(true);
    }
  });

  it('finds the writers it is meant to be checking', () => {
    // The denominator: five files write an order's status today, checkout among
    // them. Dropping to fewer means the scan went blind, not that the rule holds.
    const writers = statusWriters();
    expect(
      writers.length,
      `order status writers found:\n${writers.map((w) => w.path).join('\n')}`
    ).toBeGreaterThanOrEqual(5);
  });

  it('names the ones a held order leaves through', () => {
    const writers = statusWriters();
    for (const fragment of [
      join('packages', 'b2b', 'src', 'approval.ts'),
      join('packages', 'crm', 'src', 'services', 'order-service.ts'),
      join('packages', 'crm', 'src', 'services', 'order-refunds-service.ts'),
    ]) {
      const writer = writers.find((w) => w.path === fragment);
      expect(writer, `${fragment} is no longer in the scan`).toBeDefined();
      expect(writer?.closes, `${fragment} moves an order on without closing its tasks`).toBe(true);
    }
  });

  it('lets no writer out of the rule', () => {
    const missing = statusWriters().filter((w) => !w.closes && !(w.path in EXEMPT));
    expect(
      missing.map((w) => w.path),
      'these write an order status without closing the tasks waiting on it'
    ).toEqual([]);
  });

  it('keeps no exemption for a file that no longer needs one', () => {
    const writers = new Map(statusWriters().map((w) => [w.path, w]));
    for (const path of Object.keys(EXEMPT)) {
      expect(writers.has(path), `${path} is exempt but no longer writes a status`).toBe(true);
    }
  });

  it('tells a status write from any other order write', () => {
    const code = withoutComments(`
      await tx.order.update({ where: { id }, data: { metadata: m } });
      // await tx.order.update({ where: { id }, data: { status: 'placed' } });
      await tx.order.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
    `);
    const args = orderUpdateArguments(code);
    expect(args).toHaveLength(2);
    expect(args.map((a) => new RegExp(WRITES_STATUS).test(a))).toEqual([false, true]);
  });

  it('does not accept an import left behind by a deleted call', () => {
    const leftover = `
      import { closeWhenOrderMovesOn } from './task-service';
      await tx.order.update({ where: { id }, data: { status: 'refunded' } });
    `;
    expect(new RegExp(CLOSES_TASKS).test(withoutComments(leftover))).toBe(false);
  });
});
