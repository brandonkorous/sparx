// WHO MAY CHANGE HOW THE BUSINESS IS SET UP IS WRITTEN ONCE.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. Every pattern
// below is `String.raw`, and a heredoc eats backslashes.
//
// The rule "an owner or an admin" was written out by hand in fifteen places, in
// three spellings, and the screens that most needed it had none: Alyssa, an
// Editor, typed into Business details and was refused on Save with false advice
// (sparx persona issue 168). One helper, `canManageBusiness`, and this guard
// keeps it the only copy.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { canManageBusiness } from './manage-rights';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, '..');

/** Files that compare roles for another reason, with the reason. */
const NOT_THE_RULE = new Map<string, string>([
  ['lib/manage-rights.ts', 'the one copy'],
  ['surfaces/team/reach.ts', "describes what ANOTHER person can reach, not the viewer's right"],
  [
    'surfaces/partner/partner-access-data.ts',
    "describes what ANOTHER person can reach, not the viewer's right",
  ],
]);

/** "owner or admin" spelled out: the two comparisons within one expression. */
const SPELLED_OUT = new RegExp(
  String.raw`role\s*===\s*'(owner|admin)'[^;\n]{0,60}role\s*===\s*'(owner|admin)'`,
  'i'
);
/** The same rule as a rank: `ROLE_RANK[...] ... >= 2` is owner or admin. */
const AS_A_RANK = new RegExp(String.raw`ROLE_RANK\[[^\]]+\][^;\n]{0,20}>=\s*2\b`);

function sourceFiles(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
        out.push({
          name: relative(WORKBENCH, next).replaceAll('\\', '/'),
          text: readFileSync(next, 'utf8'),
        });
    }
  };
  for (const dir of ['surfaces', 'components', 'lib']) walk(join(WORKBENCH, dir));
  return out;
}

describe('who may change how the business is set up', () => {
  it('is an owner or an admin, and nobody else', () => {
    expect(canManageBusiness('owner')).toBe(true);
    expect(canManageBusiness('admin')).toBe(true);
    for (const role of ['editor', 'viewer', 'builder', 'marketing', 'support', 'partner']) {
      expect(canManageBusiness(role)).toBe(false);
    }
    expect(canManageBusiness(undefined)).toBe(false);
  });

  it('is decided in one place', () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(200);
    const copies = files
      .filter((file) => !NOT_THE_RULE.has(file.name))
      .filter((file) => SPELLED_OUT.test(file.text) || AS_A_RANK.test(file.text))
      .map((file) => file.name);
    expect(copies, 'call canManageBusiness from lib/manage-rights instead').toEqual([]);
  });
});
