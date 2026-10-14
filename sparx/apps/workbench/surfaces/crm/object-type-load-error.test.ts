// The record type screen says why it could not open, and Save is off until
// there is something to save (sparx persona issue 243).
//
// Issue 240 gave the records list and one record the shared `PaneLoadError`: a
// missing type says it is no longer here, and an unreachable server gets Try
// again. The record type screen kept a bare `EmptyState` that named both causes
// at once and offered no way on. Its Save was lit whenever the name was valid,
// so it could not say "you have changes".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const detail = readFileSync(
  fileURLToPath(new URL('./object-type-detail.tsx', import.meta.url)),
  'utf8'
);

describe('the record type screen', () => {
  it('uses the shared could-not-load state, with Try again', () => {
    expect(detail).toMatch(/<PaneLoadError\s[\s\S]*?noun="record type"/);
    expect(detail).toMatch(/onRetry=\{\(\) => \{\s*void refetch\(\);/);
    expect(detail).not.toContain('or the record type has been removed');
  });

  it('keeps Save off until something has changed', () => {
    expect(detail).toMatch(/disabled=\{[^}]*\(!isNew && !dirty\)/);
  });
});
