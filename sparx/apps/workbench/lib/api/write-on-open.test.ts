// A WRITE NOBODY ASKED FOR IS NOT A SAVE.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and every pattern below is `String.raw`.
//
// ── What he saw ─────────────────────────────────────────────────────────────
//
// Doty opened a customer's chat to read it, typed nothing, and the status bar
// said "Saved just now" (sparx persona issue 165). Opening a conversation clears
// its unread mark, and that write was counted as his work. Opening a contact-form
// message did the same: it marks the message Read on its own.
//
// The status bar is the one place people look to check their work is safe, so
// it must never report a save that is not theirs. A mutation says so with
// `meta: { housekeeping: true }` (lib/api/write-meta.ts); the visit ping already
// did, and these two did not, because nothing asked them to.
//
// ── What this guards ────────────────────────────────────────────────────────
//
// Every `useEffect` in the console that fires a mutation on its own. The hook
// behind that mutation must declare `housekeeping: true`, or appear below with
// the reason it is the operator's own write. It reads SOURCE, because the fault
// renders perfectly and passes every type check.
// [[feedback_a_fix_leaves_its_neighbour_behind]]

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, '../..');
const ROOTS = ['surfaces', 'components', 'lib'].map((dir) => join(WORKBENCH, dir));

/** Hooks fired from an effect that ARE the operator's own write, with why. */
const OPERATOR_WRITES = new Map<string, string>([]);

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
  for (const root of ROOTS) walk(root);
  return out;
}

/** The text between the brace at `open` and the one that closes it. */
function braceBody(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return text.slice(open + 1);
}

/** Every effect body in a file. */
function effectBodies(text: string): string[] {
  const bodies: string[] = [];
  const effect = new RegExp(String.raw`useEffect\(\(\)\s*=>\s*\{`, 'g');
  for (const match of text.matchAll(effect)) {
    bodies.push(braceBody(text, match.index + match[0].length - 1));
  }
  return bodies;
}

/** `name` → the hook it was made from, for `const name = useSomething(`. */
function hookOf(text: string, name: string): string | null {
  const made = new RegExp(String.raw`const\s+${name}\s*=\s*(use\w+)\(`).exec(text);
  return made?.[1] ?? null;
}

/** The body of `export function hook(`, wherever in the console it lives. */
function hookBody(files: { text: string }[], hook: string): string | null {
  const declared = new RegExp(String.raw`export function ${hook}\([^)]*\)[^{]*\{`);
  for (const file of files) {
    const match = declared.exec(file.text);
    if (match) return braceBody(file.text, match.index + match[0].length - 1);
  }
  return null;
}

/** Every mutation an effect fires on its own: file, variable, hook. */
function writesOnOpen(files: { name: string; text: string }[]) {
  const found: { file: string; hook: string }[] = [];
  const fired = new RegExp(String.raw`(\w+)\.mutate\(`, 'g');
  for (const file of files) {
    for (const body of effectBodies(file.text)) {
      for (const call of body.matchAll(fired)) {
        const hook = hookOf(file.text, call[1] ?? '');
        if (hook) found.push({ file: file.name, hook });
      }
    }
  }
  return found;
}

describe('a write a pane makes on its own', () => {
  const files = sourceFiles();
  const writes = writesOnOpen(files);

  it('finds the writes it is guarding, so it cannot pass by scanning nothing', () => {
    expect(files.length).toBeGreaterThan(200);
    expect(writes.map((write) => write.hook)).toEqual(
      expect.arrayContaining(['useMarkRead', 'useMarkSubmissionRead'])
    );
  });

  it('never counts as the operator saving something', () => {
    const unmarked = writes
      .filter((write) => !OPERATOR_WRITES.has(write.hook))
      .filter((write) => {
        const body = hookBody(files, write.hook);
        return body === null || !/housekeeping:\s*true/.test(body);
      })
      .map((write) => `${write.file}: ${write.hook}`);
    expect(unmarked).toEqual([]);
  });
});
