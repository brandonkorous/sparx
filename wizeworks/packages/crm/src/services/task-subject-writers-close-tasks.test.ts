// EVERY PATH THAT MOVES WHAT A TASK WAITS ON CLOSES THE TASKS WAITING ON IT.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC: a heredoc eats a
// backslash, and every pattern below is `String.raw`.
//
// ── What this guards ─────────────────────────────────────────────────────────
//
// A task the platform opens can close itself when its reason is gone:
//
//   account   "Set up prices and terms for Wasatch Front Utility Contractors,
//             LLC" closes once the account is set up. It stayed open on Gillett
//             while Wasatch had the Fleet tier, Net 30 and a $25,000 limit,
//             because nothing that saved the account looked at the task.
//   deal      "Follow up" / "Create invoice" close when the deal leaves the kind
//             of stage they were opened for.
//   document  "<number> was approved: take it to the next step" closes when the
//             document is taken on, turned into an order, voided or removed.
//
// Each closes through ONE function in taskService, and every place that writes
// what it watches has to call that function, in the same transaction. A rule
// spread across several files is the one a new writer is not told about: a test
// of any one writer stays green when the next is written without the call; only
// a question asked of ALL of them goes red. [[feedback_a_fix_leaves_its_neighbour_behind]]
// The order twin of this file is `order-status-writers-close-tasks.test.ts`.
//
// ── How it reads the tree ────────────────────────────────────────────────────
//
// Every non-test file under the platform's packages and services is read with
// its comments blanked. Each `.<model>.update(` / `.updateMany(` / `.upsert(`
// call is followed to its closing bracket, and the object literals under its
// `data:`, `update:` and `create:` keys are searched for the watched fields (not
// its `where:`, so `where: { deletedAt: null }` is not a removal). A file with
// such a write must CALL the subject's closer. Raw SQL that UPDATEs the table's
// watched columns counts as a write too.
//
// What it cannot see: a write whose data is built in a variable first
// (`data.voidedAt = ...; update({ data })`). The one such write today is the
// billing stage's entry effects, which only ever run inside a stage move or a
// document create, and the move calls the closer. A create is never a write
// here either: nothing can be waiting on a row that did not exist.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `wizeworks/`, four levels up from `packages/crm/src/services`. */
const WIZEWORKS = join(__dirname, '..', '..', '..', '..');
const ROOTS = [join(WIZEWORKS, 'packages'), join(WIZEWORKS, 'services')];

interface Subject {
  name: string;
  /** Prisma writes of the model: `.company.update(` and friends. */
  write: string;
  /** Field names in the written data that move what a task waits on. */
  watched: string;
  /** Raw SQL that writes the watched columns. */
  rawSql: string;
  /** The closer every writer must call. */
  closer: string;
  /** Writers the scan must find, so a blind scan cannot pass. */
  mustFind: string[];
  /** Writers that cannot leave a task behind, each with the reason. */
  exempt: Record<string, string>;
}

const SUBJECTS: Subject[] = [
  {
    name: 'account set-up (price tier, terms, credit limit, removal)',
    write: String.raw`\.company\.(?:update|updateMany|upsert)\s*\(`,
    watched: String.raw`\b(?:pricingTierId|creditLimit|paymentTerms|deletedAt)\s*:`,
    rawSql: String.raw`\bUPDATE\s+"?companies"?\s[\s\S]{0,400}?\b(?:pricing_tier_id|credit_limit|payment_terms|deleted_at)\b`,
    closer: String.raw`\bcloseWhenAccountSetUp\s*\(`,
    mustFind: [
      // The CRM company save (and the import, which saves through it).
      join('packages', 'crm', 'src', 'services', 'company-service.ts'),
      // The console's wholesale account save and the MCP trade-config tool.
      join('packages', 'b2b', 'src', 'accounts.ts'),
    ],
    exempt: {},
  },
  {
    name: 'deal stage (a move, a removal, a stage changing what it means)',
    write: String.raw`\.(?:deal\.(?:update|updateMany|upsert)|pipelineStage\.(?:update|updateMany))\s*\(`,
    watched: String.raw`\b(?:stageId|deletedAt|stageType)\s*:`,
    rawSql: String.raw`\bUPDATE\s+"?(?:deals|pipeline_stages)"?\s[\s\S]{0,400}?\b(?:stage_id|deleted_at|stage_type)\b`,
    closer: String.raw`\bcloseWhenDealMovesOn\s*\(`,
    mustFind: [
      join('packages', 'crm', 'src', 'services', 'deal-service.ts'),
      join('packages', 'crm', 'src', 'services', 'pipeline-service.ts'),
    ],
    exempt: {},
  },
  {
    name: 'billing document (a stage move, a void, a removal, a conversion)',
    write: String.raw`\.billingDocument\.(?:update|updateMany|upsert)\s*\(`,
    watched: String.raw`\b(?:stageId|voidedAt|deletedAt|convertedAt)\s*:`,
    rawSql: String.raw`\bUPDATE\s+"?billing_documents"?\s[\s\S]{0,400}?\b(?:stage_id|voided_at|deleted_at|converted_at)\b`,
    closer: String.raw`\bcloseWhenDocumentMovesOn\s*\(`,
    mustFind: [
      join('packages', 'crm', 'src', 'services', 'billing-document-stage-service.ts'),
      join('packages', 'crm', 'src', 'services', 'billing-document-service.ts'),
      join('packages', 'crm', 'src', 'services', 'billing-document-conversion-service.ts'),
      join('packages', 'crm', 'src', 'services', 'b2b-ar-service.ts'),
      join('packages', 'crm', 'src', 'services', 'signature-service.ts'),
    ],
    exempt: {},
  },
];

