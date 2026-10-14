// An empty booking links list uses the house state (sparx persona issue 237).
//
// It was a small heading and a paragraph floating at the top of a blank column,
// where every other empty list shows a card, the module glyph and a centered
// title. Piggles already did it the house way.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pane = readFileSync(fileURLToPath(new URL('./meeting-links.tsx', import.meta.url)), 'utf8');

describe('no booking links yet', () => {
  it('is the shared empty state in a card', () => {
    expect(pane).toMatch(/<PaneEmpty[\s\S]{0,200}?title="No booking links yet"/);
    expect(pane).not.toMatch(/<Heading[^>]*>\s*No booking links yet/);
  });
});
