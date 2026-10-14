// "Make a dashboard" opens its dialog in every state the button shows in (persona
// issue 259). Loading and load-error kept the button and dropped the dialog.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

describe('the new-board dialog', () => {
  it('is drawn once, outside the states', () => {
    expect(read('./dashboards-states.tsx')).not.toContain('<BoardDialog');
    expect(read('./dashboards.tsx').match(/<BoardDialog /g)?.length).toBe(1);
  });

  it('is drawn whatever state the pane is in', () => {
    const surface = read('./dashboards.tsx');
    expect(surface).not.toMatch(/\n {2}if \([^)]*\) return </);
  });
});
