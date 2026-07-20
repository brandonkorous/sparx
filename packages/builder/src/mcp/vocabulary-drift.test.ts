// Guards the ONE piece of duplication the vocabulary check depends on.
//
// `@sparx/silica-catalog`'s `vocabulary-patterns.ts` is a hand-mirrored copy of the
// `@source inline(...)` patterns in `builder-vocabulary.css` — the file Tailwind
// actually reads. It has to be a copy: that module ships to the BROWSER (the studio
// validates classes as an author types) and a runtime `fs` read would not survive the
// bundle. The catalog package deliberately carries no node types for the same reason,
// which is why this drift check lives HERE, in a server-side package, rather than
// beside the thing it checks.
//
// If the copy goes stale, every vocabulary check silently weakens — the guard would
// clear a class the stylesheet no longer emits, or flag one it now does. That is the
// same shape of invisible failure the vocabulary exists to prevent, so it gets a test.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { VOCABULARY_PATTERNS } from '@sparx/silica-catalog';

describe('VOCABULARY_PATTERNS mirrors builder-vocabulary.css', () => {
  it('matches every @source inline(...) in the real stylesheet', () => {
    const require = createRequire(import.meta.url);
    const cssPath = require
      .resolve('@sparx/silica-catalog')
      .replace(/src[\\/]index\.ts$/, 'src/builder-vocabulary.css');
    const css = readFileSync(cssPath, 'utf8');
    const inCss = [...css.matchAll(/@source\s+inline\(\s*'([^']*)'\s*\)/g)].map((m) => m[1]);

    expect(inCss.length, 'found no @source inline patterns — did the CSS move?').toBeGreaterThan(0);
    expect([...VOCABULARY_PATTERNS].sort()).toEqual([...inCss].sort());
  });
});
