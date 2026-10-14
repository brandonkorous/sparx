// A record that is gone reads the same everywhere (sparx persona issue 235).
//
// A deleted webhook reopened as a loud yellow box of its own and a deleted tag
// list as a third design, where every other pane says "That ... is no longer
// here. Nothing of yours has been lost." through the one shared state.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('a deleted record', () => {
  it.each(['./webhook-detail.tsx', './taxonomy-detail.tsx'])('%s uses the shared state', (file) => {
    const pane = read(file);
    expect(pane).toContain('reason="missing"');
    expect(pane).not.toContain('This webhook no longer exists');
    expect(pane).not.toContain('title="This no longer exists"');
  });
});
