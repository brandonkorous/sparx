import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { READ_ONLY_ACTION_PREFIXES, sentenceForAction } from './activity-language';

// WHAT HAS BEEN HAPPENING HAS TO BE READABLE BY THE PERSON IT HAPPENED TO.
//
// `audit_logs.action` is a machine string and the feed turns it into a sentence
// by convention. The convention is good — it resolves ~400 actions correctly
// with no table entry — but it is FAITHFUL, which means an action segment that
// is an abbreviation comes out as an abbreviation, and a developer's verb comes
// out as a developer's verb. Nothing errors. Nothing is empty. The feed just
// quietly speaks a language its reader does not.
//
// Measured 2026-09-25, on P03's own account: the top of her feed read
//
//     B2b ar created · Template seeded · Document snapshot frozen · Line added
//
// and across the 509 actions this scan can see, 96 came out unreadable. The
// override table has been grown to cover them. This test is what keeps it grown:
// a new action whose convention output is jargon reddens here on the commit that
// adds it, rather than on the day somebody opens the pane.
//
// It scans the REPO, not a fixture, so the denominator moves with the code.
// [[feedback_structural_checks_go_blind]] [[feedback_non_technical_audience]]

/** The repo root, found by its marker rather than by counting `..`s. */
function repoRoot(): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('repo root not found: no pnpm-workspace.yaml above this file');
}

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsFiles(full, out);
    else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/**
 * The audit actions this scan can see.
 *
 * NOT all of them, and saying so is part of the guard. Most are written as
 * `writeAuditLog({ … action: 'commerce.product.created' … })`, which is exactly
 * greppable. Three other shapes exist and only two of them are:
 *
 *   action: cond ? 'email.broadcast.sent' : 'email.broadcast.scheduled'
 *   transitionDeletedAt(ctx, id, date, 'commerce.variant.archived')
 *   `mcp.${toolName}`                                   not greppable at all
 *
 * So it reads any dotted literal on a line mentioning `action:` or `audit`,
 * which catches the first two and misses the assembled ones plus a few written
 * through helpers with their own type unions (`booking.*`). Measured 2026-09-25
 * against a database holding 354 distinct actions: this scan sees 464, and 82
 * of the database's are outside it.
 *
 * That is enough for what this test does. Every action it CAN see is checked,
 * and the families it misses are closed sets with their own type unions, so
 * nobody adds to them by accident. What would NOT be fine is the scan silently
 * finding nothing, which the denominator below exists to catch.
 */
function auditActions(): { actions: string[]; scanned: number } {
  const root = repoRoot();
  const roots = [join(root, 'wizeworks', 'packages'), join(root, 'wizeworks', 'services')];
  for (const dir of roots) {
    // A scan root that stopped existing is how a check goes blind and prints a
    // tick over nothing.
    if (!existsSync(dir)) throw new Error(`scan root missing: ${dir}`);
  }
  const found = new Set<string>();
  let scanned = 0;
  for (const dir of roots) {
    for (const file of tsFiles(dir)) {
      scanned += 1;
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!/\baction:/.test(line) && !/[Aa]udit/.test(line)) continue;
        for (const m of line.matchAll(/'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g)) {
          found.add(m[1] as string);
        }
      }
    }
  }
  return { actions: [...found].sort(), scanned };
}

function reaches(action: string): boolean {
  return !READ_ONLY_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}