const SKIP = [
  `${sep}node_modules${sep}`,
  `${sep}seed`,
  `${sep}sample-data${sep}`,
  '.test.ts',
  '.spec.ts',
  `${sep}test${sep}`,
  `${sep}__tests__${sep}`,
];

function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead: string) => lead + ' '.repeat(match.length - 1));
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo' || entry === '.next') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsFiles(full));
      continue;
    }
    if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** The text between a bracket at `open` and its partner (exclusive). */
function bracketed(code: string, open: number): string {
  let depth = 1;
  let i = open + 1;
  while (i < code.length && depth > 0) {
    const ch = code[i];
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    i += 1;
  }
  return code.slice(open + 1, i - 1);
}

/** The argument text of each call matching `write`, bracket-matched. */
export function callArguments(code: string, write: string): string[] {
  const out: string[] = [];
  const re = new RegExp(write, 'g');
  for (let m = re.exec(code); m; m = re.exec(code)) {
    out.push(bracketed(code, m.index + m[0].length - 1));
  }
  return out;
}

/** The object literals a write puts on the row: under `data:`, and under an
 *  upsert's `update:` / `create:`. Never its `where:`. */
export function writtenData(argument: string): string {
  const out: string[] = [];
  const re = /\b(?:data|update|create)\s*:\s*\{/g;
  for (let m = re.exec(argument); m; m = re.exec(argument)) {
    out.push(bracketed(argument, m.index + m[0].length - 1));
  }
  return out.join('\n');
}

interface Writer {
  path: string;
  closes: boolean;
}

/** Read once: the scan walks the whole tree. */
const SOURCES: { path: string; code: string }[] = (() => {
  const out: { path: string; code: string }[] = [];
  for (const root of ROOTS) {
    if (!existsSync(root)) continue;
    for (const file of tsFiles(root)) {
      if (SKIP.some((fragment) => file.includes(fragment))) continue;
      out.push({
        path: relative(WIZEWORKS, file),
        code: withoutComments(readFileSync(file, 'utf8')),
      });
    }
  }
  return out;
})();

function writersOf(subject: Subject): Writer[] {
  const watched = new RegExp(subject.watched);
  const raw = new RegExp(subject.rawSql, 'i');
  const closer = new RegExp(subject.closer);
  const out: Writer[] = [];
  for (const { path, code } of SOURCES) {
    const writes =
      callArguments(code, subject.write).some((arg) => watched.test(writtenData(arg))) ||
      raw.test(code);
    if (!writes) continue;
    out.push({ path, closes: closer.test(code) });
  }
  return out;
}

describe('every writer of what a waiting task watches closes the task', () => {
  it('has both trees to read', () => {
    for (const root of ROOTS) {
      expect(existsSync(root), `scan root is missing: ${root}`).toBe(true);
    }
    // The denominator for the whole scan: hundreds of files, not a handful.
    expect(SOURCES.length).toBeGreaterThan(500);
  });

  for (const subject of SUBJECTS) {
    describe(subject.name, () => {
      it('finds the writers it is meant to be checking', () => {
        const writers = writersOf(subject);
        const found = writers.map((w) => w.path);
        for (const path of subject.mustFind) {
          expect(found, `${path} is no longer in the scan:\n${found.join('\n')}`).toContain(path);
        }
      });

      it('lets no writer out of the rule', () => {
        const missing = writersOf(subject).filter((w) => !w.closes && !(w.path in subject.exempt));
        expect(
          missing.map((w) => w.path),
          'these write what a task waits on without closing the tasks waiting on it'
        ).toEqual([]);
      });

      it('keeps no exemption for a file that no longer needs one', () => {
        const writers = new Set(writersOf(subject).map((w) => w.path));
        for (const path of Object.keys(subject.exempt)) {
          expect(writers.has(path), `${path} is exempt but no longer writes`).toBe(true);
        }
      });
    });
  }

  it('tells a watched write from any other write of the same row', () => {
    const [account] = SUBJECTS;
    const code = withoutComments(`
      await tx.company.update({ where: { id }, data: { notes: n } });
      // await tx.company.update({ where: { id }, data: { creditLimit: 5 } });
      await tx.company.updateMany({ where: { id, deletedAt: null }, data: { status: 'active' } });
      await tx.company.update({
        where: { id },
        data: { paymentTerms: 'net30', updatedAt: new Date() },
      });
    `);
    const args = callArguments(code, account!.write);
    expect(args).toHaveLength(3);
    expect(args.map((a) => new RegExp(account!.watched).test(writtenData(a)))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('reads raw SQL that writes a watched column', () => {
    const [account] = SUBJECTS;
    const sql = 'await tx.$executeRaw`UPDATE companies SET credit_limit = 0 WHERE id = ${id}`;';
    expect(new RegExp(account!.rawSql, 'i').test(sql)).toBe(true);
    const unrelated = 'await tx.$executeRaw`UPDATE companies SET notes = null WHERE id = ${id}`;';
    expect(new RegExp(account!.rawSql, 'i').test(unrelated)).toBe(false);
  });

  it('does not accept an import left behind by a deleted call', () => {
    const [account] = SUBJECTS;
    const leftover = `
      import { closeWhenAccountSetUp } from './task-service';
      await tx.company.update({ where: { id }, data: { creditLimit: 25000 } });
    `;
    expect(new RegExp(account!.closer).test(withoutComments(leftover))).toBe(false);
  });
});
