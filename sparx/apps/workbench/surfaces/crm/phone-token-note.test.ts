// The note about changing a phone token shows only beside a connected number
// (sparx persona issue 239, the neighbour of 236).
//
// With no phone system connected, the foot of the pane still said "To change
// the token on a connected number, disconnect it and connect it again."

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pane = readFileSync(
  fileURLToPath(new URL('./phone-systems-list.tsx', import.meta.url)),
  'utf8'
);

describe('the phone token note', () => {
  it('is drawn only when a phone system is listed', () => {
    const note = pane.indexOf('To change the token on a connected number');
    expect(note).toBeGreaterThan(-1);
    expect(pane.slice(Math.max(0, note - 400), note)).toMatch(
      /(rows\.length > 0|listed) \? \(\s*<p/
    );
  });
});
