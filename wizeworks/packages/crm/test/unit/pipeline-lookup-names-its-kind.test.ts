// EVERY PIPELINE LOOKUP HAS TO SAY WHICH KIND OF PIPELINE IT WANTS.
//
// A pipeline used to be, implicitly, a sales pipeline. Then pipelines became
// generic (docs/144 §7.2): a support queue is a pipeline too, it lives in the
// same table, it is flagged default in its own right, and its first stage is an
// `open` stage exactly like a sales pipeline's. So a query that asks for "the
// default pipeline" now has two right answers and picks one by luck.
//
// That is not hypothetical. `resolveEntryPipeline` in lead-service — the lookup
// that decides where a deal from a website enquiry form lands — read:
//
//     where: { archivedAt: null },
//     orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
//
// On every tenant running both, the sales pipeline and the support queue are
// BOTH `isDefault` and both `sortOrder: 0`. The only thing keeping quote
// requests out of the help desk was that the sales pipeline is seeded about two
// seconds earlier and wins the `createdAt` tiebreak. Archiving the sales
// pipeline — one button on its own pane, which clears its default flag on the
// way out — flips it immediately, and the next enquiry opens a deal inside the
// support queue, in a stage called "Still open", on a board the deals list
// cannot draw because a board is one sales process.
//
// `pipelineService.list` already defaults to `'deal'` and explains why in its
// own comment. `bootstrapDefaultPipeline` already filters on it. `ticketService`
// already filters on it. One lookup did not, and nothing could tell.
//
// So this guard is a source scan rather than a case: the defect is a lookup
// somebody WILL add next, not this particular one. It reads every
// `tx.pipeline.find*` / `count` in the package and requires each to be keyed by
// primary key (`id`) or to name `objectKey`. It refuses loudly on a shape it
// cannot classify rather than passing it — a scan that silently skips what it
// does not understand is a scan that reports green over the next bug.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

/** Blank out comments, preserving newlines so reported line numbers stay true
 *  (a `' '.repeat(n)` here puts the offender about a hundred lines off). */
function codeOnly(source: string): string {
  const blank = (match: string): string => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsFiles(full));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/** The balanced `{…}` starting at `open`, or null when it never closes. */
function braced(source: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

interface Lookup {
  where: string;
  file: string;
  line: number;
}

/**
 * The where-clause of every pipeline finder in the package, resolved through a
 * `const where = {…}` when the call passes one by name. Throws rather than
 * skipping when a call cannot be read.
 */
function pipelineLookups(): Lookup[] {
  const found: Lookup[] = [];
  for (const file of tsFiles(SRC)) {
    const code = codeOnly(readFileSync(file, 'utf8'));
    const shown = relative(SRC, file).split(sep).join('/');
    const calls = /\btx\.pipeline\.(?:findFirst|findMany|findUnique|count)\s*\(\s*/g;
    let match: RegExpExecArray | null;
    while ((match = calls.exec(code)) !== null) {
      const at = match.index + match[0].length;
      const line = lineOf(code, match.index);
      const arg = braced(code, at);
      if (arg === null) {
        throw new Error(`${shown}:${String(line)} — could not read the call argument`);
      }

      const inline = /where\s*:\s*\{/.exec(arg);
      if (inline) {
        const literal = braced(arg, inline.index + inline[0].length - 1);
        if (literal === null) {
          throw new Error(`${shown}:${String(line)} — could not read the where clause`);
        }
        found.push({ where: literal, file: shown, line });
        continue;
      }

      // `{ where }` shorthand, or `where: someName` — resolve the declaration.
      const named = /where\s*(?::\s*([A-Za-z_$][\w$]*))?\s*[,}]/.exec(arg);
      if (named === null) {
        // No where at all: a finder over every pipeline of every kind.
        found.push({ where: '', file: shown, line });
        continue;
      }
      const name = named[1] ?? 'where';
      const declAt = code.indexOf(`const ${name}`);
      const assign = declAt < 0 ? -1 : code.indexOf('=', declAt);
      const opens = assign < 0 ? -1 : code.indexOf('{', assign);
      if (opens < 0) {
        throw new Error(
          `${shown}:${String(line)} — where is "${name}", and no declaration of it was found`
        );
      }
      const literal = braced(code, opens);
      if (literal === null) {
        throw new Error(`${shown}:${String(line)} — could not read the "${name}" declaration`);
      }
      found.push({ where: literal, file: shown, line });
    }
  }
  return found;
}

describe('a pipeline lookup', () => {
  it('is scanning something', () => {
    // A scan that hard-codes a path is one refactor away from reading nothing
    // and printing green, so the denominator is asserted, not assumed.
    expect(statSync(SRC).isDirectory()).toBe(true);
    expect(pipelineLookups().length).toBeGreaterThanOrEqual(8);
  });

  it('says which kind of pipeline it wants, or asks by id', () => {
    // `objectKey` unqualified, because the list builder spreads it in as the
    // `{ objectKey }` shorthand — naming the field is the thing being asked
    // for, and how it is spelled into the clause is not this guard's business.
    const vague = pipelineLookups().filter(
      (lookup) => !/\bid\s*:/.test(lookup.where) && !/\bobjectKey\b/.test(lookup.where)
    );
    expect(
      vague.map((lookup) => `${lookup.file}:${String(lookup.line)}`),
      'a pipeline can be a sales process or a support queue; a lookup that does ' +
        'not say which gets whichever happened to be seeded first'
    ).toEqual([]);
  });
});
