import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reconcileWords, recentChangesWords } from './provenance-copy';

/**
 * "EVERY ONE OF THE 1 RECORDED CHANGE, ADDED TOGETHER."
 *
 * On the pane whose entire job is to make a stock figure trustworthy, over 54
 * of Juniper Row's 74 stock rows. A `plural()` helper made the noun agree and
 * left the rest of the sentence plural.
 */
describe('reconcileWords', () => {
  it('does not say "every one of the 1" when there is one change', () => {
    const words = reconcileWords(1, '6');
    expect(words.detail).not.toContain('Every one of the 1');
    expect(words.detail).not.toContain('added together');
    expect(words.detail).toContain('The one change ever recorded');
    expect(words.detail).toContain('comes to exactly 6');
  });

  it('still adds them together when there is more than one', () => {
    const words = reconcileWords(3, '58');
    expect(words.detail).toBe(
      'Every one of the 3 recorded changes to this item here, added together, comes to exactly 58. Nothing has moved that was not written down.'
    );
    expect(words.checked).toBe(true);
  });

  it('does not claim a number was checked when there is no history', () => {
    // Five stock levels platform-wide have no movement at all. They were shown
    // a green tick and "every one of the 0 recorded changes ... comes to
    // exactly 0", which is a verified-looking claim over an empty ledger.
    const words = reconcileWords(0, '0');
    expect(words.checked).toBe(false);
    expect(words.detail).not.toContain('added together');
    expect(words.detail).not.toContain('0 recorded changes');
    expect(words.title).toBe('Nothing has moved this item here');
  });

  it('never prints a bare count directly before the word "recorded change"', () => {
    // The whole failure, stated as a rule.
    for (const n of [0, 1, 2, 3, 20, 100]) {
      expect(reconcileWords(n, '7').detail).not.toMatch(/\b1 recorded change\b/);
    }
  });
});

describe('recentChangesWords', () => {
  it('does not say "the most recent 1 of 1"', () => {
    const line = recentChangesWords(1, 1);
    expect(line).not.toContain('most recent');
    expect(line).not.toContain('each one');
    expect(line).toContain('immediately after it.');
  });

  it('does not imply a truncation that did not happen', () => {
    // The pane asks for 20 movements and no stock level on the platform has
    // more than 5, so "the most recent N of M" has never once been true.
    expect(recentChangesWords(5, 5)).toBe(
      'All 5 recorded changes, newest first. The running total is what the number was immediately after each one.'
    );
  });

  it('says how many were left out when some genuinely were', () => {
    expect(recentChangesWords(20, 64)).toContain('The most recent 20 of 64 recorded changes');
  });
});

/**
 * THE GUARD, so the next sentence cannot do it again.
 *
 * `plural(n, 'thing', 'things')` fixes the noun and nothing else. Every defect
 * above was a sentence around that call which only works at two or more:
 * "added together", "each one", "every one of the", "newest first". The rule
 * this asserts is that such a phrase has to sit inside something that KNOWS the
 * count, so a sentence cannot disagree with the number in front of it.
 *
 * Proven red by restoring the original lines: 5 offending sentences in this
 * console, on 5 different screens.
 */
const PLURAL_ONLY = [
  'added together',
  'each one',
  'each of them',
  'every one of the',
  'between them',
  'all of them',
  ', newest first',
];

/** A branch on the count. The words below it were chosen for that count. */
const KNOWS_THE_COUNT = [/===\s*1\b/, /!==\s*1\b/, />\s*1\b/, />=\s*2\b/, /<\s*2\b/, /<=\s*1\b/];

/**
 * Comments blanked IN PLACE — same length, same newlines — because this file's
 * own header quotes the broken sentence, and a scan that reads comments finds
 * its own evidence. Newlines matter separately: collapsing them reports the
 * offender on a line 100 above the real one.
 */
function codeOnly(source: string): string {
  const blank = (match: string): string => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
}

function surfaceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...surfaceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

describe('a count-aware sentence agrees with its own count', () => {
  it('has no plural-only sentence wrapped around a plural() call', () => {
    const surfaces = dirname(dirname(fileURLToPath(import.meta.url)));
    const offenders: string[] = [];

    for (const file of surfaceFiles(surfaces)) {
      const code = codeOnly(readFileSync(file, 'utf8'));
      let at = code.indexOf('plural(');
      while (at !== -1) {
        const window = code.slice(Math.max(0, at - 260), at + 260);
        const prose = window
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .toLowerCase();
        const found = PLURAL_ONLY.filter((phrase) => prose.includes(phrase));
        if (found.length > 0 && !KNOWS_THE_COUNT.some((rule) => rule.test(window))) {
          offenders.push(`${file}:${code.slice(0, at).split('\n').length} — ${found.join(', ')}`);
        }
        at = code.indexOf('plural(', at + 7);
      }
    }

    expect(offenders).toEqual([]);
  });
});