describe('what has been happening', () => {
  const { actions, scanned } = auditActions();
  const shown = actions.filter(reaches);

  it('finds the audit actions to check', () => {
    // The denominator. A regex that stopped matching, or a tree that moved,
    // would otherwise leave every assertion below passing over an empty list.
    expect(scanned).toBeGreaterThan(1000);
    expect(actions.length).toBeGreaterThan(350);
    expect(shown.length).toBeGreaterThan(350);
    // And the scan really is reading the platform, not one corner of it.
    const heads = new Set(shown.map((a) => a.split('.')[0]));
    for (const head of ['commerce', 'crm', 'inventory', 'invoicing', 'builder', 'email']) {
      expect(heads.has(head), `no ${head}.* actions found — the scan is partial`).toBe(true);
    }
  });

  // Words that mean something precise to whoever wrote the action and nothing at
  // all to the person reading the feed. Four kinds, all of them measured on real
  // rows rather than imagined:
  //
  //   a verb from inside the machine   seeded, bootstrapped, upserted
  //   an abbreviation                  bom, uom, sla, b2b, ar
  //   a run-together word              accountcredit, takenback, giftcard
  //   an internal proper noun          mcp, silica, sitebuilder, archetype
  //
  // An all-caps spelling is allowed through: "Variant SKU renamed" and "Page SEO
  // updated" print an acronym the consoles already use on every product and page
  // screen, which is a different thing from "Sku" appearing because nobody looked.
  const JARGON = new Set([
    'seeded',
    'seed',
    'bootstrapped',
    'provisioned',
    'backfilled',
    'ensured',
    'materialized',
    'materialised',
    'instantiated',
    'upserted',
    'upsert',
    'dispositioned',
    'reparented',
    'forked',
    'ingested',
    'recompute',
    'freshness',
    'idempotent',
    'payload',
    'mutex',
    'snapshot',
    'hydrated',
    'serialized',
    'enqueued',
    'dequeued',
    'nullable',
    'uuid',
    'jsonb',
    'bom',
    'uom',
    'uoms',
    'sla',
    'b2b',
    'ar',
    'sku',
    'accountcredit',
    'takenback',
    'giftcard',
    'mcp',
    'silica',
    'sitebuilder',
    'archetype',
    'archetypes',
    'schema',
    'config',
    'def',
    'defs',
  ]);
  const ACRONYM_OK = new Set(['SKU', 'SEO']);

  it('never prints a word out of the machine at the person it happened to', () => {
    const offenders: string[] = [];
    for (const action of shown) {
      const sentence = sentenceForAction(action);
      for (const token of sentence.split(/[^A-Za-z]+/).filter(Boolean)) {
        if (ACRONYM_OK.has(token)) continue;
        if (!JARGON.has(token.toLowerCase())) continue;
        offenders.push(`${action}  →  "${sentence}"  (the word: ${token})`);
        break;
      }
    }
    expect(
      offenders,
      'add an entry to OVERRIDE in activity-language.ts saying what actually happened'
    ).toEqual([]);
  });

  it('never leaves a sentence with no subject or no verb', () => {
    const offenders: string[] = [];
    for (const action of shown) {
      const sentence = sentenceForAction(action);
      // One word is a sentence with half of it missing: "Adjusted", "Published".
      if (sentence.split(' ').length < 2) offenders.push(`${action}  →  "${sentence}"`);
      // And it has to start like a sentence, not like the middle of one.
      if (sentence.length > 0 && sentence[0] !== sentence[0]?.toUpperCase()) {
        offenders.push(`${action}  →  "${sentence}" does not start with a capital`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Two actions may share a sentence ONLY when they are the same event written
   * from two places — the same publish done by hand and by an assistant, the
   * same stock adjustment audited by two modules. Anything else is the feed
   * telling a person the same words about two different things, which is how
   * `webhook.subscription.created` and `commerce.subscription.created` both read
   * "Subscription created": a developer's callback and a customer's repeat
   * order under one name. [[feedback_one_outcome_two_causes]]
   */
  const SHARED_ON_PURPOSE: Record<string, string> = {
    'Automatic emails set up': 'the same provisioning, run at two moments',
    'Inventory adjusted': 'one stock change, audited by commerce and by inventory',
    'Inventory reorder policy set': 'one policy, audited by commerce and by inventory',
    'Page deleted': 'the same delete, by hand or through an assistant',
    'Site published': 'the same publish, by hand or through an assistant',
    'Theme saved': 'the same save, by hand or through an assistant',
    'Warehouse created': 'one warehouse, audited by commerce and by inventory',
    'Content entry created': 'the same entry, by hand or through an assistant',
  };

  it('does not say the same words about two different things', () => {
    const bySentence = new Map<string, string[]>();
    for (const action of shown) {
      const sentence = sentenceForAction(action);
      bySentence.set(sentence, [...(bySentence.get(sentence) ?? []), action]);
    }
    const unexplained: string[] = [];
    for (const [sentence, group] of bySentence) {
      if (group.length < 2) continue;
      if (SHARED_ON_PURPOSE[sentence]) continue;
      unexplained.push(`"${sentence}" ← ${group.join(', ')}`);
    }
    expect(unexplained).toEqual([]);
  });

  it('keeps the override table an exception rather than the rule', () => {
    // The convention is the mechanism; the table is the repair. If most actions
    // needed an entry the convention would have stopped earning its place, and
    // the file's whole argument would need rewriting rather than extending.
    const source = readFileSync(join(import.meta.dirname, 'activity-language.ts'), 'utf8');
    const start = source.indexOf('const OVERRIDE: Record<string, string> = {');
    expect(start).toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf('\n};', start));
    const entries = [...block.matchAll(/^\s*'[^']+':\s*'[^']*'/gm)].length;
    expect(entries).toBeGreaterThan(100);
    expect(entries).toBeLessThan(shown.length / 2);
  });
});

describe('the module a row is tinted with', () => {
  it('leaves an unmapped namespace null rather than guessing', async () => {
    const { moduleForAction } = await import('./activity-language');
    expect(moduleForAction('commerce.product.created')).toBe('commerce');
    expect(moduleForAction('booking.created')).toBe('scheduling');
    expect(moduleForAction('nonsense.thing.happened')).toBeNull();
  });
});

// Nothing below relies on `subjectFromDiff`: the subject is the tenant's own
// data, and renaming that would be this console putting words in her mouth. The
// relative path is asserted only so a file move is noticed.
describe('this test is where it thinks it is', () => {
  it('sits beside the file it checks', () => {
    const rel = relative(repoRoot(), import.meta.dirname)
      .split(sep)
      .join('/');
    expect(rel).toBe('wizeworks/services/api-rest/src/lib');
  });
});
