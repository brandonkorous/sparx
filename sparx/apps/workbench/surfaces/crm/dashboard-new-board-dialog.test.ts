// "New dashboard" opens its dialog in every state the button shows in (persona
// issue 259). Loading and load-error kept the button and dropped the dialog.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./dashboards.tsx', import.meta.url)), 'utf8');

describe('the boardless toolbar', () => {
  it('brings the new-board dialog with it', () => {
    const start = source.indexOf('const boardlessToolbar = (');
    const end = source.indexOf('\n  );\n', start);
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, end)).toContain('{boardDialog}');
  });

  it('is the only place a boardless state draws the dialog', () => {
    const states = source.slice(
      source.indexOf('if (landing.isPending)'),
      source.indexOf('const renaming =')
    );
    expect(states).not.toContain('{boardDialog}');
  });
});
