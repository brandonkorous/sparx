// The record type screen says why it could not open, and Save is off until
// there is something to save (sparx persona issue 243).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

describe('the record type screen', () => {
  it('uses the shared could-not-load state, with Try again', () => {
    const detail = read('object-type-detail.tsx');
    expect(detail).toMatch(/<PaneLoadError\s[\s\S]*?noun="thing you track"/);
    expect(detail).toMatch(/onRetry=\{\(\) => \{\s*void refetch\(\);/);
    expect(detail).not.toContain('or the thing you track has been removed');
  });

  it('keeps Save off until something has changed', () => {
    expect(read('object-type-toolbar.tsx')).toMatch(/disabled=\{[^}]*\(!isNew && !dirty\)/);
  });
});
