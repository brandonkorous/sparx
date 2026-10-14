// A create form becomes the saved record (sparx persona issue 242). With no
// target, the record opened in a new tab and left its filled form open beside
// it, where a second press made a second invoice or return.

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

/** A just-created record opened with no target, so in a new tab. */
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
