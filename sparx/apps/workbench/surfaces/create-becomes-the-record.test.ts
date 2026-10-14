// A form that creates something becomes that thing (sparx persona issue 242).
//
// After a create succeeds, the form opens the saved record. With no target the
// workbench opens it in a NEW tab, and the form it came from stays open, still
// filled in, with its button still saying "Add". A second press made a second
// supplier invoice for the same delivery, a second count schedule, a second
// return. Every other create form passes `{ target: 'replace' }`, so the pane
// becomes the record it just made; five did not.
//
// Every surface is read here, so the next create form cannot miss it.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('.', import.meta.url));

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

/** `ctx.open(<detail surface>, { id: saved.id })`: the record a create just returned,
 *  opened with no third argument, so with the default target, a new tab. */
const OPENS_BESIDE_ITS_FORM =
  /ctx\.open\(\s*'[^']+',\s*\{\s*(?:id|key):\s*(?:saved|created)\.(?:id|key)\s*\}\s*\)/g;

function strayForms(): string[] {
  return sourcesUnder(root).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(OPENS_BESIDE_ITS_FORM)].map(
      (match) => `${file.slice(root.length)}: ${match[0]}`
    )
  );
}

describe('a form that creates something', () => {
  it('becomes the saved record instead of leaving itself open beside it', () => {
    expect(strayForms()).toEqual([]);
  });
});
