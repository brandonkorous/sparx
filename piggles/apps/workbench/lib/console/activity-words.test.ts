import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RENAMED_ACTIONS, activityWord } from './activity-words';

// A RENAME FOR AN ACTION NOTHING WRITES RENAMES NOTHING.
//
// `vocabulary.ts` carries a warning in its own header about exactly this: it
// held an entry for `builder.studio` for months after that key stopped
// existing, and the entry read as a screen this brand had named while renaming
// nothing at all. The same trap is open here, and wider — an audit action is a
// string in a service somewhere, with no registry and no type to check it
// against, so a typo in a key is invisible forever.
//
// So the keys are checked against the actions the platform actually writes,
// found by scanning for them. [[feedback_absent_behaves_like_fine]]

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

function auditActions(): Set<string> {
  const root = repoRoot();
  const roots = [join(root, 'wizeworks', 'packages'), join(root, 'wizeworks', 'services')];
  for (const dir of roots) {
    if (!existsSync(dir)) throw new Error(`scan root missing: ${dir}`);
  }
  const found = new Set<string>();
  for (const dir of roots) {
    for (const file of tsFiles(dir)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!/\baction:/.test(line) && !/[Aa]udit/.test(line)) continue;
        for (const m of line.matchAll(/'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g)) {
          found.add(m[1] as string);
        }
      }
    }
  }
  return found;
}

/**
 * Actions no grep can find, confirmed present in a real `audit_logs` table.
 *
 * A handful are assembled rather than written out — `` `commerce.review.${status}` ``
 * in review-service, `` `commerce.surcharge_rule.${verb}` `` in surcharge-service —
 * or passed positionally into a helper that does the audit write, as
 * `transitionDeletedAt(ctx, id, date, 'commerce.variant.archived')` does. The
 * scan above cannot see them, so without this list the check below would call a
 * CORRECT entry dead and push somebody to delete it. A false alarm that removes
 * working code is worse than a miss.
 *
 * Measured 2026-09-25 on the development database:
 *
 *     SELECT DISTINCT action FROM audit_logs ORDER BY 1;   -- 354 rows
 *
 * The test asserts each one is STILL invisible to the scan, so an entry that
 * becomes greppable gets removed rather than quietly sitting here forever.
 */
const WRITTEN_ANOTHER_WAY = new Set([
  'commerce.fitment.category_created',
  'commerce.fitment.item_created',
  'commerce.variant.archived',
  'commerce.variant.restored',
  'commerce.warehouse.created',
]);

describe('the words Piggles uses for what has been happening', () => {
  const written = auditActions();

  it('renames only actions the platform really writes', () => {
    // The denominator first: a scan that found nothing would make every key
    // below look wrong, and a scan that found everything would make none of
    // them checkable.
    expect(written.size).toBeGreaterThan(350);
    expect(RENAMED_ACTIONS.length).toBeGreaterThan(50);

    const unwritten = RENAMED_ACTIONS.filter(
      (action) => !written.has(action) && !WRITTEN_ANOTHER_WAY.has(action)
    );
    expect(unwritten, 'these keys rename nothing: no service writes that audit action').toEqual([]);
  });

  it('keeps the ungreppable list to what is really ungreppable', () => {
    const nowFindable = [...WRITTEN_ANOTHER_WAY].filter((action) => written.has(action));
    expect(
      nowFindable,
      'the scan can see these now — take them out of WRITTEN_ANOTHER_WAY'
    ).toEqual([]);
    // And every one of them must be a rename this file actually makes, or it is
    // an exemption for nothing.
    const unused = [...WRITTEN_ANOTHER_WAY].filter((a) => !RENAMED_ACTIONS.includes(a));
    expect(unused).toEqual([]);
  });

  it('leaves the platform sentence alone when there is nothing to say', () => {
    // The great majority. An entry for every action would be a second copy of
    // the API's table to keep in step, and the absence of one is the honest
    // statement that the platform already got it right.
    expect(activityWord('commerce.product.created', 'Product created')).toBe('Product created');
    expect(activityWord('booking.cancelled', 'Booking cancelled')).toBe('Booking cancelled');
    expect(activityWord('crm.task.created', 'Task created')).toBe('Task created');
    expect(RENAMED_ACTIONS.length).toBeLessThan(written.size / 2);
  });

  it('says the thing the rest of the console says', () => {
    expect(activityWord('commerce.fitment.product_set', 'Fitment product set')).toBe(
      'What a product fits was set'
    );
    expect(activityWord('crm.segment.created', 'Segment created')).toBe(
      'Group of customers created'
    );
    expect(activityWord('crm.deal.stage_changed', 'Deal stage changed')).toBe(
      'Deal moved to another step'
    );
    expect(activityWord('inventory.bom.created', 'Bill of materials created')).toBe(
      'Recipe created'
    );
  });

  it('never reaches for a word the brand has taken off its screens', () => {
    // The words piggles/CLAUDE.md RULE #3 and the vocabulary file name as terms
    // a shop owner must not be made to learn. A rename that used one of them
    // would be renaming a platform word to another platform word.
    const BANNED = [
      'fitment',
      'configurator',
      'segment',
      'pipeline',
      'collection',
      'variant',
      'sku',
      'warehouse',
      'bill of materials',
      'suppression',
      'broadcast',
      'redirect',
      'b2b',
      'ticket',
    ];
    const offenders: string[] = [];
    for (const action of RENAMED_ACTIONS) {
      const sentence = activityWord(action, '').toLowerCase();
      for (const word of BANNED) {
        if (sentence.includes(word)) offenders.push(`${action} → "${sentence}" (${word})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
